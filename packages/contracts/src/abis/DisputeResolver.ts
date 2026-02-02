/**
 * DisputeResolver contract ABI
 * Handles disputes for the competitive task system
 */
export const DisputeResolverABI = [
  // Events
  {
    type: 'event',
    name: 'DisputeStarted',
    inputs: [
      { name: 'disputeId', type: 'uint256', indexed: true },
      { name: 'taskId', type: 'uint256', indexed: true },
      { name: 'disputer', type: 'address', indexed: true },
      { name: 'stake', type: 'uint256', indexed: false },
      { name: 'votingDeadline', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'VoteSubmitted',
    inputs: [
      { name: 'disputeId', type: 'uint256', indexed: true },
      { name: 'voter', type: 'address', indexed: true },
      { name: 'supportsDisputer', type: 'bool', indexed: false },
      { name: 'weight', type: 'uint256', indexed: false },
    ],
  },
  {
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

  // Read functions
  {
    type: 'function',
    name: 'getDispute',
    inputs: [{ name: 'disputeId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'taskId', type: 'uint256' },
          { name: 'disputer', type: 'address' },
          { name: 'disputeStake', type: 'uint256' },
          { name: 'votingDeadline', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'disputerWon', type: 'bool' },
          { name: 'votesForDisputer', type: 'uint256' },
          { name: 'votesAgainstDisputer', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getDisputeByTask',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hasVoted',
    inputs: [
      { name: 'disputeId', type: 'uint256' },
      { name: 'voter', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getVote',
    inputs: [
      { name: 'disputeId', type: 'uint256' },
      { name: 'voter', type: 'address' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'voter', type: 'address' },
          { name: 'supportsDisputer', type: 'bool' },
          { name: 'weight', type: 'uint256' },
          { name: 'timestamp', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'disputeCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'calculateRequiredStake',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MIN_DISPUTE_STAKE',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'VOTING_PERIOD',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'WIN_THRESHOLD_PERCENTAGE',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },

  // Write functions
  {
    type: 'function',
    name: 'startDispute',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [{ name: 'disputeId', type: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'submitVote',
    inputs: [
      { name: 'disputeId', type: 'uint256' },
      { name: 'supportsDisputer', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'resolveDispute',
    inputs: [{ name: 'disputeId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;
