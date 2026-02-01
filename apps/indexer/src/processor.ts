import type { IndexerEvent } from './listener';
import { handleTaskCreated } from './handlers/task-created';
import { handleTaskClaimed } from './handlers/task-claimed';
import { handleWorkSubmitted } from './handlers/work-submitted';
import { handleTaskCompleted } from './handlers/task-completed';
import { handleTaskCancelled } from './handlers/task-cancelled';
import { handleTaskFailed } from './handlers/task-failed';
import { handleTaskReopenedForRevision } from './handlers/task-reopened';
import { handleTaskExpiredFromClaim } from './handlers/task-expired';
import { handleAgentRegistered } from './handlers/agent-registered';
import { handleVerdictSubmitted } from './handlers/verdict-submitted';

/**
 * Process an indexer event by routing to the appropriate handler
 */
export async function processEvent(event: IndexerEvent): Promise<void> {
  console.log(`Processing event: ${event.name} at block ${event.blockNumber}`);

  try {
    switch (event.name) {
      case 'TaskCreated':
        await handleTaskCreated(event);
        break;

      case 'TaskClaimed':
        await handleTaskClaimed(event);
        break;

      case 'WorkSubmitted':
        await handleWorkSubmitted(event);
        break;

      case 'TaskCompleted':
        await handleTaskCompleted(event);
        break;

      case 'TaskCancelled':
        await handleTaskCancelled(event);
        break;

      case 'TaskFailed':
        await handleTaskFailed(event);
        break;

      case 'TaskReopenedForRevision':
        await handleTaskReopenedForRevision(event);
        break;

      case 'TaskExpiredFromClaim':
        await handleTaskExpiredFromClaim(event);
        break;

      case 'AgentRegistered':
        await handleAgentRegistered(event);
        break;

      case 'VerdictSubmitted':
        await handleVerdictSubmitted(event);
        break;

      default:
        console.warn(`Unknown event type: ${event.name}`);
    }
  } catch (error) {
    console.error(`Failed to process event ${event.name}:`, error);
    throw error; // Re-throw to allow retry logic
  }
}
