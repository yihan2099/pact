// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import { ITaskManager } from "./interfaces/ITaskManager.sol";
import { IEscrowVault } from "./interfaces/IEscrowVault.sol";
import { IClawboyAgentAdapter } from "./IClawboyAgentAdapter.sol";
import { IDisputeResolver } from "./interfaces/IDisputeResolver.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title TaskManager
 * @notice Manages competitive task creation, submissions, and winner selection
 * @dev Implements optimistic verification - creator selects winner, disputes go to community vote
 */
contract TaskManager is ITaskManager, Pausable {
    // State
    uint256 private _taskCounter;
    mapping(uint256 => Task) private _tasks;
    mapping(uint256 => Submission[]) private _submissions;
    mapping(uint256 => mapping(address => uint256)) private _agentSubmissionIndex; // taskId => agent => index+1 (0 means no submission)
    mapping(uint256 => uint256) private _activeDisputeId; // taskId => disputeId

    // External contracts
    IEscrowVault public immutable escrowVault;
    IClawboyAgentAdapter public agentAdapter;
    IDisputeResolver public disputeResolver;

    // Access control
    address public owner;
    address public pendingOwner;
    address public timelock;

    // Configuration (configurable time constants with bounded setters)
    uint256 public challengeWindow = 48 hours;
    uint256 public selectionDeadline = 7 days; // Creator has 7 days after task deadline to select

    // Bounds for configurable time constants
    uint256 public constant MIN_CHALLENGE_WINDOW = 24 hours;
    uint256 public constant MAX_CHALLENGE_WINDOW = 7 days;
    uint256 public constant MIN_SELECTION_DEADLINE = 3 days;
    uint256 public constant MAX_SELECTION_DEADLINE = 30 days;

    // Errors
    error TaskNotFound();
    error NotTaskCreator();
    error TaskNotOpen();
    error TaskNotInReview();
    error AgentNotRegistered();
    error InsufficientBounty();
    error InvalidDeadline();
    error OnlyOwner();
    error OnlyDisputeResolver();
    error DeadlinePassed();
    error DeadlineNotPassed();
    error ChallengeWindowNotPassed();
    error ChallengeWindowPassed();
    error NoSubmissions();
    error HasSubmissions();
    error AlreadySubmitted();
    error NotSubmitted();
    error WinnerNotSubmitter();
    error TaskAlreadyDisputed();
    error NotInReviewOrDisputed();
    error DisputeResolverNotSet();
    error ZeroAddress();
    error NotPendingOwner();
    error TaskNotDisputed();
    error OnlyTimelock();
    error ValueOutOfBounds();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyTimelock() {
        if (msg.sender != timelock) revert OnlyTimelock();
        _;
    }

    modifier onlyDisputeResolver() {
        if (msg.sender != address(disputeResolver)) revert OnlyDisputeResolver();
        _;
    }

    constructor(address _escrowVault, address _agentAdapter) {
        escrowVault = IEscrowVault(_escrowVault);
        agentAdapter = IClawboyAgentAdapter(_agentAdapter);
        owner = msg.sender;
    }

    // Ownership events
    event OwnershipTransferInitiated(address indexed currentOwner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // Dispute reversion event
    event TaskDisputeReverted(uint256 indexed taskId, uint256 newChallengeDeadline);

    // Emergency bypass event
    event EmergencyBypassUsed(address indexed caller, bytes4 indexed selector);

    // Time configuration events
    event ChallengeWindowUpdated(uint256 oldWindow, uint256 newWindow);
    event SelectionDeadlineUpdated(uint256 oldDeadline, uint256 newDeadline);

    /**
     * @notice Initiate ownership transfer (two-step process)
     * @param newOwner The address to transfer ownership to
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferInitiated(owner, newOwner);
    }

    /**
     * @notice Accept ownership transfer (must be called by pending owner)
     */
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    /**
     * @notice Set the DisputeResolver address (requires timelock)
     * @param _resolver The DisputeResolver address
     */
    function setDisputeResolver(address _resolver) external onlyTimelock {
        if (_resolver == address(0)) revert ZeroAddress();
        disputeResolver = IDisputeResolver(_resolver);
    }

    /**
     * @notice Set the AgentAdapter address (requires timelock)
     * @param _adapter The AgentAdapter address
     */
    function setAgentAdapter(address _adapter) external onlyTimelock {
        if (_adapter == address(0)) revert ZeroAddress();
        agentAdapter = IClawboyAgentAdapter(_adapter);
    }

    /**
     * @notice Set the timelock address (callable by owner, one-time setup)
     * @param _timelock The TimelockController address
     */
    function setTimelock(address _timelock) external onlyOwner {
        if (_timelock == address(0)) revert ZeroAddress();
        timelock = _timelock;
    }

    /**
     * @notice Emergency bypass for setDisputeResolver (owner only, emits event for monitoring)
     * @param _resolver The DisputeResolver address
     */
    function emergencySetDisputeResolver(address _resolver) external onlyOwner {
        if (_resolver == address(0)) revert ZeroAddress();
        disputeResolver = IDisputeResolver(_resolver);
        emit EmergencyBypassUsed(msg.sender, this.setDisputeResolver.selector);
    }

    /**
     * @notice Emergency bypass for setAgentAdapter (owner only, emits event for monitoring)
     * @param _adapter The AgentAdapter address
     */
    function emergencySetAgentAdapter(address _adapter) external onlyOwner {
        if (_adapter == address(0)) revert ZeroAddress();
        agentAdapter = IClawboyAgentAdapter(_adapter);
        emit EmergencyBypassUsed(msg.sender, this.setAgentAdapter.selector);
    }

    /**
     * @notice Set the challenge window duration
     * @param newWindow The new challenge window in seconds (min 24h, max 7 days)
     */
    function setChallengeWindow(uint256 newWindow) external onlyOwner {
        if (newWindow < MIN_CHALLENGE_WINDOW || newWindow > MAX_CHALLENGE_WINDOW) {
            revert ValueOutOfBounds();
        }
        uint256 oldWindow = challengeWindow;
        challengeWindow = newWindow;
        emit ChallengeWindowUpdated(oldWindow, newWindow);
    }

    /**
     * @notice Set the selection deadline duration
     * @param newDeadline The new selection deadline in seconds (min 3 days, max 30 days)
     */
    function setSelectionDeadline(uint256 newDeadline) external onlyOwner {
        if (newDeadline < MIN_SELECTION_DEADLINE || newDeadline > MAX_SELECTION_DEADLINE) {
            revert ValueOutOfBounds();
        }
        uint256 oldDeadline = selectionDeadline;
        selectionDeadline = newDeadline;
        emit SelectionDeadlineUpdated(oldDeadline, newDeadline);
    }

    /**
     * @notice Pause the contract (emergency stop)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Create a new task with a bounty
     * @param specificationCid IPFS CID of the task specification
     * @param bountyToken Token address for bounty (address(0) for ETH)
     * @param bountyAmount Amount of bounty
     * @param deadline Task deadline for submissions (0 for no deadline)
     * @return taskId The ID of the created task
     */
    function createTask(
        string calldata specificationCid,
        address bountyToken,
        uint256 bountyAmount,
        uint256 deadline
    )
        external
        payable
        whenNotPaused
        returns (uint256 taskId)
    {
        if (bountyAmount == 0) revert InsufficientBounty();
        if (deadline != 0 && deadline <= block.timestamp) revert InvalidDeadline();

        // For ETH payments, verify msg.value
        if (bountyToken == address(0)) {
            if (msg.value != bountyAmount) revert InsufficientBounty();
        }

        taskId = ++_taskCounter;

        _tasks[taskId] = Task({
            id: taskId,
            creator: msg.sender,
            status: TaskStatus.Open,
            bountyAmount: bountyAmount,
            bountyToken: bountyToken,
            specificationCid: specificationCid,
            createdAtBlock: block.number,
            deadline: deadline,
            selectedWinner: address(0),
            selectedAt: 0,
            challengeDeadline: 0
        });

        // Deposit bounty to escrow
        if (bountyToken == address(0)) {
            // ETH deposit
            escrowVault.deposit{ value: msg.value }(taskId, bountyToken, bountyAmount);
        } else {
            // ERC20 deposit - creator must have approved EscrowVault to spend tokens
            escrowVault.depositFrom(taskId, bountyToken, bountyAmount, msg.sender);
        }

        emit TaskCreated(taskId, msg.sender, bountyAmount, bountyToken, specificationCid, deadline);
    }

    /**
     * @notice Submit work for a task (competitive - multiple agents can submit)
     * @param taskId The task ID
     * @param submissionCid IPFS CID of the work submission
     */
    function submitWork(uint256 taskId, string calldata submissionCid) external whenNotPaused {
        Task storage task = _tasks[taskId];
        if (task.id == 0) revert TaskNotFound();
        if (task.status != TaskStatus.Open) revert TaskNotOpen();
        if (!agentAdapter.isRegistered(msg.sender)) revert AgentNotRegistered();
        if (task.deadline != 0 && block.timestamp > task.deadline) revert DeadlinePassed();
        if (_agentSubmissionIndex[taskId][msg.sender] != 0) revert AlreadySubmitted();

        uint256 submissionIndex = _submissions[taskId].length;
        _submissions[taskId].push(
            Submission({
                agent: msg.sender,
                submissionCid: submissionCid,
                submittedAt: block.timestamp,
                updatedAt: block.timestamp
            })
        );
        _agentSubmissionIndex[taskId][msg.sender] = submissionIndex + 1; // +1 to distinguish from "not submitted"

        emit WorkSubmitted(taskId, msg.sender, submissionCid, submissionIndex);
    }

    /**
     * @notice Update an existing submission
     * @param taskId The task ID
     * @param submissionCid New IPFS CID of the work submission
     */
    function updateSubmission(uint256 taskId, string calldata submissionCid) external {
        Task storage task = _tasks[taskId];
        if (task.id == 0) revert TaskNotFound();
        if (task.status != TaskStatus.Open) revert TaskNotOpen();
        if (task.deadline != 0 && block.timestamp > task.deadline) revert DeadlinePassed();

        uint256 indexPlusOne = _agentSubmissionIndex[taskId][msg.sender];
        if (indexPlusOne == 0) revert NotSubmitted();

        uint256 index = indexPlusOne - 1;
        _submissions[taskId][index].submissionCid = submissionCid;
        _submissions[taskId][index].updatedAt = block.timestamp;

        emit SubmissionUpdated(taskId, msg.sender, submissionCid, index);
    }

    /**
     * @notice Cancel a task (only creator, only if no submissions)
     * @param taskId The task ID to cancel
     */
    function cancelTask(uint256 taskId) external {
        Task storage task = _tasks[taskId];
        if (task.id == 0) revert TaskNotFound();
        if (task.creator != msg.sender) revert NotTaskCreator();
        if (task.status != TaskStatus.Open) revert TaskNotOpen();
        if (_submissions[taskId].length > 0) revert HasSubmissions();

        task.status = TaskStatus.Cancelled;

        // Refund bounty
        escrowVault.refund(taskId, msg.sender);

        emit TaskCancelled(taskId, msg.sender, task.bountyAmount);
    }

    /**
     * @notice Select a winner from submissions (creator only)
     * @param taskId The task ID
     * @param winner The address of the winning agent
     */
    function selectWinner(uint256 taskId, address winner) external whenNotPaused {
        Task storage task = _tasks[taskId];
        if (task.id == 0) revert TaskNotFound();
        if (task.creator != msg.sender) revert NotTaskCreator();
        if (task.status != TaskStatus.Open) revert TaskNotOpen();
        if (_submissions[taskId].length == 0) revert NoSubmissions();

        // Verify winner has submitted
        if (_agentSubmissionIndex[taskId][winner] == 0) revert WinnerNotSubmitter();

        task.status = TaskStatus.InReview;
        task.selectedWinner = winner;
        task.selectedAt = block.timestamp;
        task.challengeDeadline = block.timestamp + challengeWindow;

        emit WinnerSelected(taskId, winner, task.challengeDeadline);
    }

    /**
     * @notice Reject all submissions and refund bounty (creator only)
     * @param taskId The task ID
     * @param reason Reason for rejection
     */
    function rejectAll(uint256 taskId, string calldata reason) external whenNotPaused {
        Task storage task = _tasks[taskId];
        if (task.id == 0) revert TaskNotFound();
        if (task.creator != msg.sender) revert NotTaskCreator();
        if (task.status != TaskStatus.Open) revert TaskNotOpen();
        if (_submissions[taskId].length == 0) revert NoSubmissions();

        task.status = TaskStatus.InReview;
        task.selectedWinner = address(0); // No winner = rejection
        task.selectedAt = block.timestamp;
        task.challengeDeadline = block.timestamp + challengeWindow;

        emit AllSubmissionsRejected(taskId, msg.sender, reason);
    }

    /**
     * @notice Finalize task after challenge window (releases bounty)
     * @param taskId The task ID
     */
    function finalizeTask(uint256 taskId) external whenNotPaused {
        Task storage task = _tasks[taskId];
        if (task.id == 0) revert TaskNotFound();
        if (task.status != TaskStatus.InReview) revert TaskNotInReview();
        if (block.timestamp < task.challengeDeadline) revert ChallengeWindowNotPassed();

        if (task.selectedWinner != address(0)) {
            // Winner selected - complete task
            task.status = TaskStatus.Completed;

            // Release bounty to winner
            escrowVault.release(taskId, task.selectedWinner);

            // Record task win in ERC-8004 reputation registry
            agentAdapter.recordTaskWin(task.selectedWinner, taskId);

            emit TaskCompleted(taskId, task.selectedWinner, task.bountyAmount);
        } else {
            // All rejected - refund creator
            task.status = TaskStatus.Refunded;

            escrowVault.refund(taskId, task.creator);

            emit TaskRefunded(taskId, task.creator, task.bountyAmount);
        }
    }

    /**
     * @notice Auto-refund if creator doesn't select within deadline + SELECTION_DEADLINE
     * @dev Only works for tasks with deadlines. Tasks without deadlines must be cancelled manually.
     * @param taskId The task ID
     */
    function refundExpiredTask(uint256 taskId) external {
        Task storage task = _tasks[taskId];
        if (task.id == 0) revert TaskNotFound();
        if (task.status != TaskStatus.Open) revert TaskNotOpen();

        // Tasks without deadlines cannot auto-expire - creator must cancel manually
        if (task.deadline == 0) revert InvalidDeadline();

        // Selection deadline is task deadline + selectionDeadline
        uint256 taskSelectionDeadline = task.deadline + selectionDeadline;

        if (block.timestamp <= taskSelectionDeadline) revert DeadlineNotPassed();

        task.status = TaskStatus.Refunded;
        escrowVault.refund(taskId, task.creator);

        emit TaskRefunded(taskId, task.creator, task.bountyAmount);
    }

    /**
     * @notice Mark task as disputed (called by DisputeResolver)
     * @param taskId The task ID
     * @param disputeId The dispute ID
     * @param disputer The agent who raised the dispute
     */
    function markDisputed(
        uint256 taskId,
        uint256 disputeId,
        address disputer
    )
        external
        onlyDisputeResolver
    {
        Task storage task = _tasks[taskId];
        if (task.id == 0) revert TaskNotFound();
        if (task.status != TaskStatus.InReview) revert TaskNotInReview();
        if (block.timestamp > task.challengeDeadline) revert ChallengeWindowPassed();

        task.status = TaskStatus.Disputed;
        _activeDisputeId[taskId] = disputeId;

        emit TaskDisputed(taskId, disputer, disputeId);
    }

    /**
     * @notice Revert a disputed task back to InReview status (called by DisputeResolver on cancellation)
     * @param taskId The task ID
     * @dev Restores the challenge deadline to allow normal finalization or new disputes
     */
    function revertDisputedTask(uint256 taskId) external onlyDisputeResolver {
        Task storage task = _tasks[taskId];
        if (task.id == 0) revert TaskNotFound();
        if (task.status != TaskStatus.Disputed) revert TaskNotDisputed();

        // Revert to InReview status
        task.status = TaskStatus.InReview;
        // Reset challenge deadline to give participants time to react
        task.challengeDeadline = block.timestamp + challengeWindow;

        // Clear the active dispute
        _activeDisputeId[taskId] = 0;

        emit TaskDisputeReverted(taskId, task.challengeDeadline);
    }

    /**
     * @notice Resolve a dispute (called by DisputeResolver)
     * @param taskId The task ID
     * @param disputerWon True if the disputer won
     */
    function resolveDispute(uint256 taskId, bool disputerWon) external onlyDisputeResolver {
        Task storage task = _tasks[taskId];
        if (task.id == 0) revert TaskNotFound();
        if (task.status != TaskStatus.Disputed) revert NotInReviewOrDisputed();

        uint256 disputeId = _activeDisputeId[taskId];

        if (disputerWon) {
            // Disputer wins - they get the bounty
            // The disputer is stored in DisputeResolver, but we need to determine the outcome
            // If creator rejected all, disputer was an agent who should get bounty
            // If creator selected a different winner, disputer is the agent who should get bounty instead

            // Get the disputer from DisputeResolver
            IDisputeResolver.Dispute memory dispute = disputeResolver.getDispute(disputeId);
            address winner = dispute.disputer;

            task.status = TaskStatus.Completed;
            task.selectedWinner = winner;

            escrowVault.release(taskId, winner);

            // Record task win and dispute win in ERC-8004 reputation registry
            agentAdapter.recordTaskWin(winner, taskId);
            agentAdapter.recordDisputeWin(winner, disputeId);

            emit TaskCompleted(taskId, winner, task.bountyAmount);
        } else {
            // Creator wins - original decision stands
            if (task.selectedWinner != address(0)) {
                // Original winner gets bounty
                task.status = TaskStatus.Completed;

                escrowVault.release(taskId, task.selectedWinner);

                // Record task win in ERC-8004 reputation registry
                agentAdapter.recordTaskWin(task.selectedWinner, taskId);

                emit TaskCompleted(taskId, task.selectedWinner, task.bountyAmount);
            } else {
                // All rejected - refund creator
                task.status = TaskStatus.Refunded;

                escrowVault.refund(taskId, task.creator);

                emit TaskRefunded(taskId, task.creator, task.bountyAmount);
            }

            // Disputer loses - penalized in DisputeResolver (loses stake + reputation)
        }

        emit DisputeResolved(taskId, disputeId, disputerWon);
    }

    // View functions

    /**
     * @notice Get a task by ID
     * @param taskId The task ID
     * @return The task data
     */
    function getTask(uint256 taskId) external view returns (Task memory) {
        Task storage task = _tasks[taskId];
        if (task.id == 0) revert TaskNotFound();
        return task;
    }

    /**
     * @notice Get a submission by index
     * @param taskId The task ID
     * @param index The submission index
     * @return The submission data
     */
    function getSubmission(uint256 taskId, uint256 index)
        external
        view
        returns (Submission memory)
    {
        return _submissions[taskId][index];
    }

    /**
     * @notice Get the number of submissions for a task
     * @param taskId The task ID
     * @return The submission count
     */
    function getSubmissionCount(uint256 taskId) external view returns (uint256) {
        return _submissions[taskId].length;
    }

    /**
     * @notice Get the submission index for an agent
     * @param taskId The task ID
     * @param agent The agent address
     * @return The submission index (reverts if not submitted)
     */
    function getAgentSubmissionIndex(uint256 taskId, address agent)
        external
        view
        returns (uint256)
    {
        uint256 indexPlusOne = _agentSubmissionIndex[taskId][agent];
        if (indexPlusOne == 0) revert NotSubmitted();
        return indexPlusOne - 1;
    }

    /**
     * @notice Check if an agent has submitted to a task
     * @param taskId The task ID
     * @param agent The agent address
     * @return True if agent has submitted
     */
    function hasSubmitted(uint256 taskId, address agent) external view returns (bool) {
        return _agentSubmissionIndex[taskId][agent] != 0;
    }

    /**
     * @notice Get the total number of tasks
     * @return The task count
     */
    function taskCount() external view returns (uint256) {
        return _taskCounter;
    }

    /**
     * @notice Get the active dispute ID for a task
     * @param taskId The task ID
     * @return The dispute ID (0 if no active dispute)
     */
    function getActiveDisputeId(uint256 taskId) external view returns (uint256) {
        return _activeDisputeId[taskId];
    }
}
