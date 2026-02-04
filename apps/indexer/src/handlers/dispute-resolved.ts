import type { IndexerEvent } from '../listener';
import {
  getDisputeByChainId,
  updateDispute,
  incrementDisputesWon,
  incrementDisputesLost,
} from '@clawboy/database';
import { invalidateDisputeCaches, invalidateAgentCaches } from '@clawboy/cache';

/**
 * Handle DisputeResolved event
 * The dispute voting has concluded and outcome determined
 * Uses atomic increment operations to avoid N+1 queries and race conditions
 */
export async function handleDisputeResolved(event: IndexerEvent): Promise<void> {
  const { disputeId, disputerWon, votesFor, votesAgainst } = event.args as {
    disputeId: bigint;
    taskId: bigint;
    disputerWon: boolean;
    votesFor: bigint;
    votesAgainst: bigint;
  };

  console.log(`Processing DisputeResolved: disputeId=${disputeId}, disputerWon=${disputerWon}`);

  // Find dispute in database
  const dispute = await getDisputeByChainId(disputeId.toString());
  if (!dispute) {
    // Throw error so event goes to DLQ for retry (dispute may be created by pending DisputeStarted event)
    throw new Error(`Dispute ${disputeId} not found in database`);
  }

  // Update dispute record
  await updateDispute(dispute.id, {
    status: 'resolved',
    disputer_won: disputerWon,
    votes_for_disputer: votesFor.toString(),
    votes_against_disputer: votesAgainst.toString(),
    resolved_at: new Date().toISOString(),
  });

  // Update disputer's stats atomically (avoids N+1 query and race conditions)
  try {
    if (disputerWon) {
      await incrementDisputesWon(dispute.disputer_address);
    } else {
      await incrementDisputesLost(dispute.disputer_address);
    }
    console.log(
      `Updated disputes ${disputerWon ? 'won' : 'lost'} for agent ${dispute.disputer_address}`
    );
  } catch (error) {
    // Agent may not exist in database yet - log but don't fail the event
    console.warn(`Could not update dispute stats for ${dispute.disputer_address}: ${error}`);
  }

  // Invalidate relevant caches
  await Promise.all([
    invalidateDisputeCaches(dispute.id),
    invalidateAgentCaches(dispute.disputer_address),
  ]);

  console.log(
    `Dispute ${disputeId} resolved: disputer ${disputerWon ? 'won' : 'lost'} (votes: ${votesFor} for, ${votesAgainst} against)`
  );
}
