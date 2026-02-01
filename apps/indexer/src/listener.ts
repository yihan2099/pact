import { getPublicClient, getBlockNumber } from '@porternetwork/web3-utils';
import { TaskManagerABI, getContractAddresses } from '@porternetwork/contracts';
import type { Log } from 'viem';

export interface EventListener {
  start(): Promise<void>;
  stop(): void;
  onEvent(handler: (event: IndexerEvent) => Promise<void>): void;
}

export interface IndexerEvent {
  name: string;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
  args: Record<string, unknown>;
}

/**
 * Create an event listener for blockchain events
 */
export function createEventListener(
  chainId: number = 84532,
  pollingIntervalMs: number = 5000
): EventListener {
  const publicClient = getPublicClient(chainId);
  const addresses = getContractAddresses(chainId);

  let isRunning = false;
  let lastProcessedBlock: bigint = 0n;
  let eventHandler: ((event: IndexerEvent) => Promise<void>) | null = null;

  const parseEvent = (log: Log, name: string): IndexerEvent => {
    return {
      name,
      blockNumber: log.blockNumber ?? 0n,
      transactionHash: log.transactionHash ?? '0x0',
      logIndex: log.logIndex ?? 0,
      args: (log as any).args || {},
    };
  };

  const pollEvents = async () => {
    if (!isRunning || !eventHandler) return;

    try {
      const currentBlock = await getBlockNumber(chainId);

      if (lastProcessedBlock === 0n) {
        // On first run, start from current block
        lastProcessedBlock = currentBlock;
        console.log(`Starting from block ${currentBlock}`);
        return;
      }

      if (currentBlock <= lastProcessedBlock) {
        return; // No new blocks
      }

      // Get TaskManager events
      const taskCreatedLogs = await publicClient.getLogs({
        address: addresses.taskManager,
        event: {
          type: 'event',
          name: 'TaskCreated',
          inputs: [
            { name: 'taskId', type: 'uint256', indexed: true },
            { name: 'creator', type: 'address', indexed: true },
            { name: 'bountyAmount', type: 'uint256', indexed: false },
            { name: 'bountyToken', type: 'address', indexed: false },
            { name: 'specificationCid', type: 'string', indexed: false },
            { name: 'deadline', type: 'uint256', indexed: false },
          ],
        },
        fromBlock: lastProcessedBlock + 1n,
        toBlock: currentBlock,
      });

      const taskClaimedLogs = await publicClient.getLogs({
        address: addresses.taskManager,
        event: {
          type: 'event',
          name: 'TaskClaimed',
          inputs: [
            { name: 'taskId', type: 'uint256', indexed: true },
            { name: 'agent', type: 'address', indexed: true },
            { name: 'claimDeadline', type: 'uint256', indexed: false },
          ],
        },
        fromBlock: lastProcessedBlock + 1n,
        toBlock: currentBlock,
      });

      const workSubmittedLogs = await publicClient.getLogs({
        address: addresses.taskManager,
        event: {
          type: 'event',
          name: 'WorkSubmitted',
          inputs: [
            { name: 'taskId', type: 'uint256', indexed: true },
            { name: 'agent', type: 'address', indexed: true },
            { name: 'submissionCid', type: 'string', indexed: false },
          ],
        },
        fromBlock: lastProcessedBlock + 1n,
        toBlock: currentBlock,
      });

      const taskCompletedLogs = await publicClient.getLogs({
        address: addresses.taskManager,
        event: {
          type: 'event',
          name: 'TaskCompleted',
          inputs: [
            { name: 'taskId', type: 'uint256', indexed: true },
            { name: 'agent', type: 'address', indexed: true },
            { name: 'bountyAmount', type: 'uint256', indexed: false },
          ],
        },
        fromBlock: lastProcessedBlock + 1n,
        toBlock: currentBlock,
      });

      // Process all events
      const allEvents = [
        ...taskCreatedLogs.map((l) => parseEvent(l, 'TaskCreated')),
        ...taskClaimedLogs.map((l) => parseEvent(l, 'TaskClaimed')),
        ...workSubmittedLogs.map((l) => parseEvent(l, 'WorkSubmitted')),
        ...taskCompletedLogs.map((l) => parseEvent(l, 'TaskCompleted')),
      ];

      // Sort by block number and log index
      allEvents.sort((a, b) => {
        if (a.blockNumber !== b.blockNumber) {
          return a.blockNumber < b.blockNumber ? -1 : 1;
        }
        return a.logIndex - b.logIndex;
      });

      // Process events
      for (const event of allEvents) {
        await eventHandler(event);
      }

      lastProcessedBlock = currentBlock;

      if (allEvents.length > 0) {
        console.log(`Processed ${allEvents.length} events up to block ${currentBlock}`);
      }
    } catch (error) {
      console.error('Error polling events:', error);
    }
  };

  let pollInterval: Timer | null = null;

  return {
    async start() {
      isRunning = true;
      console.log(`Starting event listener for chain ${chainId}`);

      // Initial poll
      await pollEvents();

      // Set up polling interval
      pollInterval = setInterval(pollEvents, pollingIntervalMs);
    },

    stop() {
      isRunning = false;
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      console.log('Event listener stopped');
    },

    onEvent(handler) {
      eventHandler = handler;
    },
  };
}
