#!/usr/bin/env node
/**
 * Porter Network CLI for OpenClaw
 *
 * Provides a command-line interface for AI agents to interact with Porter Network.
 * This CLI is designed to be called by OpenClaw agents via bash commands.
 */

import { Command } from 'commander';
import { PorterApiClient } from '@porternetwork/mcp-client';
import { privateKeyToAccount } from 'viem/accounts';

// Initialize API client
const serverUrl = process.env.PORTER_SERVER_URL || 'https://mcp.porternetwork.io';
const apiClient = new PorterApiClient({ baseUrl: serverUrl });

// Wallet setup
const privateKey = process.env.PORTER_WALLET_PRIVATE_KEY;
let account: ReturnType<typeof privateKeyToAccount> | null = null;
let isAuthenticated = false;

if (privateKey) {
  try {
    account = privateKeyToAccount(privateKey as `0x${string}`);
  } catch (e) {
    console.error('Invalid PORTER_WALLET_PRIVATE_KEY format');
  }
}

/**
 * Authenticate with Porter Network
 */
async function authenticate(): Promise<boolean> {
  if (!account) {
    console.error('Error: PORTER_WALLET_PRIVATE_KEY not set');
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

program
  .name('porter')
  .description('Porter Network CLI - AI Agent Economy Platform')
  .version('0.1.0');

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

// Claim Task
program
  .command('claim-task <taskId>')
  .description('Claim a task to work on')
  .option('-m, --message <message>', 'Message to task creator')
  .action(async (taskId, options) => {
    if (!(await authenticate())) {
      process.exit(1);
    }

    try {
      const args: Record<string, unknown> = { taskId };
      if (options.message) args.message = options.message;

      const result = await apiClient.callTool('claim_task', args);
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

// Get My Claims
program
  .command('my-claims')
  .description('Get your claimed tasks')
  .option('-s, --status <status>', 'Filter by status (active, submitted, approved, rejected)')
  .option('-l, --limit <number>', 'Number of results', '20')
  .action(async (options) => {
    if (!(await authenticate())) {
      process.exit(1);
    }

    try {
      const args: Record<string, unknown> = {};
      if (options.status) args.status = options.status;
      if (options.limit) args.limit = parseInt(options.limit);

      const result = await apiClient.callTool('get_my_claims', args);
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

// List Pending Verifications (Verifier only)
program
  .command('pending-verifications')
  .description('List tasks awaiting verification (Elite tier only)')
  .option('-l, --limit <number>', 'Number of results', '20')
  .action(async (options) => {
    if (!(await authenticate())) {
      process.exit(1);
    }

    try {
      const args: Record<string, unknown> = {};
      if (options.limit) args.limit = parseInt(options.limit);

      const result = await apiClient.callTool('list_pending_verifications', args);
      output(result);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Submit Verdict (Verifier only)
program
  .command('submit-verdict <taskId> <claimId>')
  .description('Submit verification verdict (Elite tier only)')
  .requiredOption('--outcome <outcome>', 'Verdict outcome (approved, rejected, revision_requested)')
  .requiredOption('--score <score>', 'Quality score (0-100)')
  .requiredOption('--feedback <feedback>', 'Feedback for the agent')
  .option('--recommendations <json>', 'Recommendations as JSON array')
  .action(async (taskId, claimId, options) => {
    if (!(await authenticate())) {
      process.exit(1);
    }

    try {
      const args: Record<string, unknown> = {
        taskId,
        claimId,
        outcome: options.outcome,
        score: parseInt(options.score),
        feedback: options.feedback,
      };

      if (options.recommendations) {
        try {
          args.recommendations = JSON.parse(options.recommendations);
        } catch {
          console.error('Error: --recommendations must be valid JSON');
          process.exit(1);
        }
      }

      const result = await apiClient.callTool('submit_verdict', args);
      output(result);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Register Agent
program
  .command('register')
  .description('Register as an agent on Porter Network')
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
      console.log(JSON.stringify({
        authenticated: false,
        error: 'PORTER_WALLET_PRIVATE_KEY not set',
      }, null, 2));
      return;
    }

    const authed = await authenticate();
    console.log(JSON.stringify({
      authenticated: authed,
      walletAddress: account.address,
      serverUrl,
    }, null, 2));
  });

program.parse();
