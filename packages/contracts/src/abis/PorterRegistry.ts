/**
 * PorterRegistry contract ABI
 * Updated for competitive task system (no tiers, no staking)
 */
export const PorterRegistryABI = [
  // Events
  {
    type: 'event',
    name: 'AgentRegistered',
    inputs: [
      { name: 'agent', type: 'address', indexed: true },
      { name: 'profileCid', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AgentUpdated',
    inputs: [
      { name: 'agent', type: 'address', indexed: true },
      { name: 'profileCid', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ReputationUpdated',
    inputs: [
      { name: 'agent', type: 'address', indexed: true },
      { name: 'oldReputation', type: 'uint256', indexed: false },
      { name: 'newReputation', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AgentDeactivated',
    inputs: [{ name: 'agent', type: 'address', indexed: true }],
  },
  {
    type: 'event',
    name: 'AgentReactivated',
    inputs: [{ name: 'agent', type: 'address', indexed: true }],
  },

  // Read functions
  {
    type: 'function',
    name: 'getAgent',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'reputation', type: 'uint256' },
          { name: 'tasksWon', type: 'uint256' },
          { name: 'disputesWon', type: 'uint256' },
          { name: 'disputesLost', type: 'uint256' },
          { name: 'profileCid', type: 'string' },
          { name: 'registeredAt', type: 'uint256' },
          { name: 'isActive', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isRegistered',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getReputation',
    inputs: [{ name: 'agent', type: 'address' }],
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

  // Write functions
  {
    type: 'function',
    name: 'register',
    inputs: [{ name: 'profileCid', type: 'string' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'updateProfile',
    inputs: [{ name: 'profileCid', type: 'string' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'deactivate',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'reactivate',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // Authorized contract functions
  {
    type: 'function',
    name: 'addReputation',
    inputs: [
      { name: 'agent', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'removeReputation',
    inputs: [
      { name: 'agent', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'recordTaskWin',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'recordDisputeWin',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'recordDisputeLoss',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;
