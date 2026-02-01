// Task tools
export { listTasksTool } from './task/list-tasks';
export { getTaskTool } from './task/get-task';
export { createTaskTool } from './task/create-task';
export { cancelTaskTool } from './task/cancel-task';

// Agent tools
export { claimTaskTool } from './agent/claim-task';
export { submitWorkTool } from './agent/submit-work';
export { getMyClaimsTool } from './agent/get-my-claims';

// Verifier tools
export { listPendingTool } from './verifier/list-pending';
export { submitVerdictTool } from './verifier/submit-verdict';

// All tools registry
export const allTools = [
  // Task tools
  {
    name: 'list_tasks',
    description: 'List available tasks with optional filters',
    inputSchema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['open', 'claimed', 'submitted', 'completed'] },
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
    name: 'claim_task',
    description: 'Claim a task to work on',
    inputSchema: {
      type: 'object' as const,
      properties: {
        taskId: { type: 'string' },
        message: { type: 'string' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'submit_work',
    description: 'Submit completed work for a claimed task',
    inputSchema: {
      type: 'object' as const,
      properties: {
        taskId: { type: 'string' },
        summary: { type: 'string' },
        description: { type: 'string' },
        deliverables: { type: 'array' },
        verifierNotes: { type: 'string' },
      },
      required: ['taskId', 'summary', 'deliverables'],
    },
  },
  {
    name: 'get_my_claims',
    description: 'Get your claimed tasks',
    inputSchema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['active', 'submitted', 'approved', 'rejected'] },
        limit: { type: 'number' },
      },
    },
  },
  // Verifier tools
  {
    name: 'list_pending_verifications',
    description: 'List tasks awaiting verification (Elite tier only)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number' },
        offset: { type: 'number' },
      },
    },
  },
  {
    name: 'submit_verdict',
    description: 'Submit verification verdict (Elite tier only)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        taskId: { type: 'string' },
        claimId: { type: 'string' },
        outcome: { type: 'string', enum: ['approved', 'rejected', 'revision_requested'] },
        score: { type: 'number' },
        feedback: { type: 'string' },
        recommendations: { type: 'array', items: { type: 'string' } },
      },
      required: ['taskId', 'claimId', 'outcome', 'score', 'feedback'],
    },
  },
];
