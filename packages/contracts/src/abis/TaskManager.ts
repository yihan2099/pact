/**
 * TaskManager contract ABI
 * Generated from Foundry build output
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
    name: 'TaskClaimed',
    inputs: [
      { name: 'taskId', type: 'uint256', indexed: true },
      { name: 'agent', type: 'address', indexed: true },
      { name: 'claimDeadline', type: 'uint256', indexed: false },
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
    name: 'TaskCompleted',
    inputs: [
      { name: 'taskId', type: 'uint256', indexed: true },
      { name: 'agent', type: 'address', indexed: true },
      { name: 'bountyAmount', type: 'uint256', indexed: false },
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
      { name: 'reason', type: 'string', indexed: false },
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
          { name: 'claimedBy', type: 'address' },
          { name: 'claimedAt', type: 'uint256' },
          { name: 'submissionCid', type: 'string' },
          { name: 'createdAtBlock', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
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
    name: 'claimTask',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
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
    name: 'cancelTask',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;
