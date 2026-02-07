/**
 * Webhook Dispatch
 *
 * Maps indexer events to the appropriate webhook notification functions.
 * All dispatching is fire-and-forget -- errors are logged but never propagated.
 */

import type { IndexerEvent } from '../listener';
import { getTaskByChainId, getDisputeByChainId } from '@clawboy/database';
import {
  notifyTaskCreated,
  notifyWorkSubmitted,
  notifyWinnerSelected,
  notifyTaskCompleted,
  notifyDisputeCreated,
  notifyDisputeResolved,
  notifyVoteSubmitted,
} from './webhook-notifier';

/**
 * Dispatch webhook notifications for a processed event.
 * Fire-and-forget: never throws, logs all errors internally.
 */
export function dispatchWebhookNotifications(event: IndexerEvent): void {
  // Wrap in an immediately-invoked async function so we can await DB queries
  // but still return void synchronously (fire-and-forget)
  (async () => {
    try {
      switch (event.name) {
        case 'TaskCreated': {
          const { taskId, creator, bountyAmount } = event.args as {
            taskId: bigint;
            creator: `0x${string}`;
            bountyAmount: bigint;
            specificationCid: string;
          };
          // Look up task from DB for title and tags (just created by handler)
          const task = await getTaskByChainId(taskId.toString(), event.chainId);
          await notifyTaskCreated(
            taskId.toString(),
            creator.toLowerCase(),
            task?.title ?? 'New Task',
            bountyAmount.toString(),
            task?.tags ?? []
          );
          break;
        }

        case 'WorkSubmitted': {
          const { taskId, agent } = event.args as {
            taskId: bigint;
            agent: `0x${string}`;
          };
          const task = await getTaskByChainId(taskId.toString(), event.chainId);
          if (task) {
            await notifyWorkSubmitted(taskId.toString(), task.creator_address, agent.toLowerCase());
          }
          break;
        }

        case 'WinnerSelected': {
          const { taskId, winner } = event.args as {
            taskId: bigint;
            winner: `0x${string}`;
          };
          const task = await getTaskByChainId(taskId.toString(), event.chainId);
          if (task) {
            await notifyWinnerSelected(taskId.toString(), task.id, winner.toLowerCase());
          }
          break;
        }

        case 'TaskCompleted': {
          const { taskId, winner, bountyAmount } = event.args as {
            taskId: bigint;
            winner: `0x${string}`;
            bountyAmount: bigint;
          };
          await notifyTaskCompleted(
            taskId.toString(),
            winner.toLowerCase(),
            bountyAmount.toString()
          );
          break;
        }

        case 'DisputeCreated': {
          const { disputeId, taskId, disputer } = event.args as {
            disputeId: bigint;
            taskId: bigint;
            disputer: `0x${string}`;
          };
          const task = await getTaskByChainId(taskId.toString(), event.chainId);
          if (task) {
            await notifyDisputeCreated(
              taskId.toString(),
              task.id,
              disputeId.toString(),
              disputer.toLowerCase()
            );
          }
          break;
        }

        case 'VoteSubmitted': {
          const { disputeId, voter, supportsDisputer } = event.args as {
            disputeId: bigint;
            voter: `0x${string}`;
            supportsDisputer: boolean;
          };
          const dispute = await getDisputeByChainId(disputeId.toString());
          if (dispute) {
            await notifyVoteSubmitted(
              dispute.task_id,
              disputeId.toString(),
              dispute.disputer_address,
              voter.toLowerCase(),
              supportsDisputer
            );
          }
          break;
        }

        case 'DisputeResolved': {
          const { disputeId, disputerWon } = event.args as {
            disputeId: bigint;
            disputerWon: boolean;
          };
          const dispute = await getDisputeByChainId(disputeId.toString());
          if (dispute) {
            await notifyDisputeResolved(
              dispute.task_id,
              disputeId.toString(),
              dispute.disputer_address,
              disputerWon
            );
          }
          break;
        }

        // No webhook notifications for these events
        case 'AllSubmissionsRejected':
        case 'TaskRefunded':
        case 'TaskCancelled':
        case 'TaskDisputed':
        case 'AgentRegistered':
        case 'AgentProfileUpdated':
          break;

        default:
          break;
      }
    } catch (err) {
      console.warn(`Webhook dispatch error for ${event.name}:`, err);
    }
  })();
}
