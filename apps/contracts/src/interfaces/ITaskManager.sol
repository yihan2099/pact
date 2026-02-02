// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/**
 * @title ITaskManager
 * @notice Interface for the TaskManager contract with competitive submission model
 * @dev Implements optimistic verification where creator selects winner, disputes go to community vote
 */
interface ITaskManager {
    enum TaskStatus {
        Open,           // Accepting submissions
        InReview,       // Creator reviewing submissions (48h before selection final)
        Completed,      // Winner selected, bounty released
        Disputed,       // Under community vote
        Refunded,       // No winner, bounty returned to creator
        Cancelled       // Creator cancelled before any submissions
    }

    struct Submission {
        address agent;
        string submissionCid;
        uint256 submittedAt;
        uint256 updatedAt;
    }

    struct Task {
        uint256 id;
        address creator;
        TaskStatus status;
        uint256 bountyAmount;
        address bountyToken;
        string specificationCid;
        uint256 createdAtBlock;
        uint256 deadline;           // Task deadline for submissions
        address selectedWinner;     // Winner selected by creator
        uint256 selectedAt;         // When winner was selected
        uint256 challengeDeadline;  // When challenge window ends (selectedAt + 48h)
    }

    // Task lifecycle events
    event TaskCreated(
        uint256 indexed taskId,
        address indexed creator,
        uint256 bountyAmount,
        address bountyToken,
        string specificationCid,
        uint256 deadline
    );

    event TaskCancelled(uint256 indexed taskId, address indexed creator, uint256 refundAmount);

    event TaskCompleted(uint256 indexed taskId, address indexed winner, uint256 bountyAmount);

    event TaskRefunded(uint256 indexed taskId, address indexed creator, uint256 refundAmount);

    // Submission events
    event WorkSubmitted(
        uint256 indexed taskId,
        address indexed agent,
        string submissionCid,
        uint256 submissionIndex
    );

    event SubmissionUpdated(
        uint256 indexed taskId,
        address indexed agent,
        string newSubmissionCid,
        uint256 submissionIndex
    );

    // Selection events
    event WinnerSelected(
        uint256 indexed taskId,
        address indexed winner,
        uint256 challengeDeadline
    );

    event AllSubmissionsRejected(
        uint256 indexed taskId,
        address indexed creator,
        string reason
    );

    // Dispute events
    event TaskDisputed(
        uint256 indexed taskId,
        address indexed disputer,
        uint256 disputeId
    );

    event DisputeResolved(
        uint256 indexed taskId,
        uint256 indexed disputeId,
        bool disputerWon
    );

    // Core functions
    function createTask(
        string calldata specificationCid,
        address bountyToken,
        uint256 bountyAmount,
        uint256 deadline
    ) external payable returns (uint256 taskId);

    function cancelTask(uint256 taskId) external;

    // Submission functions
    function submitWork(uint256 taskId, string calldata submissionCid) external;

    function updateSubmission(uint256 taskId, string calldata submissionCid) external;

    // Creator selection functions
    function selectWinner(uint256 taskId, address winner) external;

    function rejectAll(uint256 taskId, string calldata reason) external;

    // Finalization
    function finalizeTask(uint256 taskId) external;

    // Dispute integration
    function markDisputed(uint256 taskId, uint256 disputeId, address disputer) external;

    function resolveDispute(uint256 taskId, bool disputerWon) external;

    // View functions
    function getTask(uint256 taskId) external view returns (Task memory);

    function getSubmission(uint256 taskId, uint256 index) external view returns (Submission memory);

    function getSubmissionCount(uint256 taskId) external view returns (uint256);

    function getAgentSubmissionIndex(uint256 taskId, address agent) external view returns (uint256);

    function hasSubmitted(uint256 taskId, address agent) external view returns (bool);

    function taskCount() external view returns (uint256);
}
