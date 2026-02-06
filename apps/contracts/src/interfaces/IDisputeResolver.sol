// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/**
 * @title IDisputeResolver
 * @notice Interface for the DisputeResolver contract
 * @dev Handles disputes when agents disagree with creator's selection/rejection
 */
interface IDisputeResolver {
    enum DisputeStatus {
        Active, // Accepting votes
        Resolved, // Voting complete, outcome determined
        Cancelled // Dispute cancelled (e.g., task state changed)
    }

    struct Dispute {
        uint256 id;
        uint256 taskId;
        address disputer; // Agent who raised the dispute
        uint256 disputeStake; // ETH staked by disputer
        uint256 votingDeadline; // When voting ends
        DisputeStatus status;
        bool disputerWon; // True if dispute resolved in disputer's favor
        uint256 votesForDisputer; // Weighted votes supporting disputer
        uint256 votesAgainstDisputer; // Weighted votes against disputer
    }

    struct Vote {
        address voter;
        bool supportsDisputer;
        uint256 weight;
        uint256 timestamp;
    }

    // Events
    event DisputeCreated(
        uint256 indexed disputeId,
        uint256 indexed taskId,
        address indexed disputer,
        uint256 stake,
        uint256 votingDeadline
    );

    event VoteSubmitted(
        uint256 indexed disputeId, address indexed voter, bool supportsDisputer, uint256 weight
    );

    event DisputeResolved(
        uint256 indexed disputeId,
        uint256 indexed taskId,
        bool disputerWon,
        uint256 votesFor,
        uint256 votesAgainst
    );

    event DisputeStakeReturned(uint256 indexed disputeId, address indexed disputer, uint256 amount);

    event DisputeStakeSlashed(uint256 indexed disputeId, address indexed disputer, uint256 amount);

    // Core functions
    function startDispute(uint256 taskId) external payable returns (uint256 disputeId);

    function submitVote(uint256 disputeId, bool supportsDisputer) external;

    function resolveDispute(uint256 disputeId) external;

    // View functions
    function getDispute(uint256 disputeId) external view returns (Dispute memory);

    function getVote(uint256 disputeId, address voter) external view returns (Vote memory);

    function hasVoted(uint256 disputeId, address voter) external view returns (bool);

    function getDisputeByTask(uint256 taskId) external view returns (uint256 disputeId);

    function calculateDisputeStake(uint256 bountyAmount) external pure returns (uint256);

    function disputeCount() external view returns (uint256);

    // Constants
    function MIN_DISPUTE_STAKE() external view returns (uint256);

    function DISPUTE_STAKE_PERCENT() external view returns (uint256);

    function MAJORITY_THRESHOLD() external view returns (uint256);

    // Configurable time constant
    function votingPeriod() external view returns (uint256);

    function setVotingPeriod(uint256 newPeriod) external;

    // Timelock management
    function setTimelock(address _timelock) external;

    function emergencyCancelDispute(uint256 disputeId) external;

    function emergencyWithdrawSlashedStakes(address recipient, uint256 amount) external;
}
