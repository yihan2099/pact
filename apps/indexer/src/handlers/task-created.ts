import type { IndexerEvent } from '../listener';
import { createTask } from '@porternetwork/database';
import { fetchTaskSpecification } from '@porternetwork/ipfs-utils';

/**
 * Handle TaskCreated event
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

  // Fetch specification from IPFS
  let title = 'Untitled Task';
  let description = '';
  let tags: string[] = [];

  try {
    const spec = await fetchTaskSpecification(specificationCid);
    title = spec.title;
    description = spec.description;
    tags = spec.tags || [];
  } catch (error) {
    console.warn(`Failed to fetch task spec for CID ${specificationCid}:`, error);
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
  });

  console.log(`Task ${taskId} created in database`);
}
