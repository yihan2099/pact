// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ITaskManager} from "./interfaces/ITaskManager.sol";
import {IEscrowVault} from "./interfaces/IEscrowVault.sol";
import {IPorterRegistry} from "./interfaces/IPorterRegistry.sol";
import {IVerificationHub} from "./interfaces/IVerificationHub.sol";

/**
 * @title TaskManager
 * @notice Manages task creation, claiming, and completion in the Porter Network
 */
contract TaskManager is ITaskManager {
    // State
    uint256 private _taskCounter;
    mapping(uint256 => Task) private _tasks;

    // External contracts
    IEscrowVault public immutable escrowVault;
    IPorterRegistry public porterRegistry;

    // Access control
    address public owner;
    address public verificationHub;

    // Configuration
    uint256 public constant MIN_CLAIM_DURATION = 1 hours;
    uint256 public constant MAX_CLAIM_DURATION = 30 days;
    uint256 public constant DEFAULT_CLAIM_DURATION = 7 days;

    // Errors
    error TaskNotFound();
    error NotTaskCreator();
    error TaskNotOpen();
    error TaskNotClaimed();
    error NotClaimingAgent();
    error AgentNotRegistered();
    error InsufficientBounty();
    error InvalidDeadline();
    error TaskAlreadyClaimed();
    error OnlyOwner();
    error OnlyVerificationHub();
    error ClaimNotExpired();
    error OnlyCreatorCanReclaim();
    error DeadlinePassed();
    error VerificationHubNotSet();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyVerificationHub() {
        if (msg.sender != verificationHub) revert OnlyVerificationHub();
        _;
    }

    constructor(address _escrowVault, address _porterRegistry) {
        escrowVault = IEscrowVault(_escrowVault);
        porterRegistry = IPorterRegistry(_porterRegistry);
        owner = msg.sender;
    }

    /**
     * @notice Set the VerificationHub address (callable by owner)
     * @param _hub The VerificationHub address
     */
    function setVerificationHub(address _hub) external onlyOwner {
        verificationHub = _hub;
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
     * @param deadline Task deadline (0 for no deadline)
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
            claimedBy: address(0),
            claimedAt: 0,
            submissionCid: "",
            createdAtBlock: block.number,
            deadline: deadline
        });

        // Deposit bounty to escrow
        escrowVault.deposit{value: msg.value}(taskId, bountyToken, bountyAmount);

        emit TaskCreated(taskId, msg.sender, bountyAmount, bountyToken, specificationCid, deadline);
    }

    /**
     * @notice Claim a task to work on
     * @param taskId The task ID to claim
     */
    function claimTask(uint256 taskId) external {
        Task storage task = _tasks[taskId];
        if (task.id == 0) revert TaskNotFound();
        if (task.status != TaskStatus.Open) revert TaskNotOpen();
        if (!porterRegistry.isRegistered(msg.sender)) revert AgentNotRegistered();

        task.status = TaskStatus.Claimed;
        task.claimedBy = msg.sender;
        task.claimedAt = block.timestamp;

        uint256 claimDeadline = block.timestamp + DEFAULT_CLAIM_DURATION;
        if (task.deadline != 0 && task.deadline < claimDeadline) {
            claimDeadline = task.deadline;
        }

        emit TaskClaimed(taskId, msg.sender, claimDeadline);
    }

    /**
     * @notice Submit work for a claimed task
     * @param taskId The task ID
     * @param submissionCid IPFS CID of the work submission
     */
    function submitWork(uint256 taskId, string calldata submissionCid) external {
        Task storage task = _tasks[taskId];
        if (task.id == 0) revert TaskNotFound();
        if (task.status != TaskStatus.Claimed) revert TaskNotClaimed();
        if (task.claimedBy != msg.sender) revert NotClaimingAgent();
        if (task.deadline != 0 && block.timestamp > task.deadline) revert DeadlinePassed();
        if (verificationHub == address(0)) revert VerificationHubNotSet();

        task.status = TaskStatus.Submitted;
        task.submissionCid = submissionCid;

        // Add to pending verification queue
        IVerificationHub(verificationHub).addPending(taskId);

        emit WorkSubmitted(taskId, msg.sender, submissionCid);
    }

    /**
     * @notice Cancel a task (only creator, only if not claimed)
     * @param taskId The task ID to cancel
     */
    function cancelTask(uint256 taskId) external {
        Task storage task = _tasks[taskId];
        if (task.id == 0) revert TaskNotFound();
        if (task.creator != msg.sender) revert NotTaskCreator();
        if (task.status != TaskStatus.Open) revert TaskAlreadyClaimed();

        task.status = TaskStatus.Cancelled;

        // Refund bounty
        escrowVault.refund(taskId, msg.sender);

        emit TaskCancelled(taskId, msg.sender, task.bountyAmount);
    }

    /**
     * @notice Complete a task (called by VerificationHub after approval)
     * @param taskId The task ID
     */
    function completeTask(uint256 taskId) external onlyVerificationHub {
        Task storage task = _tasks[taskId];
        if (task.id == 0) revert TaskNotFound();

        task.status = TaskStatus.Completed;

        // Release bounty to agent
        escrowVault.release(taskId, task.claimedBy);

        // Update agent reputation
        porterRegistry.incrementCompleted(task.claimedBy);

        emit TaskCompleted(taskId, task.claimedBy, task.bountyAmount);
    }

    /**
     * @notice Fail a task (called by VerificationHub when verdict is Rejected)
     * @param taskId The task ID
     */
    function failTask(uint256 taskId) external onlyVerificationHub {
        Task storage task = _tasks[taskId];
        if (task.id == 0) revert TaskNotFound();

        address failedAgent = task.claimedBy;
        uint256 refundAmount = task.bountyAmount;

        task.status = TaskStatus.Failed;
        task.claimedBy = address(0);
        task.claimedAt = 0;
        task.submissionCid = "";

        // Refund bounty to creator
        escrowVault.refund(taskId, task.creator);

        // Penalize agent (-50 reputation)
        porterRegistry.incrementFailed(failedAgent);
        porterRegistry.updateReputation(failedAgent, -50);

        emit TaskFailed(taskId, failedAgent, refundAmount);
    }

    /**
     * @notice Reopen a task for revision (called by VerificationHub when revision is requested)
     * @param taskId The task ID
     */
    function reopenForRevision(uint256 taskId) external onlyVerificationHub {
        Task storage task = _tasks[taskId];
        if (task.id == 0) revert TaskNotFound();

        address currentAgent = task.claimedBy;

        // Reset to Claimed so agent can resubmit
        task.status = TaskStatus.Claimed;
        task.submissionCid = "";
        task.claimedAt = block.timestamp; // Reset claim timer

        uint256 newDeadline = block.timestamp + DEFAULT_CLAIM_DURATION;
        if (task.deadline != 0 && task.deadline < newDeadline) {
            newDeadline = task.deadline;
        }

        emit TaskReopenedForRevision(taskId, currentAgent);
        emit TaskClaimed(taskId, currentAgent, newDeadline);
    }

    /**
     * @notice Reclaim an expired task (called by creator when claim has expired)
     * @param taskId The task ID
     */
    function reclaimExpiredTask(uint256 taskId) external {
        Task storage task = _tasks[taskId];
        if (task.id == 0) revert TaskNotFound();
        if (task.creator != msg.sender) revert OnlyCreatorCanReclaim();
        if (task.status != TaskStatus.Claimed) revert TaskNotClaimed();

        // Check if claim has expired
        uint256 claimDeadline = task.claimedAt + DEFAULT_CLAIM_DURATION;
        if (task.deadline != 0 && task.deadline < claimDeadline) {
            claimDeadline = task.deadline;
        }
        if (block.timestamp <= claimDeadline) revert ClaimNotExpired();

        address expiredAgent = task.claimedBy;

        task.status = TaskStatus.Expired;
        task.claimedBy = address(0);
        task.claimedAt = 0;

        // Refund bounty
        escrowVault.refund(taskId, task.creator);

        // Penalize agent (-25 reputation, less than rejection)
        porterRegistry.incrementFailed(expiredAgent);
        porterRegistry.updateReputation(expiredAgent, -25);

        emit TaskExpiredFromClaim(taskId, expiredAgent);
    }

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
     * @notice Get the total number of tasks
     * @return The task count
     */
    function taskCount() external view returns (uint256) {
        return _taskCounter;
    }
}
