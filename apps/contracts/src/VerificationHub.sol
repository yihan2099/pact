// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IVerificationHub} from "./interfaces/IVerificationHub.sol";
import {ITaskManager} from "./interfaces/ITaskManager.sol";
import {IPorterRegistry} from "./interfaces/IPorterRegistry.sol";

/**
 * @title VerificationHub
 * @notice Handles verification of submitted work
 */
contract VerificationHub is IVerificationHub {
    // State
    mapping(uint256 => Verdict) private _verdicts;
    uint256[] private _pendingTaskIds;
    mapping(uint256 => uint256) private _pendingIndex; // taskId => index in array

    // External contracts
    ITaskManager public immutable taskManager;
    IPorterRegistry public immutable porterRegistry;

    // Errors
    error NotVerifier();
    error TaskNotPendingVerification();
    error VerdictAlreadySubmitted();
    error InvalidScore();
    error NotAllowedToDispute();
    error OnlyTaskManager();
    error TaskAlreadyPending();

    modifier onlyTaskManager() {
        if (msg.sender != address(taskManager)) revert OnlyTaskManager();
        _;
    }

    constructor(address _taskManager, address _porterRegistry) {
        taskManager = ITaskManager(_taskManager);
        porterRegistry = IPorterRegistry(_porterRegistry);
    }

    /**
     * @notice Check if an account is a verifier (Elite tier)
     * @param account The account to check
     * @return True if the account is a verifier
     */
    function isVerifier(address account) public view returns (bool) {
        IPorterRegistry.Agent memory agent = porterRegistry.getAgent(account);
        return agent.tier == IPorterRegistry.AgentTier.Elite && agent.isActive;
    }

    /**
     * @notice Submit a verification verdict
     * @param taskId The task ID
     * @param outcome The verdict outcome
     * @param score The quality score (0-100)
     * @param feedbackCid IPFS CID of detailed feedback
     */
    function submitVerdict(
        uint256 taskId,
        VerdictOutcome outcome,
        uint8 score,
        string calldata feedbackCid
    ) external {
        if (!isVerifier(msg.sender)) revert NotVerifier();
        if (score > 100) revert InvalidScore();

        ITaskManager.Task memory task = taskManager.getTask(taskId);
        if (task.status != ITaskManager.TaskStatus.Submitted) {
            revert TaskNotPendingVerification();
        }

        if (_verdicts[taskId].timestamp != 0) revert VerdictAlreadySubmitted();

        _verdicts[taskId] = Verdict({
            verifier: msg.sender,
            outcome: outcome,
            score: score,
            feedbackCid: feedbackCid,
            timestamp: block.timestamp
        });

        // Remove from pending list
        _removePending(taskId);

        emit VerdictSubmitted(taskId, msg.sender, outcome, score, feedbackCid);

        // Handle different outcomes
        if (outcome == VerdictOutcome.Approved) {
            taskManager.completeTask(taskId);
        } else if (outcome == VerdictOutcome.Rejected) {
            taskManager.failTask(taskId);
        } else if (outcome == VerdictOutcome.RevisionRequested) {
            taskManager.reopenForRevision(taskId);
        }
        // Escalated: handled by dispute resolution (future)
    }

    /**
     * @notice Raise a dispute on a verdict
     * @param taskId The task ID
     * @param reason The reason for the dispute
     */
    function raiseDispute(uint256 taskId, string calldata reason) external {
        ITaskManager.Task memory task = taskManager.getTask(taskId);

        // Only creator or agent can dispute
        if (msg.sender != task.creator && msg.sender != task.claimedBy) {
            revert NotAllowedToDispute();
        }

        emit DisputeRaised(taskId, msg.sender, reason);
    }

    /**
     * @notice Get the verdict for a task
     * @param taskId The task ID
     * @return The verdict
     */
    function getVerdict(uint256 taskId) external view returns (Verdict memory) {
        return _verdicts[taskId];
    }

    /**
     * @notice Get all pending verification task IDs
     * @return Array of task IDs
     */
    function pendingVerifications() external view returns (uint256[] memory) {
        return _pendingTaskIds;
    }

    /**
     * @notice Add a task to the pending list (called when work is submitted)
     * @param taskId The task ID
     */
    function addPending(uint256 taskId) external onlyTaskManager {
        // Check if task is already in pending list
        if (_pendingTaskIds.length > 0) {
            uint256 index = _pendingIndex[taskId];
            if (index < _pendingTaskIds.length && _pendingTaskIds[index] == taskId) {
                revert TaskAlreadyPending();
            }
        }

        _pendingIndex[taskId] = _pendingTaskIds.length;
        _pendingTaskIds.push(taskId);

        ITaskManager.Task memory task = taskManager.getTask(taskId);
        emit VerificationRequested(taskId, task.submissionCid);
    }

    /**
     * @dev Remove a task from the pending list
     */
    function _removePending(uint256 taskId) private {
        // If array is empty or task not in pending list, nothing to remove
        if (_pendingTaskIds.length == 0) return;

        uint256 index = _pendingIndex[taskId];
        uint256 lastIndex = _pendingTaskIds.length - 1;

        // Verify the task is actually at this index (handles case where task was never added)
        if (index > lastIndex || _pendingTaskIds[index] != taskId) return;

        if (index != lastIndex) {
            uint256 lastTaskId = _pendingTaskIds[lastIndex];
            _pendingTaskIds[index] = lastTaskId;
            _pendingIndex[lastTaskId] = index;
        }

        _pendingTaskIds.pop();
        delete _pendingIndex[taskId];
    }
}
