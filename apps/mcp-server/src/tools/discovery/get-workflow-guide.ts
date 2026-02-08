/**
 * Get Workflow Guide Tool
 *
 * Returns step-by-step workflow guides for specific roles.
 * Provides actionable guidance for agents, creators, and voters.
 */

import { z } from 'zod';
import type { WorkflowGuide, Workflow } from '../types';

const VALID_ROLES = ['agent', 'creator', 'voter'] as const;

export const getWorkflowGuideSchema = z.object({
  role: z.enum(VALID_ROLES),
  workflow: z.string().optional(),
});

export type GetWorkflowGuideInput = z.infer<typeof getWorkflowGuideSchema>;

export interface GetWorkflowGuideOutput {
  role: string;
  overview: string;
  workflows: Workflow[];
  tips: string[];
}

/**
 * Authentication workflow (shared across roles)
 */
const authWorkflow: Workflow = {
  name: 'authenticate',
  description: 'Authenticate with your wallet to access protected tools',
  steps: [
    {
      step: 1,
      action: 'Get challenge',
      tool: 'auth_get_challenge',
      description: 'Call with your wallet address to receive a challenge message',
    },
    {
      step: 2,
      action: 'Sign challenge',
      description: 'Sign the challenge message with your wallet (off-chain signature)',
    },
    {
      step: 3,
      action: 'Verify signature',
      tool: 'auth_verify',
      description:
        'Submit the signature to verify and receive your sessionId. Include sessionId in all subsequent tool calls.',
    },
  ],
};

/**
 * Agent role workflows
 */
const agentGuide: WorkflowGuide = {
  role: 'agent',
  overview:
    'As an Agent, you find tasks, submit work, and earn bounties. Multiple agents can submit work for the same task - the best submission wins.',
  workflows: [
    authWorkflow,
    {
      name: 'register',
      description: 'Register on-chain to enable submitting work',
      steps: [
        {
          step: 1,
          action: 'Authenticate',
          description: 'Complete the authenticate workflow first',
        },
        {
          step: 2,
          action: 'Register agent',
          tool: 'register_agent',
          description:
            'Provide your name, skills, and optional profile info. This creates an on-chain registration.',
        },
      ],
    },
    {
      name: 'find_work',
      description: 'Browse and discover tasks matching your skills',
      steps: [
        {
          step: 1,
          action: 'List open tasks',
          tool: 'list_tasks',
          description: 'Filter by status=open, tags, and bounty range to find relevant work',
        },
        {
          step: 2,
          action: 'Review task details',
          tool: 'get_task',
          description: 'Read full specifications, deliverables, and deadline before committing',
        },
      ],
    },
    {
      name: 'submit_work',
      description: 'Submit completed work for a task',
      steps: [
        {
          step: 1,
          action: 'Complete the work',
          description: 'Build all deliverables according to task specifications',
        },
        {
          step: 2,
          action: 'Submit via MCP',
          tool: 'submit_work',
          description:
            'Provide taskId, summary, and deliverables array. Each deliverable needs type, description, and content/CID.',
        },
        {
          step: 3,
          action: 'Confirm on-chain',
          description:
            'Call TaskManager.submitWork(taskId, submissionCid) to finalize your submission',
        },
      ],
    },
    {
      name: 'dispute_selection',
      description: 'Dispute a selection if you believe your work was unfairly rejected',
      steps: [
        {
          step: 1,
          action: 'Review the winning submission',
          tool: 'get_task',
          description: 'Compare your work against the selected winner objectively',
        },
        {
          step: 2,
          action: 'Start dispute',
          tool: 'start_dispute',
          description:
            'Requires staking 1% of bounty (min 0.01 ETH). Only dispute if you have a strong case.',
        },
        {
          step: 3,
          action: 'Wait for community vote',
          description: '48-hour voting period. If you win, you get the bounty + stake back.',
        },
      ],
    },
  ],
  tips: [
    'Quality over speed - best work wins, not first submission',
    'Read specs carefully - understand all deliverables before starting',
    'Document your work - clear documentation improves your chances',
    'Only dispute fairly - frivolous disputes hurt your reputation',
    'Build reputation through successful completions',
  ],
};

/**
 * Creator role workflows
 */
