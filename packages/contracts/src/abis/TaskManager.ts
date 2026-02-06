/**
 * TaskManager contract ABI
 * Updated for competitive task system
 */
export const TaskManagerABI = [
  // Events
  {
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
  {
    type: 'event',
    name: 'WorkSubmitted',
    inputs: [
      { name: 'taskId', type: 'uint256', indexed: true },
      { name: 'agent', type: 'address', indexed: true },
      { name: 'submissionCid', type: 'string', indexed: false },
      { name: 'submissionIndex', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SubmissionUpdated',
    inputs: [
      { name: 'taskId', type: 'uint256', indexed: true },
      { name: 'agent', type: 'address', indexed: true },
      { name: 'newSubmissionCid', type: 'string', indexed: false },
      { name: 'submissionIndex', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'WinnerSelected',
    inputs: [
      { name: 'taskId', type: 'uint256', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'challengeDeadline', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AllSubmissionsRejected',
    inputs: [
      { name: 'taskId', type: 'uint256', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'reason', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'TaskCompleted',
    inputs: [
      { name: 'taskId', type: 'uint256', indexed: true },
      { name: 'winner', type: 'address', indexed: true },
      { name: 'bountyAmount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'TaskRefunded',
    inputs: [
      { name: 'taskId', type: 'uint256', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'refundAmount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'TaskCancelled',
    inputs: [
      { name: 'taskId', type: 'uint256', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'refundAmount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'TaskDisputed',
    inputs: [
      { name: 'taskId', type: 'uint256', indexed: true },
      { name: 'disputer', type: 'address', indexed: true },
      { name: 'disputeId', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'DisputeResolved',
    inputs: [
      { name: 'taskId', type: 'uint256', indexed: true },
      { name: 'disputeId', type: 'uint256', indexed: true },
      { name: 'disputerWon', type: 'bool', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'OwnershipTransferInitiated',
    inputs: [
      { name: 'currentOwner', type: 'address', indexed: true },
      { name: 'pendingOwner', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'OwnershipTransferred',
    inputs: [
      { name: 'previousOwner', type: 'address', indexed: true },
      { name: 'newOwner', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'TaskDisputeReverted',
    inputs: [
      { name: 'taskId', type: 'uint256', indexed: true },
      { name: 'newChallengeDeadline', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'EmergencyBypassUsed',
    inputs: [
      { name: 'caller', type: 'address', indexed: true },
      { name: 'selector', type: 'bytes4', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'ChallengeWindowUpdated',
    inputs: [
      { name: 'oldWindow', type: 'uint256', indexed: false },
      { name: 'newWindow', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SelectionDeadlineUpdated',
    inputs: [
      { name: 'oldDeadline', type: 'uint256', indexed: false },
      { name: 'newDeadline', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Paused',
    inputs: [{ name: 'account', type: 'address', indexed: false }],
  },
  {
    type: 'event',
    name: 'Unpaused',
    inputs: [{ name: 'account', type: 'address', indexed: false }],
  },

  // Read functions
  {
    type: 'function',
    name: 'getTask',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'creator', type: 'address' },
          { name: 'status', type: 'uint8' },
          { name: 'bountyAmount', type: 'uint256' },
          { name: 'bountyToken', type: 'address' },
          { name: 'specificationCid', type: 'string' },
          { name: 'createdAtBlock', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'selectedWinner', type: 'address' },
          { name: 'selectedAt', type: 'uint256' },
          { name: 'challengeDeadline', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'taskCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSubmission',
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'agent', type: 'address' },
          { name: 'submissionCid', type: 'string' },
          { name: 'submittedAt', type: 'uint256' },
          { name: 'updatedAt', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSubmissionCount',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAgentSubmissionIndex',
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'agent', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hasSubmitted',
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'agent', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getActiveDisputeId',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'escrowVault',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'agentAdapter',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'disputeResolver',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'pendingOwner',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'timelock',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'challengeWindow',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'selectionDeadline',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'paused',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },

  // Write functions
  {
    type: 'function',
    name: 'createTask',
    inputs: [
      { name: 'specificationCid', type: 'string' },
      { name: 'bountyToken', type: 'address' },
      { name: 'bountyAmount', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'taskId', type: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'submitWork',
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'submissionCid', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'updateSubmission',
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'submissionCid', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'selectWinner',
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'winner', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'rejectAll',
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'reason', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'finalizeTask',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'cancelTask',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'refundExpiredTask',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // Dispute resolver functions (called by DisputeResolver)
  {
    type: 'function',
    name: 'markDisputed',
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'disputeId', type: 'uint256' },
      { name: 'disputer', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'resolveDispute',
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'disputerWon', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revertDisputedTask',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // Admin / ownership functions
  {
    type: 'function',
    name: 'transferOwnership',
    inputs: [{ name: 'newOwner', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'acceptOwnership',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setDisputeResolver',
    inputs: [{ name: '_resolver', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setAgentAdapter',
    inputs: [{ name: '_adapter', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setTimelock',
    inputs: [{ name: '_timelock', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'emergencySetDisputeResolver',
    inputs: [{ name: '_resolver', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'emergencySetAgentAdapter',
    inputs: [{ name: '_adapter', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setChallengeWindow',
    inputs: [{ name: 'newWindow', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setSelectionDeadline',
    inputs: [{ name: 'newDeadline', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'pause',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unpause',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;
