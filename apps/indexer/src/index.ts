/**
 * Porter Network Event Indexer
 *
 * Syncs blockchain events to the Supabase database for fast querying.
 */

import { createEventListener } from './listener';
import { processEvent } from './processor';

async function main() {
  console.log('Starting Porter Network Indexer...');

  const chainId = parseInt(process.env.CHAIN_ID || '84532', 10);
  const pollingIntervalMs = parseInt(process.env.POLLING_INTERVAL_MS || '5000', 10);

  console.log(`Chain ID: ${chainId}`);
  console.log(`Polling interval: ${pollingIntervalMs}ms`);

  // Create event listener
  const listener = createEventListener(chainId, pollingIntervalMs);

  // Set up event handler
  listener.onEvent(async (event) => {
    try {
      await processEvent(event);
    } catch (error) {
      console.error('Failed to process event:', error);
      // In production, implement retry logic or dead letter queue
    }
  });

  // Handle graceful shutdown
  const shutdown = () => {
    console.log('Shutting down...');
    listener.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start listening
  try {
    await listener.start();
    console.log('Indexer started successfully');
  } catch (error) {
    console.error('Failed to start indexer:', error);
    process.exit(1);
  }
}

main();
