import { z } from 'zod';
import { prepareClaimHandler } from '../../services/claim-service';
import { getTaskHandler } from '../../services/task-service';

export const claimTaskSchema = z.object({
  taskId: z.string().min(1),
  message: z.string().optional(),
});

export type ClaimTaskInput = z.infer<typeof claimTaskSchema>;

export const claimTaskTool = {
  name: 'claim_task',
  description: 'Claim a task to work on. You can only claim tasks with status "open".',
  inputSchema: {
    type: 'object' as const,
    properties: {
      taskId: {
        type: 'string',
        description: 'The task ID to claim',
      },
      message: {
        type: 'string',
        description: 'Optional message to the task creator',
      },
    },
    required: ['taskId'],
  },
  handler: async (args: unknown, context: { callerAddress: `0x${string}` }) => {
    const input = claimTaskSchema.parse(args);

    // Verify task exists and is claimable
    const task = await getTaskHandler({ taskId: input.taskId });
    if (!task) {
      throw new Error(`Task not found: ${input.taskId}`);
    }

    if (task.status !== 'open') {
      throw new Error(`Task is not available for claiming: status is ${task.status}`);
    }

    const result = await prepareClaimHandler(input, context.callerAddress);

    return {
      message: 'Task claim prepared',
      taskId: result.taskId,
      agentAddress: result.agentAddress,
      nextStep: 'Call the TaskManager contract to claim the task on-chain',
    };
  },
};
