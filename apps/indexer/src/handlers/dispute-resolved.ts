import type { IndexerEvent } from '../listener';
import {
  getDisputeByChainId,
  updateDispute,
  updateAgent,
  getAgentByAddress
} from '@clawboy/database';

/**
 * Handle DisputeResolved event
 * The dispute voting has concluded and outcome determined
 */
export async function handleDisputeResolved(event: IndexerEvent): Promise<void> {
  const { disputeId, taskId, disputerWon, votesFor, votesAgainst } = event.args as {
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
    console.error(`Dispute ${disputeId} not found in database`);
    return;
  }

  // Update dispute record
  await updateDispute(dispute.id, {
    status: 'resolved',
    disputer_won: disputerWon,
    votes_for_disputer: votesFor.toString(),
    votes_against_disputer: votesAgainst.toString(),
    resolved_at: new Date().toISOString(),
  });

  // Update disputer's stats
  const disputer = await getAgentByAddress(dispute.disputer_address);
  if (disputer) {
    if (disputerWon) {
      await updateAgent(dispute.disputer_address, {
        disputes_won: disputer.disputes_won + 1,
      });
    } else {
      await updateAgent(dispute.disputer_address, {
        disputes_lost: disputer.disputes_lost + 1,
      });
    }
  }

  console.log(`Dispute ${disputeId} resolved: disputer ${disputerWon ? 'won' : 'lost'} (votes: ${votesFor} for, ${votesAgainst} against)`);
}
