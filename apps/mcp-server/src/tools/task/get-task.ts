import { z } from 'zod';
import { getTaskHandler } from '../../services/task-service';

export const getTaskSchema = z.object({
  taskId: z.string().min(1),
});

export type GetTaskInput = z.infer<typeof getTaskSchema>;

export const getTaskTool = {
  name: 'get_task',
  description: 'Get detailed information about a specific task including deliverables and requirements',
  inputSchema: {
    type: 'object' as const,
    properties: {
      taskId: {
        type: 'string',
        description: 'The task ID to retrieve',
      },
    },
    required: ['taskId'],
  },
  handler: async (args: unknown) => {
    const input = getTaskSchema.parse(args);
    const result = await getTaskHandler(input);

    if (!result) {
      throw new Error(`Task not found: ${input.taskId}`);
    }

    return result;
  },
};
