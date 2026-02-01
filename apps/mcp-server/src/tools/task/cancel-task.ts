import { z } from 'zod';
import { getTaskHandler } from '../../services/task-service';

export const cancelTaskSchema = z.object({
  taskId: z.string().min(1),
  reason: z.string().optional(),
});

export type CancelTaskInput = z.infer<typeof cancelTaskSchema>;

export const cancelTaskTool = {
  name: 'cancel_task',
  description: 'Cancel a task you created. Only works if task is not claimed.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      taskId: {
        type: 'string',
        description: 'The task ID to cancel',
      },
      reason: {
        type: 'string',
        description: 'Optional reason for cancellation',
      },
    },
    required: ['taskId'],
  },
  handler: async (args: unknown, context: { callerAddress: `0x${string}` }) => {
    const input = cancelTaskSchema.parse(args);

    // Verify task exists and caller is creator
    const task = await getTaskHandler({ taskId: input.taskId });
    if (!task) {
      throw new Error(`Task not found: ${input.taskId}`);
    }

    if (task.creator.toLowerCase() !== context.callerAddress.toLowerCase()) {
      throw new Error('Only the task creator can cancel the task');
    }

    if (task.status !== 'open') {
      throw new Error(`Cannot cancel task with status: ${task.status}`);
    }

    return {
      message: 'Task cancellation prepared',
      taskId: input.taskId,
      reason: input.reason,
      nextStep: 'Call the TaskManager contract to cancel the task on-chain',
    };
  },
};
