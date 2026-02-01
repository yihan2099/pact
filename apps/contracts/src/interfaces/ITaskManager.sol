// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ITaskManager
 * @notice Interface for the TaskManager contract
 */
interface ITaskManager {
    enum TaskStatus {
        Open,
        Claimed,
        Submitted,
        UnderVerification,
        Completed,
        Disputed,
        Cancelled,
        Expired
    }

    struct Task {
        uint256 id;
        address creator;
        TaskStatus status;
        uint256 bountyAmount;
        address bountyToken;
        string specificationCid;
        address claimedBy;
        uint256 claimedAt;
        string submissionCid;
        uint256 createdAtBlock;
        uint256 deadline;
    }

    event TaskCreated(
        uint256 indexed taskId,
        address indexed creator,
        uint256 bountyAmount,
        address bountyToken,
        string specificationCid,
        uint256 deadline
    );

    event TaskClaimed(uint256 indexed taskId, address indexed agent, uint256 claimDeadline);

    event WorkSubmitted(uint256 indexed taskId, address indexed agent, string submissionCid);

    event TaskCompleted(uint256 indexed taskId, address indexed agent, uint256 bountyAmount);

    event TaskCancelled(uint256 indexed taskId, address indexed creator, uint256 refundAmount);

    event TaskDisputed(uint256 indexed taskId, address indexed disputer, string reason);

    function createTask(
        string calldata specificationCid,
        address bountyToken,
        uint256 bountyAmount,
        uint256 deadline
    ) external payable returns (uint256 taskId);

    function claimTask(uint256 taskId) external;

    function submitWork(uint256 taskId, string calldata submissionCid) external;

    function cancelTask(uint256 taskId) external;

    function completeTask(uint256 taskId) external;

    function getTask(uint256 taskId) external view returns (Task memory);

    function taskCount() external view returns (uint256);
}
