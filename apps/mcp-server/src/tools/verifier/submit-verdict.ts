import { z } from 'zod';
import { uploadVerificationFeedback } from '@porternetwork/ipfs-utils';
import { getTaskHandler } from '../../services/task-service';

export const submitVerdictSchema = z.object({
  taskId: z.string().min(1),
  claimId: z.string().min(1),
  outcome: z.enum(['approved', 'rejected', 'revision_requested']),
  score: z.number().min(0).max(100),
  feedback: z.string().min(1),
  recommendations: z.array(z.string()).optional(),
});

export type SubmitVerdictInput = z.infer<typeof submitVerdictSchema>;

export const submitVerdictTool = {
  name: 'submit_verdict',
  description: 'Submit verification verdict for completed work. Only available for Elite tier agents.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      taskId: {
        type: 'string',
        description: 'The task ID',
      },
      claimId: {
        type: 'string',
        description: 'The claim ID being verified',
      },
      outcome: {
        type: 'string',
        enum: ['approved', 'rejected', 'revision_requested'],
        description: 'Verification outcome',
      },
      score: {
        type: 'number',
        description: 'Overall score (0-100)',
      },
      feedback: {
        type: 'string',
        description: 'Detailed feedback',
      },
      recommendations: {
        type: 'array',
        items: { type: 'string' },
        description: 'Recommendations for improvement',
      },
    },
    required: ['taskId', 'claimId', 'outcome', 'score', 'feedback'],
  },
  handler: async (args: unknown, context: { callerAddress: `0x${string}`; isVerifier: boolean }) => {
    if (!context.isVerifier) {
      throw new Error('Only Elite tier agents can submit verifications');
    }

    const input = submitVerdictSchema.parse(args);

    // Verify task exists and is in submitted state
    const task = await getTaskHandler({ taskId: input.taskId });
    if (!task) {
      throw new Error(`Task not found: ${input.taskId}`);
    }

    if (task.status !== 'submitted') {
      throw new Error(`Task is not pending verification: status is ${task.status}`);
    }

    // Create and upload feedback
    const feedback = {
      version: '1.0' as const,
      taskId: input.taskId,
      claimId: input.claimId,
      verdict: input.outcome,
      score: input.score,
      feedback: input.feedback,
      recommendations: input.recommendations,
      verifiedAt: new Date().toISOString(),
    };

    const uploadResult = await uploadVerificationFeedback(feedback);

    return {
      message: 'Verification feedback uploaded to IPFS',
      taskId: input.taskId,
      claimId: input.claimId,
      outcome: input.outcome,
      score: input.score,
      feedbackCid: uploadResult.cid,
      nextStep: 'Call the VerificationHub contract to submit verdict on-chain',
    };
  },
};
