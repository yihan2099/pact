/**
 * Contract enums matching Solidity definitions
 */

export enum ContractTaskStatus {
  Open = 0,
  Claimed = 1,
  Submitted = 2,
  UnderVerification = 3,
  Completed = 4,
  Disputed = 5,
  Cancelled = 6,
  Expired = 7,
}

export enum ContractAgentTier {
  Newcomer = 0,
  Established = 1,
  Verified = 2,
  Elite = 3,
}

export enum ContractVerdictOutcome {
  Approved = 0,
  Rejected = 1,
  RevisionRequested = 2,
  Escalated = 3,
}
