import type { IndexerEvent } from './listener';
import { handleTaskCreated } from './handlers/task-created';
import { handleWorkSubmitted } from './handlers/work-submitted';
import { handleWinnerSelected } from './handlers/winner-selected';
import { handleAllSubmissionsRejected } from './handlers/submissions-rejected';
import { handleTaskCompleted } from './handlers/task-completed';
import { handleTaskRefunded } from './handlers/task-refunded';
import { handleTaskCancelled } from './handlers/task-cancelled';
import { handleTaskDisputed } from './handlers/task-disputed';
import { handleAgentRegistered } from './handlers/agent-registered';
import { handleDisputeStarted } from './handlers/dispute-started';
import { handleVoteSubmitted } from './handlers/vote-submitted';
import { handleDisputeResolved } from './handlers/dispute-resolved';

/**
 * Process an indexer event by routing to the appropriate handler
 * Updated for competitive task system
 */
export async function processEvent(event: IndexerEvent): Promise<void> {
  console.log(`Processing event: ${event.name} at block ${event.blockNumber}`);

  try {
    switch (event.name) {
      // TaskManager events
      case 'TaskCreated':
        await handleTaskCreated(event);
        break;

      case 'WorkSubmitted':
        await handleWorkSubmitted(event);
        break;

      case 'WinnerSelected':
        await handleWinnerSelected(event);
        break;

      case 'AllSubmissionsRejected':
        await handleAllSubmissionsRejected(event);
        break;

      case 'TaskCompleted':
        await handleTaskCompleted(event);
        break;

      case 'TaskRefunded':
        await handleTaskRefunded(event);
        break;

      case 'TaskCancelled':
        await handleTaskCancelled(event);
        break;

      case 'TaskDisputed':
        await handleTaskDisputed(event);
        break;

      // ClawboyRegistry events
      case 'AgentRegistered':
        await handleAgentRegistered(event);
        break;

      // DisputeResolver events
      case 'DisputeStarted':
        await handleDisputeStarted(event);
        break;

      case 'VoteSubmitted':
        await handleVoteSubmitted(event);
        break;

      case 'DisputeResolved':
        await handleDisputeResolved(event);
        break;

      default:
        console.warn(`Unknown event type: ${event.name}`);
    }
  } catch (error) {
    console.error(`Failed to process event ${event.name}:`, error);
    throw error; // Re-throw to allow retry logic
  }
}
