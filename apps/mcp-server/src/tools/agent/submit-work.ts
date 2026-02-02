import { z } from 'zod';
import { getTaskHandler } from '../../services/task-service';
import { uploadWorkSubmission } from '@porternetwork/ipfs-utils';
import {
  getSubmissionByTaskAndAgent,
  createSubmission,
  updateSubmission,
} from '@porternetwork/database';
import type { WorkSubmission } from '@porternetwork/shared-types';

// SECURITY: IPFS CID v0 and v1 format validation
const cidRegex = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{58,})$/;

export const submitWorkSchema = z.object({
  taskId: z.string().min(1).max(100), // SECURITY: Limit task ID length
  summary: z.string().min(1).max(1000), // SECURITY: Limit summary length
  description: z.string().max(50000).optional(), // SECURITY: Limit description length
  deliverables: z.array(
    z.object({
      type: z.enum(['code', 'document', 'data', 'file', 'other']),
      description: z.string().min(1).max(2000), // SECURITY: Limit description
      // SECURITY: Validate CID format if provided
      cid: z.string().regex(cidRegex, 'Invalid IPFS CID format').optional(),
      // SECURITY: Validate URL format (zod already validates)
      url: z.string().url().max(2000).optional(),
    })
  ).min(1).max(20), // SECURITY: Limit number of deliverables
  creatorNotes: z.string().max(5000).optional(), // SECURITY: Limit notes length
});

export type SubmitWorkInput = z.infer<typeof submitWorkSchema>;

export const submitWorkTool = {
  name: 'submit_work',
  description: 'Submit work for an open task. In the competitive model, any registered agent can submit work. You can update your submission before the deadline.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      taskId: {
        type: 'string',
        description: 'The task ID',
      },
      summary: {
        type: 'string',
        description: 'Summary of work completed',
      },
      description: {
        type: 'string',
        description: 'Detailed description of the work',
      },
      deliverables: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['code', 'document', 'data', 'file', 'other'],
            },
            description: { type: 'string' },
            cid: { type: 'string' },
            url: { type: 'string' },
          },
          required: ['type', 'description'],
        },
        description: 'Submitted deliverables with CIDs or URLs',
      },
      creatorNotes: {
        type: 'string',
        description: 'Notes for the task creator',
      },
    },
    required: ['taskId', 'summary', 'deliverables'],
  },
  handler: async (args: unknown, context: { callerAddress: `0x${string}` }) => {
    const input = submitWorkSchema.parse(args);

    // Verify task exists and is open
    const task = await getTaskHandler({ taskId: input.taskId });
    if (!task) {
      throw new Error(`Task not found: ${input.taskId}`);
    }

    if (task.status !== 'open') {
      throw new Error(`Cannot submit work for task with status: ${task.status}. Task must be open.`);
    }

    // Check if deadline has passed
    if (task.deadline && new Date(task.deadline) < new Date()) {
      throw new Error('Task deadline has passed');
    }

    // Create work submission for IPFS
    const submission: WorkSubmission = {
      version: '1.0',
      taskId: input.taskId,
      summary: input.summary,
      description: input.description,
      deliverables: input.deliverables.map((d) => ({
        type: d.type,
        description: d.description,
        cid: d.cid,
        url: d.url,
      })),
      creatorNotes: input.creatorNotes,
      submittedAt: new Date().toISOString(),
    };

    // Upload to IPFS
    const uploadResult = await uploadWorkSubmission(submission);

    // Check if this is an update to an existing submission
    const existingSubmission = await getSubmissionByTaskAndAgent(
      input.taskId,
      context.callerAddress
    );

    let isUpdate = false;

    if (existingSubmission) {
      // Update existing submission
      await updateSubmission(existingSubmission.id, {
        submission_cid: uploadResult.cid,
        updated_at: new Date().toISOString(),
      });
      isUpdate = true;
    } else {
      // Create new submission
      await createSubmission({
        task_id: input.taskId,
        agent_address: context.callerAddress,
        submission_cid: uploadResult.cid,
        submission_index: 0, // Will be updated by indexer from chain event
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return {
      message: isUpdate ? 'Submission updated successfully' : 'Work submitted successfully',
      taskId: input.taskId,
      submissionCid: uploadResult.cid,
      isUpdate,
      nextStep: 'Call the TaskManager contract to submit the work on-chain with this CID',
    };
  },
};
