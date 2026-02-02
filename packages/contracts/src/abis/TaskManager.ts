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
    ],
  },
  {
    type: 'event',
    name: 'SubmissionUpdated',
    inputs: [
      { name: 'taskId', type: 'uint256', indexed: true },
      { name: 'agent', type: 'address', indexed: true },
      { name: 'submissionCid', type: 'string', indexed: false },
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
    ],
  },
  {
    type: 'event',
    name: 'DisputeResolved',
    inputs: [
      { name: 'taskId', type: 'uint256', indexed: true },
      { name: 'disputerWon', type: 'bool', indexed: false },
    ],
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
      { name: 'agent', type: 'address' },
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
    name: 'getSubmissions',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
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
    name: 'hasSubmitted',
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'agent', type: 'address' },
    ],
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

  // Dispute resolver functions (called by DisputeResolver)
  {
    type: 'function',
    name: 'markDisputed',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'resolveDispute',
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'disputerWon', type: 'bool' },
      { name: 'disputer', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;
