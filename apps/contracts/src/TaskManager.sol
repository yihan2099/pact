// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ITaskManager} from "./interfaces/ITaskManager.sol";
import {IEscrowVault} from "./interfaces/IEscrowVault.sol";
import {IPorterRegistry} from "./interfaces/IPorterRegistry.sol";
import {IDisputeResolver} from "./interfaces/IDisputeResolver.sol";

/**
 * @title TaskManager
 * @notice Manages competitive task creation, submissions, and winner selection
 * @dev Implements optimistic verification - creator selects winner, disputes go to community vote
 */
contract TaskManager is ITaskManager {
    // State
    uint256 private _taskCounter;
    mapping(uint256 => Task) private _tasks;
    mapping(uint256 => Submission[]) private _submissions;
    mapping(uint256 => mapping(address => uint256)) private _agentSubmissionIndex; // taskId => agent => index+1 (0 means no submission)
    mapping(uint256 => uint256) private _activeDisputeId; // taskId => disputeId

    // External contracts
    IEscrowVault public immutable escrowVault;
    IPorterRegistry public porterRegistry;
    IDisputeResolver public disputeResolver;

    // Access control
    address public owner;

    // Configuration
    uint256 public constant CHALLENGE_WINDOW = 48 hours;
    uint256 public constant SELECTION_DEADLINE = 7 days; // Creator has 7 days after task deadline to select

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

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyDisputeResolver() {
        if (msg.sender != address(disputeResolver)) revert OnlyDisputeResolver();
        _;
    }

    constructor(address _escrowVault, address _porterRegistry) {
        escrowVault = IEscrowVault(_escrowVault);
        porterRegistry = IPorterRegistry(_porterRegistry);
        owner = msg.sender;
    }

    /**
     * @notice Set the DisputeResolver address (callable by owner)
     * @param _resolver The DisputeResolver address
     */
    function setDisputeResolver(address _resolver) external onlyOwner {
        disputeResolver = IDisputeResolver(_resolver);
    }

    /**
     * @notice Set the PorterRegistry address (callable by owner)
     * @param _registry The PorterRegistry address
     */
    function setPorterRegistry(address _registry) external onlyOwner {
        porterRegistry = IPorterRegistry(_registry);
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
    ) external payable returns (uint256 taskId) {
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
        escrowVault.deposit{value: msg.value}(taskId, bountyToken, bountyAmount);

        emit TaskCreated(taskId, msg.sender, bountyAmount, bountyToken, specificationCid, deadline);
    }

    /**
     * @notice Submit work for a task (competitive - multiple agents can submit)
     * @param taskId The task ID
     * @param submissionCid IPFS CID of the work submission
     */
    function submitWork(uint256 taskId, string calldata submissionCid) external {
        Task storage task = _tasks[taskId];
        if (task.id == 0) revert TaskNotFound();
        if (task.status != TaskStatus.Open) revert TaskNotOpen();
        if (!porterRegistry.isRegistered(msg.sender)) revert AgentNotRegistered();
        if (task.deadline != 0 && block.timestamp > task.deadline) revert DeadlinePassed();
        if (_agentSubmissionIndex[taskId][msg.sender] != 0) revert AlreadySubmitted();

        uint256 submissionIndex = _submissions[taskId].length;
        _submissions[taskId].push(Submission({
            agent: msg.sender,
            submissionCid: submissionCid,
            submittedAt: block.timestamp,
            updatedAt: block.timestamp
        }));
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
    function selectWinner(uint256 taskId, address winner) external {
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
        task.challengeDeadline = block.timestamp + CHALLENGE_WINDOW;

        emit WinnerSelected(taskId, winner, task.challengeDeadline);
    }

    /**
     * @notice Reject all submissions and refund bounty (creator only)
     * @param taskId The task ID
     * @param reason Reason for rejection
     */
    function rejectAll(uint256 taskId, string calldata reason) external {
        Task storage task = _tasks[taskId];
        if (task.id == 0) revert TaskNotFound();
        if (task.creator != msg.sender) revert NotTaskCreator();
        if (task.status != TaskStatus.Open) revert TaskNotOpen();
        if (_submissions[taskId].length == 0) revert NoSubmissions();

        task.status = TaskStatus.InReview;
        task.selectedWinner = address(0); // No winner = rejection
        task.selectedAt = block.timestamp;
        task.challengeDeadline = block.timestamp + CHALLENGE_WINDOW;

        emit AllSubmissionsRejected(taskId, msg.sender, reason);
    }

    /**
     * @notice Finalize task after challenge window (releases bounty)
     * @param taskId The task ID
     */
    function finalizeTask(uint256 taskId) external {
        Task storage task = _tasks[taskId];
        if (task.id == 0) revert TaskNotFound();
        if (task.status != TaskStatus.InReview) revert TaskNotInReview();
        if (block.timestamp < task.challengeDeadline) revert ChallengeWindowNotPassed();

        if (task.selectedWinner != address(0)) {
            // Winner selected - complete task
            task.status = TaskStatus.Completed;

            // Release bounty to winner
            escrowVault.release(taskId, task.selectedWinner);

            // Update winner's reputation
            porterRegistry.incrementTasksWon(task.selectedWinner);
            porterRegistry.updateReputation(task.selectedWinner, 10); // +10 rep for winning

            emit TaskCompleted(taskId, task.selectedWinner, task.bountyAmount);
        } else {
            // All rejected - refund creator
            task.status = TaskStatus.Refunded;

            escrowVault.refund(taskId, task.creator);

            emit TaskRefunded(taskId, task.creator, task.bountyAmount);
        }
    }

    /**
     * @notice Auto-refund if creator doesn't select within deadline
     * @param taskId The task ID
     */
    function refundExpiredTask(uint256 taskId) external {
        Task storage task = _tasks[taskId];
        if (task.id == 0) revert TaskNotFound();
        if (task.status != TaskStatus.Open) revert TaskNotOpen();

        // Calculate selection deadline (task deadline + SELECTION_DEADLINE, or just SELECTION_DEADLINE if no deadline)
        uint256 selectionDeadline;
        if (task.deadline != 0) {
            selectionDeadline = task.deadline + SELECTION_DEADLINE;
        } else {
            selectionDeadline = task.createdAtBlock + SELECTION_DEADLINE; // Use block as rough timestamp
            // Actually, use a timestamp-based approach
            revert InvalidDeadline(); // Tasks without deadlines can't auto-expire (creator must select or cancel)
        }

        if (block.timestamp <= selectionDeadline) revert DeadlineNotPassed();

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
    function markDisputed(uint256 taskId, uint256 disputeId, address disputer) external onlyDisputeResolver {
        Task storage task = _tasks[taskId];
        if (task.id == 0) revert TaskNotFound();
        if (task.status != TaskStatus.InReview) revert TaskNotInReview();
        if (block.timestamp > task.challengeDeadline) revert ChallengeWindowPassed();

        task.status = TaskStatus.Disputed;
        _activeDisputeId[taskId] = disputeId;

        emit TaskDisputed(taskId, disputer, disputeId);
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

            porterRegistry.incrementTasksWon(winner);
            porterRegistry.incrementDisputesWon(winner);
            porterRegistry.updateReputation(winner, 15); // +15 for winning dispute

            // Penalize creator for bad selection (only if registered)
            if (porterRegistry.isRegistered(task.creator)) {
                porterRegistry.updateReputation(task.creator, -30);
            }

            emit TaskCompleted(taskId, winner, task.bountyAmount);
        } else {
            // Creator wins - original decision stands
            if (task.selectedWinner != address(0)) {
                // Original winner gets bounty
                task.status = TaskStatus.Completed;

                escrowVault.release(taskId, task.selectedWinner);

                porterRegistry.incrementTasksWon(task.selectedWinner);
                porterRegistry.updateReputation(task.selectedWinner, 10);

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
    function getSubmission(uint256 taskId, uint256 index) external view returns (Submission memory) {
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
    function getAgentSubmissionIndex(uint256 taskId, address agent) external view returns (uint256) {
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
