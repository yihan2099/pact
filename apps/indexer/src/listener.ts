import { getPublicClient, getBlockNumber } from '@clawboy/web3-utils';
import { getContractAddresses } from '@clawboy/contracts';
import { getLastSyncedBlock, updateSyncState } from '@clawboy/database';
import type { Log } from 'viem';

export interface EventListener {
  start(): Promise<void>;
  stop(): void;
  onEvent(handler: (event: IndexerEvent) => Promise<void>): void;
  getLastProcessedBlock(): bigint;
  isRunning(): boolean;
  hasCompletedInitialSync(): boolean;
}

export interface IndexerEvent {
  name: string;
  chainId: number;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  logIndex: number;
  args: Record<string, unknown>;
}

/**
 * Create an event listener for blockchain events
 * Updated for competitive task system
 */
export function createEventListener(
  chainId: number = 84532,
  pollingIntervalMs: number = 5000
): EventListener {
  const publicClient = getPublicClient(chainId);
  const addresses = getContractAddresses(chainId);

  let running = false;
  let lastProcessedBlock: bigint = 0n;
  let completedInitialSync = false;
  let eventHandler: ((event: IndexerEvent) => Promise<void>) | null = null;

  const parseEvent = (log: Log, name: string): IndexerEvent => {
    return {
      name,
      chainId,
      blockNumber: log.blockNumber ?? 0n,
      transactionHash: log.transactionHash ?? '0x0',
      logIndex: log.logIndex ?? 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      args: (log as any).args || {},
    };
  };

  const pollEvents = async () => {
    if (!running || !eventHandler) return;

    try {
      const currentBlock = await getBlockNumber(chainId);

      if (lastProcessedBlock === 0n) {
        // On first run, start from current block
        lastProcessedBlock = currentBlock;
        console.log(`Starting from block ${currentBlock}`);
        return;
      }

      // Capture fromBlock IMMEDIATELY to prevent race conditions
      // This must be captured before any async operations that could allow
      // concurrent pollEvents calls to modify lastProcessedBlock
      const fromBlock = lastProcessedBlock + 1n;

      // Validate block range (handles reorgs and race conditions)
      if (fromBlock > currentBlock) {
        return; // No new blocks or chain reorg
      }

      // ============ TaskManager Events ============

      // TaskCreated
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
        fromBlock,
        toBlock: currentBlock,
      });

      // WorkSubmitted (new or updated submission)
      const workSubmittedLogs = await publicClient.getLogs({
        address: addresses.taskManager,
        event: {
          type: 'event',
          name: 'WorkSubmitted',
          inputs: [
            { name: 'taskId', type: 'uint256', indexed: true },
            { name: 'agent', type: 'address', indexed: true },
            { name: 'submissionCid', type: 'string', indexed: false },
            { name: 'submissionIndex', type: 'uint256', indexed: false },
          ],
        },
        fromBlock,
        toBlock: currentBlock,
      });

      // WinnerSelected (creator picks winner)
      const winnerSelectedLogs = await publicClient.getLogs({
        address: addresses.taskManager,
        event: {
          type: 'event',
          name: 'WinnerSelected',
          inputs: [
            { name: 'taskId', type: 'uint256', indexed: true },
            { name: 'winner', type: 'address', indexed: true },
            { name: 'challengeDeadline', type: 'uint256', indexed: false },
          ],
        },
        fromBlock,
        toBlock: currentBlock,
      });

      // AllSubmissionsRejected (creator rejects all)
      const submissionsRejectedLogs = await publicClient.getLogs({
        address: addresses.taskManager,
        event: {
          type: 'event',
          name: 'AllSubmissionsRejected',
          inputs: [
            { name: 'taskId', type: 'uint256', indexed: true },
            { name: 'creator', type: 'address', indexed: true },
            { name: 'reason', type: 'string', indexed: false },
          ],
        },
        fromBlock,
        toBlock: currentBlock,
      });

      // TaskCompleted (bounty released to winner)
      const taskCompletedLogs = await publicClient.getLogs({
        address: addresses.taskManager,
        event: {
          type: 'event',
          name: 'TaskCompleted',
          inputs: [
            { name: 'taskId', type: 'uint256', indexed: true },
            { name: 'winner', type: 'address', indexed: true },
            { name: 'bountyAmount', type: 'uint256', indexed: false },
          ],
        },
        fromBlock,
        toBlock: currentBlock,
      });

      // TaskRefunded (bounty returned to creator)
      const taskRefundedLogs = await publicClient.getLogs({
        address: addresses.taskManager,
        event: {
          type: 'event',
          name: 'TaskRefunded',
          inputs: [
            { name: 'taskId', type: 'uint256', indexed: true },
            { name: 'creator', type: 'address', indexed: true },
            { name: 'refundAmount', type: 'uint256', indexed: false },
          ],
        },
        fromBlock,
        toBlock: currentBlock,
      });

      // TaskCancelled (creator cancels)
      const taskCancelledLogs = await publicClient.getLogs({
        address: addresses.taskManager,
        event: {
          type: 'event',
          name: 'TaskCancelled',
          inputs: [
            { name: 'taskId', type: 'uint256', indexed: true },
            { name: 'creator', type: 'address', indexed: true },
            { name: 'refundAmount', type: 'uint256', indexed: false },
          ],
        },
        fromBlock,
        toBlock: currentBlock,
      });

      // TaskDisputed (task enters dispute)
      const taskDisputedLogs = await publicClient.getLogs({
        address: addresses.taskManager,
        event: {
          type: 'event',
          name: 'TaskDisputed',
          inputs: [
            { name: 'taskId', type: 'uint256', indexed: true },
            { name: 'disputer', type: 'address', indexed: true },
            { name: 'disputeId', type: 'uint256', indexed: false },
          ],
        },
        fromBlock,
        toBlock: currentBlock,
      });

      // ============ ClawboyAgentAdapter Events (ERC-8004) ============

      // AgentRegistered (from ERC-8004 adapter)
      const agentRegisteredLogs = await publicClient.getLogs({
        address: addresses.agentAdapter,
        event: {
          type: 'event',
          name: 'AgentRegistered',
          inputs: [
            { name: 'wallet', type: 'address', indexed: true },
            { name: 'agentId', type: 'uint256', indexed: true },
            { name: 'agentURI', type: 'string', indexed: false },
          ],
        },
        fromBlock,
        toBlock: currentBlock,
      });

      // AgentProfileUpdated (from ERC-8004 adapter)
      const agentProfileUpdatedLogs = await publicClient.getLogs({
        address: addresses.agentAdapter,
        event: {
          type: 'event',
          name: 'AgentProfileUpdated',
          inputs: [
            { name: 'wallet', type: 'address', indexed: true },
            { name: 'agentId', type: 'uint256', indexed: true },
            { name: 'newURI', type: 'string', indexed: false },
          ],
        },
        fromBlock,
        toBlock: currentBlock,
      });

      // ============ DisputeResolver Events ============

      // DisputeCreated
      const disputeCreatedLogs = await publicClient.getLogs({
        address: addresses.disputeResolver,
        event: {
          type: 'event',
          name: 'DisputeCreated',
          inputs: [
            { name: 'disputeId', type: 'uint256', indexed: true },
            { name: 'taskId', type: 'uint256', indexed: true },
            { name: 'disputer', type: 'address', indexed: true },
            { name: 'stake', type: 'uint256', indexed: false },
            { name: 'votingDeadline', type: 'uint256', indexed: false },
          ],
        },
        fromBlock,
        toBlock: currentBlock,
      });

      // VoteSubmitted
      const voteSubmittedLogs = await publicClient.getLogs({
        address: addresses.disputeResolver,
        event: {
          type: 'event',
          name: 'VoteSubmitted',
          inputs: [
            { name: 'disputeId', type: 'uint256', indexed: true },
            { name: 'voter', type: 'address', indexed: true },
            { name: 'supportsDisputer', type: 'bool', indexed: false },
            { name: 'weight', type: 'uint256', indexed: false },
          ],
        },
        fromBlock,
        toBlock: currentBlock,
      });

      // DisputeResolved
      const disputeResolvedLogs = await publicClient.getLogs({
        address: addresses.disputeResolver,
        event: {
          type: 'event',
          name: 'DisputeResolved',
          inputs: [
            { name: 'disputeId', type: 'uint256', indexed: true },
            { name: 'taskId', type: 'uint256', indexed: true },
            { name: 'disputerWon', type: 'bool', indexed: false },
            { name: 'votesFor', type: 'uint256', indexed: false },
            { name: 'votesAgainst', type: 'uint256', indexed: false },
          ],
        },
        fromBlock,
        toBlock: currentBlock,
      });

      // Process all events
      const allEvents = [
        ...taskCreatedLogs.map((l) => parseEvent(l, 'TaskCreated')),
        ...workSubmittedLogs.map((l) => parseEvent(l, 'WorkSubmitted')),
        ...winnerSelectedLogs.map((l) => parseEvent(l, 'WinnerSelected')),
        ...submissionsRejectedLogs.map((l) => parseEvent(l, 'AllSubmissionsRejected')),
        ...taskCompletedLogs.map((l) => parseEvent(l, 'TaskCompleted')),
        ...taskRefundedLogs.map((l) => parseEvent(l, 'TaskRefunded')),
        ...taskCancelledLogs.map((l) => parseEvent(l, 'TaskCancelled')),
        ...taskDisputedLogs.map((l) => parseEvent(l, 'TaskDisputed')),
        ...agentRegisteredLogs.map((l) => parseEvent(l, 'AgentRegistered')),
        ...agentProfileUpdatedLogs.map((l) => parseEvent(l, 'AgentProfileUpdated')),
        ...disputeCreatedLogs.map((l) => parseEvent(l, 'DisputeCreated')),
        ...voteSubmittedLogs.map((l) => parseEvent(l, 'VoteSubmitted')),
        ...disputeResolvedLogs.map((l) => parseEvent(l, 'DisputeResolved')),
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
      completedInitialSync = true;

      // Persist checkpoint to database
      try {
        await updateSyncState(chainId, addresses.taskManager, currentBlock);
      } catch (error) {
        console.warn('Failed to save checkpoint:', error);
      }

      if (allEvents.length > 0) {
        console.log(`Processed ${allEvents.length} events up to block ${currentBlock}`);
      }
    } catch (error) {
      console.error('Error polling events:', error);
    }
  };

  let pollTimeout: Timer | null = null;

  return {
    async start() {
      running = true;
      console.log(`Starting event listener for chain ${chainId}`);

      // Load checkpoint from database
      try {
        const checkpoint = await getLastSyncedBlock(chainId, addresses.taskManager);
        if (checkpoint) {
          lastProcessedBlock = checkpoint;
          console.log(`Resuming from checkpoint: block ${lastProcessedBlock}`);
        } else {
          console.log('No checkpoint found, will start from current block');
        }
      } catch (error) {
        console.warn('Failed to load checkpoint, starting from current block:', error);
      }

      // Use recursive setTimeout instead of setInterval to ensure sequential execution
      // This prevents race conditions where overlapping pollEvents calls could cause
      // fromBlock > toBlock errors
      const poll = async () => {
        if (!running) return;
        await pollEvents();
        if (running) {
          pollTimeout = setTimeout(poll, pollingIntervalMs);
        }
      };

      await poll();
    },

    stop() {
      running = false;
      if (pollTimeout) {
        clearTimeout(pollTimeout);
        pollTimeout = null;
      }
      console.log('Event listener stopped');
    },

    onEvent(handler) {
      eventHandler = handler;
    },

    getLastProcessedBlock() {
      return lastProcessedBlock;
    },

    isRunning() {
      return running;
    },

    hasCompletedInitialSync() {
      return completedInitialSync;
    },
  };
}
