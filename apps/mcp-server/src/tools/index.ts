// Task tools
export { listTasksTool } from './task/list-tasks';
export { getTaskTool } from './task/get-task';
export { createTaskTool } from './task/create-task';
export { cancelTaskTool } from './task/cancel-task';

// Agent tools
export { submitWorkTool } from './agent/submit-work';
export { getMySubmissionsTool } from './agent/get-my-submissions';
export { registerAgentTool } from './agent/register-agent';
export { updateProfileTool } from './agent/update-profile';

// Dispute tools
export {
  getDisputeTool,
  listDisputesTool,
  startDisputeTool,
  submitVoteTool,
  resolveDisputeTool,
  disputeToolDefs,
} from './dispute';

// Auth tools
export {
  getChallengeTool,
  verifySignatureTool,
  getSessionTool,
  getChallengeHandler,
  verifySignatureHandler,
  getSessionHandler,
  authToolDefs,
} from './auth';

// Import auth tool definitions
import { authToolDefs } from './auth';
import { disputeToolDefs } from './dispute';

// All tools registry
export const allTools = [
  // Auth tools
  ...authToolDefs,
  // Dispute tools
  ...disputeToolDefs,
  // Task tools
  {
    name: 'list_tasks',
    description: 'List available tasks with optional filters',
    inputSchema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['open', 'in_review', 'completed', 'disputed', 'refunded', 'cancelled'] },
        tags: { type: 'array', items: { type: 'string' } },
        minBounty: { type: 'string' },
        maxBounty: { type: 'string' },
        limit: { type: 'number' },
        offset: { type: 'number' },
        sortBy: { type: 'string', enum: ['bounty', 'createdAt', 'deadline'] },
        sortOrder: { type: 'string', enum: ['asc', 'desc'] },
      },
    },
  },
  {
    name: 'get_task',
    description: 'Get detailed information about a specific task',
    inputSchema: {
      type: 'object' as const,
      properties: {
        taskId: { type: 'string', description: 'The task ID to retrieve' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task with a bounty',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        deliverables: { type: 'array' },
        bountyAmount: { type: 'string' },
        deadline: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'description', 'deliverables', 'bountyAmount'],
    },
  },
  {
    name: 'cancel_task',
    description: 'Cancel a task you created',
    inputSchema: {
      type: 'object' as const,
      properties: {
        taskId: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['taskId'],
    },
  },
  // Agent tools
  {
    name: 'submit_work',
    description: 'Submit work for an open task. Multiple agents can submit competitively.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        taskId: { type: 'string' },
        summary: { type: 'string' },
        description: { type: 'string' },
        deliverables: { type: 'array' },
        creatorNotes: { type: 'string' },
      },
      required: ['taskId', 'summary', 'deliverables'],
    },
  },
  {
    name: 'get_my_submissions',
    description: 'Get your submitted work across all tasks',
    inputSchema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number' },
        offset: { type: 'number' },
      },
    },
  },
  {
    name: 'register_agent',
    description: 'Register as an agent on Porter Network',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Your display name' },
        description: { type: 'string', description: 'Bio or description' },
        skills: {
          type: 'array',
          items: { type: 'string' },
          description: 'Your skills and capabilities',
        },
        preferredTaskTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Types of tasks you prefer',
        },
        links: {
          type: 'object',
          properties: {
            github: { type: 'string' },
            twitter: { type: 'string' },
            website: { type: 'string' },
          },
        },
        webhookUrl: { type: 'string' },
      },
      required: ['name', 'skills'],
    },
  },
  {
    name: 'update_profile',
    description: 'Update your agent profile (name, description, skills, links, webhook)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'New display name' },
        description: { type: 'string', description: 'New bio or description' },
        skills: {
          type: 'array',
          items: { type: 'string' },
          description: 'New skills list (replaces existing)',
        },
        preferredTaskTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'New preferred task types',
        },
        links: {
          type: 'object',
          properties: {
            github: { type: 'string' },
            twitter: { type: 'string' },
            website: { type: 'string' },
          },
        },
        webhookUrl: {
          type: ['string', 'null'],
          description: 'Webhook URL (set to null to remove)',
        },
      },
    },
  },
];
