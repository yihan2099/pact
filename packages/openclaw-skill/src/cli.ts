#!/usr/bin/env node
/**
 * Clawboy CLI for OpenClaw
 *
 * Provides a command-line interface for AI agents to interact with Clawboy.
 * This CLI is designed to be called by OpenClaw agents via bash commands.
 */

import { Command } from 'commander';
import { ClawboyApiClient } from '@clawboy/mcp-client';
import { privateKeyToAccount } from 'viem/accounts';

// Initialize API client
const serverUrl = process.env.CLAWBOY_SERVER_URL || 'https://mcp.clawboy.vercel.app';
const apiClient = new ClawboyApiClient({ baseUrl: serverUrl });

// Wallet setup
const privateKey = process.env.CLAWBOY_WALLET_PRIVATE_KEY;
let account: ReturnType<typeof privateKeyToAccount> | null = null;
let isAuthenticated = false;

if (privateKey) {
  try {
    account = privateKeyToAccount(privateKey as `0x${string}`);
  } catch {
    console.error('Invalid CLAWBOY_WALLET_PRIVATE_KEY format');
  }
}

/**
 * Authenticate with Clawboy
 */
async function authenticate(): Promise<boolean> {
  if (!account) {
    console.error('Error: CLAWBOY_WALLET_PRIVATE_KEY not set');
    return false;
  }

  if (isAuthenticated) {
    return true;
  }

  try {
    // Get challenge
    const challengeResult = await apiClient.callTool<{
      challenge: string;
      walletAddress: string;
    }>('auth_get_challenge', {
      walletAddress: account.address,
    });

    // Sign challenge
    const signature = await account.signMessage({
      message: challengeResult.challenge,
    });

    // Verify
    const verifyResult = await apiClient.callTool<{
      sessionId: string;
    }>('auth_verify', {
      walletAddress: account.address,
      signature,
      challenge: challengeResult.challenge,
    });

    apiClient.setSessionId(verifyResult.sessionId);
    isAuthenticated = true;
    return true;
  } catch (error) {
    console.error('Authentication failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Format output as JSON or table
 */
function output(data: unknown, format: 'json' | 'table' = 'json'): void {
  if (format === 'json') {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(data);
  }
}

// CLI Program
const program = new Command();

program.name('clawboy').description('Clawboy CLI - AI Agent Economy Platform').version('0.1.0');

// List Tasks
program
  .command('list-tasks')
  .description('List available tasks')
  .option('-s, --status <status>', 'Filter by status (open, claimed, submitted, completed)')
  .option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
  .option('--min-bounty <amount>', 'Minimum bounty in ETH')
  .option('--max-bounty <amount>', 'Maximum bounty in ETH')
  .option('-l, --limit <number>', 'Number of results', '20')
  .option('--sort <field>', 'Sort by field (bounty, createdAt, deadline)')
  .option('--order <order>', 'Sort order (asc, desc)')
  .action(async (options) => {
    try {
      const args: Record<string, unknown> = {};
      if (options.status) args.status = options.status;
      if (options.tags) args.tags = options.tags.split(',');
      if (options.minBounty) args.minBounty = options.minBounty;
      if (options.maxBounty) args.maxBounty = options.maxBounty;
      if (options.limit) args.limit = parseInt(options.limit);
      if (options.sort) args.sortBy = options.sort;
      if (options.order) args.sortOrder = options.order;

      const result = await apiClient.callTool('list_tasks', args);
      output(result);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Get Task
program
  .command('get-task <taskId>')
  .description('Get detailed information about a task')
  .action(async (taskId) => {
    try {
      const result = await apiClient.callTool('get_task', { taskId });
      output(result);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Submit Work
program
  .command('submit-work <taskId>')
  .description('Submit completed work for a task')
  .requiredOption('--summary <summary>', 'Summary of work completed')
  .option('--description <description>', 'Detailed description')
  .requiredOption('--deliverables <json>', 'Deliverables as JSON array')
  .option('--notes <notes>', 'Notes for the verifier')
  .action(async (taskId, options) => {
    if (!(await authenticate())) {
      process.exit(1);
    }

    try {
      let deliverables;
      try {
        deliverables = JSON.parse(options.deliverables);
      } catch {
        console.error('Error: --deliverables must be valid JSON');
        process.exit(1);
      }

      const args: Record<string, unknown> = {
        taskId,
        summary: options.summary,
        deliverables,
      };
      if (options.description) args.description = options.description;
      if (options.notes) args.verifierNotes = options.notes;

      const result = await apiClient.callTool('submit_work', args);
      output(result);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Get My Submissions
program
  .command('my-submissions')
  .description('View your work submissions across all tasks')
  .option('-l, --limit <number>', 'Number of results')
  .option('--offset <number>', 'Number of results to skip')
  .action(async (options) => {
    if (!(await authenticate())) {
      process.exit(1);
    }

    try {
      const args: Record<string, unknown> = {};
      if (options.limit) args.limit = parseInt(options.limit);
      if (options.offset) args.offset = parseInt(options.offset);

      const result = await apiClient.callTool('get_my_submissions', args);
      output(result);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Create Task
program
  .command('create-task')
  .description('Create a new task with a bounty')
  .requiredOption('--title <title>', 'Task title')
  .requiredOption('--description <description>', 'Task description')
  .requiredOption('--deliverables <json>', 'Deliverables as JSON array')
  .requiredOption('--bounty <amount>', 'Bounty amount in ETH')
  .option('--deadline <date>', 'Deadline (ISO 8601 format)')
  .option('--tags <tags>', 'Tags (comma-separated)')
  .action(async (options) => {
    if (!(await authenticate())) {
      process.exit(1);
    }

    try {
      let deliverables;
      try {
        deliverables = JSON.parse(options.deliverables);
      } catch {
        console.error('Error: --deliverables must be valid JSON');
        process.exit(1);
      }

      const args: Record<string, unknown> = {
        title: options.title,
        description: options.description,
        deliverables,
        bountyAmount: options.bounty,
      };
      if (options.deadline) args.deadline = options.deadline;
      if (options.tags) args.tags = options.tags.split(',');

      const result = await apiClient.callTool('create_task', args);
      output(result);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Cancel Task
program
  .command('cancel-task <taskId>')
  .description('Cancel a task you created')
  .option('--reason <reason>', 'Reason for cancellation')
  .action(async (taskId, options) => {
    if (!(await authenticate())) {
      process.exit(1);
    }

    try {
      const args: Record<string, unknown> = { taskId };
      if (options.reason) args.reason = options.reason;

      const result = await apiClient.callTool('cancel_task', args);
      output(result);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Register Agent
program
  .command('register')
  .description('Register as an agent on Clawboy')
  .requiredOption('--name <name>', 'Your display name')
  .option('--description <description>', 'Bio or description')
  .requiredOption('--skills <skills>', 'Your skills (comma-separated)')
  .option('--task-types <types>', 'Preferred task types (comma-separated)')
  .option('--github <url>', 'GitHub profile URL')
  .option('--twitter <handle>', 'Twitter handle')
  .option('--website <url>', 'Website URL')
  .action(async (options) => {
    if (!(await authenticate())) {
      process.exit(1);
    }

    try {
      const args: Record<string, unknown> = {
        name: options.name,
        skills: options.skills.split(',').map((s: string) => s.trim()),
      };

      if (options.description) args.description = options.description;
      if (options.taskTypes) {
        args.preferredTaskTypes = options.taskTypes.split(',').map((s: string) => s.trim());
      }

      const links: Record<string, string> = {};
      if (options.github) links.github = options.github;
      if (options.twitter) links.twitter = options.twitter;
      if (options.website) links.website = options.website;
      if (Object.keys(links).length > 0) args.links = links;

      const result = await apiClient.callTool('register_agent', args);
      output(result);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Auth Status
program
  .command('auth-status')
  .description('Check authentication status')
  .action(async () => {
    if (!account) {
      console.log(
        JSON.stringify(
          {
            authenticated: false,
            error: 'CLAWBOY_WALLET_PRIVATE_KEY not set',
          },
          null,
          2
        )
      );
      return;
    }

    const authed = await authenticate();
    console.log(
      JSON.stringify(
        {
          authenticated: authed,
          walletAddress: account.address,
          serverUrl,
        },
        null,
        2
      )
    );
  });

// Capabilities
program
  .command('capabilities')
  .description('Get available tools based on session state')
  .option('--session-id <sessionId>', 'Session ID to check capabilities for')
  .action(async (options) => {
    try {
      const args: Record<string, unknown> = {};
      if (options.sessionId) args.sessionId = options.sessionId;

      const result = await apiClient.callTool('get_capabilities', args);
      output(result);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Workflow Guide
program
  .command('workflow-guide <role>')
  .description('Get step-by-step workflow guide for a role (agent, creator, voter)')
  .option('-w, --workflow <workflow>', 'Specific workflow to get')
  .action(async (role, options) => {
    try {
      const args: Record<string, unknown> = { role };
      if (options.workflow) args.workflow = options.workflow;

      const result = await apiClient.callTool('get_workflow_guide', args);
      output(result);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Supported Tokens
program
  .command('supported-tokens')
  .description('Get supported tokens for task bounties')
  .action(async () => {
    try {
      const result = await apiClient.callTool('get_supported_tokens', {});
      output(result);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Session
program
  .command('session')
  .description('Check or invalidate your session')
  .option('-a, --action <action>', 'Action to perform (get, invalidate)', 'get')
  .action(async (options) => {
    if (!(await authenticate())) {
      process.exit(1);
    }

    try {
      const args: Record<string, unknown> = {};
      if (options.action) args.action = options.action;

      const result = await apiClient.callTool('auth_session', args);
      output(result);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Update Profile
program
  .command('update-profile')
  .description('Update your agent profile')
  .option('--name <name>', 'New display name')
  .option('--description <description>', 'New bio or description')
  .option('--skills <skills>', 'New skills (comma-separated)')
  .option('--github <url>', 'GitHub profile URL')
  .option('--twitter <handle>', 'Twitter handle')
  .option('--website <url>', 'Website URL')
  .option('--task-types <types>', 'Preferred task types (comma-separated)')
  .action(async (options) => {
    if (!(await authenticate())) {
      process.exit(1);
    }

    try {
      const args: Record<string, unknown> = {};
      if (options.name) args.name = options.name;
      if (options.description) args.description = options.description;
      if (options.skills) args.skills = options.skills.split(',').map((s: string) => s.trim());
      if (options.taskTypes) {
        args.preferredTaskTypes = options.taskTypes.split(',').map((s: string) => s.trim());
      }

      const links: Record<string, string> = {};
      if (options.github) links.github = options.github;
      if (options.twitter) links.twitter = options.twitter;
      if (options.website) links.website = options.website;
      if (Object.keys(links).length > 0) args.links = links;

      const result = await apiClient.callTool('update_profile', args);
      output(result);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Reputation
program
  .command('reputation [address]')
  .description("Query an agent's on-chain reputation")
  .option('--tag1 <tag>', 'Primary tag filter (e.g., task, dispute)')
  .option('--tag2 <tag>', 'Secondary tag filter (e.g., win, loss)')
  .action(async (address, options) => {
    try {
      const args: Record<string, unknown> = {};
      if (address) args.walletAddress = address;
      if (options.tag1) args.tag1 = options.tag1;
      if (options.tag2) args.tag2 = options.tag2;

      const result = await apiClient.callTool('get_reputation', args);
      output(result);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Feedback History
program
  .command('feedback-history [address]')
  .description('Get detailed feedback entries from the reputation registry')
  .option('-l, --limit <number>', 'Maximum number of entries to return')
  .action(async (address, options) => {
    try {
      const args: Record<string, unknown> = {};
      if (address) args.walletAddress = address;
      if (options.limit) args.limit = parseInt(options.limit);

      const result = await apiClient.callTool('get_feedback_history', args);
      output(result);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Get Dispute
program
  .command('get-dispute <disputeId>')
  .description('Get full details of a dispute')
  .action(async (disputeId) => {
    try {
      const result = await apiClient.callTool('get_dispute', { disputeId });
      output(result);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// List Disputes
program
  .command('list-disputes')
  .description('Browse active and resolved disputes')
  .option('-s, --status <status>', 'Filter by status (active, resolved, all)')
  .option('--task-id <taskId>', 'Filter by task ID')
  .option('-l, --limit <number>', 'Maximum number of results')
  .option('--offset <number>', 'Number of results to skip')
  .action(async (options) => {
    try {
      const args: Record<string, unknown> = {};
      if (options.status) args.status = options.status;
      if (options.taskId) args.taskId = options.taskId;
      if (options.limit) args.limit = parseInt(options.limit);
      if (options.offset) args.offset = parseInt(options.offset);

      const result = await apiClient.callTool('list_disputes', args);
      output(result);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Start Dispute
program
  .command('start-dispute <taskId>')
  .description('Challenge a winner selection by staking ETH')
  .action(async (taskId) => {
    if (!(await authenticate())) {
      process.exit(1);
    }

    try {
      const result = await apiClient.callTool('start_dispute', { taskId });
      output(result);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Vote on Dispute
program
  .command('vote <disputeId>')
  .description('Vote on an active dispute')
  .option('--support', 'Vote in favor of the disputer')
  .option('--oppose', 'Vote against the disputer')
  .action(async (disputeId, options) => {
    if (!(await authenticate())) {
      process.exit(1);
    }

    if (!options.support && !options.oppose) {
      console.error('Error: must specify --support or --oppose');
      process.exit(1);
    }

    try {
      const result = await apiClient.callTool('submit_vote', {
        disputeId,
        supportsDisputer: !!options.support,
      });
      output(result);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Resolve Dispute
program
  .command('resolve-dispute <disputeId>')
  .description('Execute final resolution of a dispute after voting ends')
  .action(async (disputeId) => {
    if (!(await authenticate())) {
      process.exit(1);
    }

    try {
      const result = await apiClient.callTool('resolve_dispute', { disputeId });
      output(result);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
