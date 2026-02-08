/**
 * ClawboyAgentAdapter contract ABI
 * Bridges Clawboy's TaskManager and DisputeResolver to ERC-8004 registries
 */
export const ClawboyAgentAdapterABI = [
  // Events
  {
    type: 'event',
    name: 'AgentRegistered',
    inputs: [
      { name: 'wallet', type: 'address', indexed: true },
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'agentURI', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AgentProfileUpdated',
    inputs: [
      { name: 'wallet', type: 'address', indexed: true },
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'newURI', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'TaskWinRecorded',
    inputs: [
      { name: 'agent', type: 'address', indexed: true },
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'taskId', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'DisputeWinRecorded',
    inputs: [
      { name: 'agent', type: 'address', indexed: true },
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'disputeId', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'DisputeLossRecorded',
    inputs: [
      { name: 'agent', type: 'address', indexed: true },
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'disputeId', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'VoterReputationUpdated',
    inputs: [
      { name: 'voter', type: 'address', indexed: true },
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'delta', type: 'int256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'TimelockSet',
    inputs: [
      { name: 'newTimelock', type: 'address', indexed: true },
    ],
  },

  // Read functions
  {
    type: 'function',
    name: 'isRegistered',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAgentId',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getVoteWeight',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getReputationSummary',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [
      { name: 'taskWins', type: 'uint64' },
      { name: 'disputeWins', type: 'uint64' },
      { name: 'disputeLosses', type: 'uint64' },
      { name: 'totalReputation', type: 'int256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getIdentityRegistry',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getReputationRegistry',
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
    name: 'taskManager',
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

  // Write functions
  {
    type: 'function',
    name: 'register',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ name: 'agentId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'updateProfile',
    inputs: [{ name: 'newURI', type: 'string' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // Admin functions
  {
    type: 'function',
    name: 'setTaskManager',
    inputs: [{ name: '_taskManager', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setDisputeResolver',
    inputs: [{ name: '_disputeResolver', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // Authorized functions (called by TaskManager/DisputeResolver)
  {
    type: 'function',
    name: 'recordTaskWin',
    inputs: [
      { name: 'agent', type: 'address' },
      { name: 'taskId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'recordDisputeWin',
    inputs: [
      { name: 'agent', type: 'address' },
      { name: 'disputeId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'recordDisputeLoss',
    inputs: [
      { name: 'agent', type: 'address' },
      { name: 'disputeId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'updateVoterReputation',
    inputs: [
      { name: 'voter', type: 'address' },
      { name: 'delta', type: 'int256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // Errors
  { type: 'error', name: 'OnlyOwner', inputs: [] },
  { type: 'error', name: 'Unauthorized', inputs: [] },
  { type: 'error', name: 'NotRegistered', inputs: [] },
  { type: 'error', name: 'AlreadyRegistered', inputs: [] },
] as const;
