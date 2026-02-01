/**
 * PorterRegistry contract ABI
 * Generated from Foundry build output
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
    name: 'TierUpdated',
    inputs: [
      { name: 'agent', type: 'address', indexed: true },
      { name: 'oldTier', type: 'uint8', indexed: false },
      { name: 'newTier', type: 'uint8', indexed: false },
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
    name: 'Staked',
    inputs: [
      { name: 'agent', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Unstaked',
    inputs: [
      { name: 'agent', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
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
          { name: 'tier', type: 'uint8' },
          { name: 'reputation', type: 'uint256' },
          { name: 'tasksCompleted', type: 'uint256' },
          { name: 'tasksFailed', type: 'uint256' },
          { name: 'stakedAmount', type: 'uint256' },
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
    name: 'getStake',
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
    name: 'stake',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'unstake',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;
