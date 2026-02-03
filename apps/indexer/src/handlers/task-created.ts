import type { IndexerEvent } from '../listener';
import { createTask } from '@clawboy/database';
import { fetchTaskSpecification } from '@clawboy/ipfs-utils';
import { withRetryResult } from '../utils/retry';

/**
 * Handle TaskCreated event
 * Includes IPFS retry with exponential backoff
 */
export async function handleTaskCreated(event: IndexerEvent): Promise<void> {
  const { taskId, creator, bountyAmount, bountyToken, specificationCid, deadline } =
    event.args as {
      taskId: bigint;
      creator: `0x${string}`;
      bountyAmount: bigint;
      bountyToken: `0x${string}`;
      specificationCid: string;
      deadline: bigint;
    };

  console.log(`Processing TaskCreated: taskId=${taskId}, creator=${creator}`);

  // Fetch specification from IPFS with retry
  let title = 'Untitled Task';
  let description = '';
  let tags: string[] = [];
  let ipfsFetchFailed = false;

  const fetchResult = await withRetryResult(
    () => fetchTaskSpecification(specificationCid),
    {
      maxAttempts: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      onRetry: (attempt, error, delayMs) => {
        console.warn(
          `IPFS fetch attempt ${attempt} failed for CID ${specificationCid}: ${error.message}. Retrying in ${delayMs}ms...`
        );
      },
    }
  );

  if (fetchResult.success && fetchResult.data) {
    title = fetchResult.data.title;
    description = fetchResult.data.description;
    tags = fetchResult.data.tags || [];
    console.log(`Successfully fetched task spec after ${fetchResult.attempts} attempt(s)`);
  } else {
    ipfsFetchFailed = true;
    console.error(
      `Failed to fetch task spec for CID ${specificationCid} after ${fetchResult.attempts} attempts: ${fetchResult.error}`
    );
    console.warn('Task will be created with default values; IPFS fetch will be retried later');
  }

  // Create task in database
  await createTask({
    chain_task_id: taskId.toString(),
    creator_address: creator.toLowerCase(),
    status: 'open',
    bounty_amount: bountyAmount.toString(),
    bounty_token: bountyToken,
    specification_cid: specificationCid,
    title,
    description,
    tags,
    deadline: deadline > 0n ? new Date(Number(deadline) * 1000).toISOString() : null,
    created_at_block: event.blockNumber.toString(),
    ipfs_fetch_failed: ipfsFetchFailed,
  });

  console.log(`Task ${taskId} created in database (IPFS fetch ${ipfsFetchFailed ? 'failed' : 'succeeded'})`);
}