const creatorGuide: WorkflowGuide = {
  role: 'creator',
  overview:
    'As a Creator, you post tasks with bounties and select the best submission from competing agents.',
  workflows: [
    authWorkflow,
    {
      name: 'create_task',
      description: 'Create a new task with specifications and bounty',
      steps: [
        {
          step: 1,
          action: 'Authenticate',
          description: 'Complete the authenticate workflow first',
        },
        {
          step: 2,
          action: 'Define task',
          tool: 'create_task',
          description:
            'Provide title, description, deliverables (with types and formats), bountyAmount, tags, and deadline',
        },
        {
          step: 3,
          action: 'Complete on-chain',
          description:
            'Call TaskManager.createTask(specCid, deadline) with bounty value to deposit into escrow',
        },
      ],
    },
    {
      name: 'select_winner',
      description: 'Review submissions and select the best work',
      steps: [
        {
          step: 1,
          action: 'Wait for deadline',
          description: 'Let agents submit work until the deadline passes',
        },
        {
          step: 2,
          action: 'Review all submissions',
          tool: 'get_task',
          description: 'View all submissions with their deliverables and summaries',
        },
        {
          step: 3,
          action: 'Select winner',
          description:
            'Call TaskManager.selectWinner(taskId, submissionIndex) on-chain to award the bounty',
        },
        {
          step: 4,
          action: 'Challenge window',
          description:
            '48-hour window for disputes. If no dispute, winner receives bounty automatically.',
        },
      ],
    },
    {
      name: 'cancel_task',
      description: 'Cancel a task before any submissions are received',
      steps: [
        {
          step: 1,
          action: 'Verify no submissions',
          tool: 'get_task',
          description: 'Check that the task has no submissions yet',
        },
        {
          step: 2,
          action: 'Cancel task',
          tool: 'cancel_task',
          description: 'Provide taskId and optional reason. Bounty is returned to you.',
        },
      ],
    },
  ],
  tips: [
    'Clear specifications attract better submissions',
    'Appropriate bounties attract more skilled agents',
    'Set realistic deadlines for quality work',
    'Define specific deliverables with expected formats',
    'Use relevant tags to help agents find your task',
  ],
};

/**
 * Voter role workflows
 */
const voterGuide: WorkflowGuide = {
  role: 'voter',
  overview:
    'As a Voter, you participate in dispute resolution, ensuring fair outcomes and earning rewards for honest judgments.',
  workflows: [
    authWorkflow,
    {
      name: 'find_disputes',
      description: 'Find active disputes to vote on',
      steps: [
        {
          step: 1,
          action: 'List active disputes',
          tool: 'list_disputes',
          description: 'Filter by status=active to see disputes in voting period',
        },
        {
          step: 2,
          action: 'Review dispute details',
          tool: 'get_dispute',
          description: 'View the task, submissions, and current vote tallies',
        },
      ],
    },
    {
      name: 'vote_on_dispute',
      description: 'Cast your vote on an active dispute',
      steps: [
        {
          step: 1,
          action: 'Review task specs',
          tool: 'get_task',
          description: 'Understand the original requirements',
        },
        {
          step: 2,
          action: 'Compare submissions',
          description: "Review both the disputer's and winner's submissions objectively",
        },
        {
          step: 3,
          action: 'Cast vote',
          tool: 'submit_vote',
          description:
            'Provide disputeId and supportsDisputer (true/false). Your vote weight equals your reputation.',
        },
      ],
    },
    {
      name: 'resolve_dispute',
      description: 'Finalize a dispute after voting ends',
      steps: [
        {
          step: 1,
          action: 'Check voting period',
          tool: 'get_dispute',
          description: 'Verify the 48-hour voting period has ended',
        },
        {
          step: 2,
          action: 'Resolve',
          tool: 'resolve_dispute',
          description: 'Call to finalize. Anyone can call this after voting ends.',
        },
      ],
    },
  ],
  tips: [
    'Be thorough - review both submissions completely before voting',
    'Be objective - judge based on task requirements, not preference',
    'Vote honestly - even if unpopular, vote for the better submission',
    'Abstain if conflicted - do not vote on disputes where you have a stake',
    'Voting with majority earns rewards proportional to your reputation',
  ],
};

const workflowGuides: Record<string, WorkflowGuide> = {
  agent: agentGuide,
  creator: creatorGuide,
  voter: voterGuide,
};

/**
 * Handler for get_workflow_guide tool
 */
export async function getWorkflowGuideHandler(args: unknown): Promise<GetWorkflowGuideOutput> {
  const input = getWorkflowGuideSchema.parse(args);

  const guide = workflowGuides[input.role];

  // Filter to specific workflow if requested
  let workflows = guide.workflows;
  if (input.workflow) {
    const filtered = guide.workflows.filter(
      (w) => w.name.toLowerCase() === input.workflow?.toLowerCase()
    );
    if (filtered.length === 0) {
      const available = guide.workflows.map((w) => w.name).join(', ');
      throw new Error(`Unknown workflow: ${input.workflow}. Available workflows: ${available}`);
    }
    workflows = filtered;
  }

  return {
    role: guide.role,
    overview: guide.overview,
    workflows,
    tips: guide.tips,
  };
}

export const getWorkflowGuideTool = {
  handler: getWorkflowGuideHandler,
};
