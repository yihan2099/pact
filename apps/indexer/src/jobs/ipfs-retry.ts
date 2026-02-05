/**
 * Background job for retrying failed IPFS fetches
 * Runs periodically to update tasks/agents that have ipfs_fetch_failed = true
 */

import {
  getTasksWithFailedIpfs,
  getAgentsWithFailedIpfs,
  updateTask,
  updateAgent,
} from '@clawboy/database';
import { fetchTaskSpecification, fetchAgentProfile, isValidCid } from '@clawboy/ipfs-utils';
import { withRetryResult } from '../utils/retry';

/**
 * Retry failed IPFS fetches for tasks
 */
async function retryTaskIpfsFetches(): Promise<{ success: number; failed: number }> {
  const tasks = await getTasksWithFailedIpfs(50);

  if (tasks.length === 0) {
    return { success: 0, failed: 0 };
  }

  console.log(`Retrying IPFS fetches for ${tasks.length} tasks...`);

  let success = 0;
  let failed = 0;

  for (const task of tasks) {
    // Pre-validate CID format before attempting fetch
    if (!isValidCid(task.specification_cid)) {
      console.error(
        `IPFS retry failed for task ${task.chain_task_id} (CID: ${task.specification_cid}): Invalid CID format (permanent failure, will not retry)`
      );
      failed++;
      continue;
    }

    const fetchResult = await withRetryResult(
      () => fetchTaskSpecification(task.specification_cid),
      {
        maxAttempts: 2,
        initialDelayMs: 2000,
        maxDelayMs: 10000,
      }
    );

    if (fetchResult.success && fetchResult.data) {
      try {
        await updateTask(task.id, {
          title: fetchResult.data.title,
          description: fetchResult.data.description,
          tags: fetchResult.data.tags || [],
          ipfs_fetch_failed: false,
        });

        console.log(`Successfully updated task ${task.chain_task_id} with IPFS data`);
        success++;
      } catch (error) {
        console.error(`Failed to update task ${task.chain_task_id}:`, error);
        failed++;
      }
    } else {
      console.warn(
        `IPFS retry failed for task ${task.chain_task_id} (CID: ${task.specification_cid}): ${fetchResult.error}`
      );
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Retry failed IPFS fetches for agents
 */
async function retryAgentIpfsFetches(): Promise<{ success: number; failed: number }> {
  const agents = await getAgentsWithFailedIpfs(50);

  if (agents.length === 0) {
    return { success: 0, failed: 0 };
  }

  console.log(`Retrying IPFS fetches for ${agents.length} agents...`);

  let success = 0;
  let failed = 0;

  for (const agent of agents) {
    // Pre-validate CID format before attempting fetch
    if (!isValidCid(agent.profile_cid)) {
      console.error(
        `IPFS retry failed for agent ${agent.address} (CID: ${agent.profile_cid}): Invalid CID format (permanent failure, will not retry)`
      );
      failed++;
      continue;
    }

    const fetchResult = await withRetryResult(() => fetchAgentProfile(agent.profile_cid), {
      maxAttempts: 2,
      initialDelayMs: 2000,
      maxDelayMs: 10000,
    });

    if (fetchResult.success && fetchResult.data) {
      try {
        await updateAgent(agent.address, {
          name: fetchResult.data.name || agent.name,
          skills: fetchResult.data.skills || agent.skills,
          ipfs_fetch_failed: false,
        });

        console.log(`Successfully updated agent ${agent.address} with IPFS data`);
        success++;
      } catch (error) {
        console.error(`Failed to update agent ${agent.address}:`, error);
        failed++;
      }
    } else {
      console.warn(
        `IPFS retry failed for agent ${agent.address} (CID: ${agent.profile_cid}): ${fetchResult.error}`
      );
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Run all IPFS retry jobs
 */
export async function runIpfsRetryJobs(): Promise<void> {
  console.log('Starting IPFS retry jobs...');

  try {
    const taskResults = await retryTaskIpfsFetches();
    console.log(`Task IPFS retries: ${taskResults.success} success, ${taskResults.failed} failed`);

    const agentResults = await retryAgentIpfsFetches();
    console.log(
      `Agent IPFS retries: ${agentResults.success} success, ${agentResults.failed} failed`
    );
  } catch (error) {
    console.error('Error running IPFS retry jobs:', error);
  }
}

/**
 * Start IPFS retry job with interval
 */
export function startIpfsRetryJob(intervalMs: number = 300000): () => void {
  console.log(`Starting IPFS retry job with ${intervalMs}ms interval`);

  // Run immediately on start
  runIpfsRetryJobs();

  // Then run periodically
  const interval = setInterval(runIpfsRetryJobs, intervalMs);

  // Return cleanup function
  return () => {
    clearInterval(interval);
    console.log('IPFS retry job stopped');
  };
}
