/**
 * VerificationHub contract ABI
 * Generated from Foundry build output
 */
export const VerificationHubABI = [
  // Events
  {
    type: 'event',
    name: 'VerificationRequested',
    inputs: [
      { name: 'taskId', type: 'uint256', indexed: true },
      { name: 'submissionCid', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'VerdictSubmitted',
    inputs: [
      { name: 'taskId', type: 'uint256', indexed: true },
      { name: 'verifier', type: 'address', indexed: true },
      { name: 'outcome', type: 'uint8', indexed: false },
      { name: 'score', type: 'uint8', indexed: false },
      { name: 'feedbackCid', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'DisputeRaised',
    inputs: [
      { name: 'taskId', type: 'uint256', indexed: true },
      { name: 'disputer', type: 'address', indexed: true },
      { name: 'reason', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'DisputeResolved',
    inputs: [
      { name: 'taskId', type: 'uint256', indexed: true },
      { name: 'outcome', type: 'uint8', indexed: false },
    ],
  },

  // Read functions
  {
    type: 'function',
    name: 'getVerdict',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'verifier', type: 'address' },
          { name: 'outcome', type: 'uint8' },
          { name: 'score', type: 'uint8' },
          { name: 'feedbackCid', type: 'string' },
          { name: 'timestamp', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isVerifier',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'pendingVerifications',
    inputs: [],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
  },

  // Write functions
  {
    type: 'function',
    name: 'submitVerdict',
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'outcome', type: 'uint8' },
      { name: 'score', type: 'uint8' },
      { name: 'feedbackCid', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'raiseDispute',
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'reason', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;
