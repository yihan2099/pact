/**
 * DisputeResolver contract ABI
 * Handles disputes for the competitive task system
 */
export const DisputeResolverABI = [
  // Events
  {
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
  {
    type: 'event',
    name: 'DisputeStakeReturned',
    inputs: [
      { name: 'disputeId', type: 'uint256', indexed: true },
      { name: 'disputer', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'DisputeStakeSlashed',
    inputs: [
      { name: 'disputeId', type: 'uint256', indexed: true },
      { name: 'disputer', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'DisputeCancelled',
    inputs: [
      { name: 'disputeId', type: 'uint256', indexed: true },
      { name: 'taskId', type: 'uint256', indexed: true },
      { name: 'cancelledBy', type: 'address', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'StakeSlashed',
    inputs: [
      { name: 'disputeId', type: 'uint256', indexed: true },
      { name: 'disputer', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'StakesWithdrawn',
    inputs: [
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'VoterReputationBatchProcessed',
    inputs: [
      { name: 'disputeId', type: 'uint256', indexed: true },
      { name: 'processed', type: 'uint256', indexed: false },
      { name: 'remaining', type: 'uint256', indexed: false },
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
    name: 'EmergencyBypassUsed',
    inputs: [
      { name: 'caller', type: 'address', indexed: true },
      { name: 'selector', type: 'bytes4', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'VotingPeriodUpdated',
    inputs: [
      { name: 'oldPeriod', type: 'uint256', indexed: false },
      { name: 'newPeriod', type: 'uint256', indexed: false },
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
    name: 'getVoters',
    inputs: [{ name: 'disputeId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address[]' }],
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
    name: 'calculateDisputeStake',
    inputs: [{ name: 'bountyAmount', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'pendingVoterRepUpdates',
    inputs: [{ name: 'disputeId', type: 'uint256' }],
    outputs: [{ name: 'remaining', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'availableSlashedStakes',
    inputs: [],
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
    name: 'DISPUTE_STAKE_PERCENT',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'votingPeriod',
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
  {
    type: 'function',
    name: 'MAJORITY_THRESHOLD',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MAX_VOTERS_PER_DISPUTE',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'VOTER_REP_BATCH_SIZE',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
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
    name: 'agentAdapter',
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
    name: 'totalSlashedStakes',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalWithdrawnStakes',
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
  {
    type: 'function',
    name: 'processVoterReputationBatch',
    inputs: [{ name: 'disputeId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'cancelDispute',
    inputs: [{ name: 'disputeId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'emergencyCancelDispute',
    inputs: [{ name: 'disputeId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdrawSlashedStakes',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'emergencyWithdrawSlashedStakes',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
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
    name: 'setTimelock',
    inputs: [{ name: '_timelock', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setVotingPeriod',
    inputs: [{ name: 'newPeriod', type: 'uint256' }],
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
