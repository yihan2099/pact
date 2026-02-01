import type { IndexerEvent } from './listener';
import { handleTaskCreated } from './handlers/task-created';
import { handleTaskClaimed } from './handlers/task-claimed';
import { handleWorkSubmitted } from './handlers/work-submitted';
import { handleTaskCompleted } from './handlers/task-completed';

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

      default:
        console.warn(`Unknown event type: ${event.name}`);
    }
  } catch (error) {
    console.error(`Failed to process event ${event.name}:`, error);
    throw error; // Re-throw to allow retry logic
  }
}
