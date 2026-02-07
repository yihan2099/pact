// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import { IDisputeResolver } from "./interfaces/IDisputeResolver.sol";
import { ITaskManager } from "./interfaces/ITaskManager.sol";
import { IClawboyAgentAdapter } from "./IClawboyAgentAdapter.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title DisputeResolver
 * @notice Handles disputes when agents disagree with creator's selection/rejection
 * @dev Community votes with reputation-weighted voting to resolve disputes
 * @dev SECURITY: Uses ReentrancyGuard to prevent reentrancy attacks on stake transfers
 */
contract DisputeResolver is IDisputeResolver, ReentrancyGuard, Pausable {
    // Constants
    uint256 public constant MIN_DISPUTE_STAKE = 0.01 ether;
    uint256 public constant DISPUTE_STAKE_PERCENT = 1; // 1% of bounty
    uint256 public constant MAJORITY_THRESHOLD = 60; // 60% weighted majority
    uint256 public constant MAX_VOTERS_PER_DISPUTE = 500; // Prevent gas exhaustion in resolution
    uint256 public constant VOTER_REP_BATCH_SIZE = 50; // Max voters processed per batch call

    // Configurable time constant with bounded setter
    uint256 public votingPeriod = 48 hours;
    uint256 public constant MIN_VOTING_PERIOD = 24 hours;
    uint256 public constant MAX_VOTING_PERIOD = 7 days;

    // State
    uint256 private _disputeCounter;
    mapping(uint256 => Dispute) private _disputes;
    mapping(uint256 => mapping(address => Vote)) private _votes; // disputeId => voter => Vote
    mapping(uint256 => address[]) private _voters; // disputeId => list of voters
    mapping(uint256 => uint256) private _taskDispute; // taskId => disputeId
    mapping(uint256 => uint256) private _voterRepProcessedIndex; // disputeId => next voter index to process

    // External contracts
    ITaskManager public immutable taskManager;
    IClawboyAgentAdapter public immutable agentAdapter;

    // Access control
    address public owner;
    address public pendingOwner;
    address public timelock;

    // Slashed stakes tracking
    uint256 public totalSlashedStakes;
    uint256 public totalWithdrawnStakes;

    // Errors
    error DisputeNotFound();
    error NotSubmitter();
    error DisputeAlreadyExists();
    error InsufficientStake();
    error TaskNotInReview();
    error VotingNotActive();
    error AlreadyVoted();
    error NotRegistered();
    error VotingStillActive();
    error DisputeAlreadyResolved();
    error OnlyOwner();
    error TransferFailed();
    error MaxVotersReached();
    error DisputeNotActive();
    error NotPendingOwner();
    error InsufficientSlashedStakes();
    error OnlyTimelock();
    error ZeroAddress();
    error VoterRepAlreadyComplete();
    error DisputeNotResolved();
    error ValueOutOfBounds();

    /// @notice Emitted when a dispute is cancelled
    event DisputeCancelled(uint256 indexed disputeId, uint256 indexed taskId, address cancelledBy);

    // Ownership events
    event OwnershipTransferInitiated(address indexed currentOwner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // Slashed stakes events
    event StakeSlashed(uint256 indexed disputeId, address indexed disputer, uint256 amount);
    event StakesWithdrawn(address indexed recipient, uint256 amount);

    // Voter reputation batch processing event
    event VoterReputationBatchProcessed(
        uint256 indexed disputeId, uint256 processed, uint256 remaining
    );

    // Emergency bypass event
    event EmergencyBypassUsed(address indexed caller, bytes4 indexed selector);

    // Time configuration event
    event VotingPeriodUpdated(uint256 oldPeriod, uint256 newPeriod);

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyTimelock() {
        if (msg.sender != timelock) revert OnlyTimelock();
        _;
    }

    constructor(address _taskManager, address _agentAdapter) {
        taskManager = ITaskManager(_taskManager);
        agentAdapter = IClawboyAgentAdapter(_agentAdapter);
        owner = msg.sender;
    }

    /**
     * @notice Set the voting period duration
     * @param newPeriod The new voting period in seconds (min 24h, max 7 days)
     */
    function setVotingPeriod(uint256 newPeriod) external onlyOwner {
        if (newPeriod < MIN_VOTING_PERIOD || newPeriod > MAX_VOTING_PERIOD) {
            revert ValueOutOfBounds();
        }
        uint256 oldPeriod = votingPeriod;
        votingPeriod = newPeriod;
        emit VotingPeriodUpdated(oldPeriod, newPeriod);
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
     * @notice Initiate ownership transfer (two-step process)
     * @param newOwner The address to transfer ownership to
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert TransferFailed(); // Reuse error for zero address
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
     * @notice Start a dispute on a task selection/rejection
     * @param taskId The task ID to dispute
     * @return disputeId The created dispute ID
     */
    function startDispute(uint256 taskId)
        external
        payable
        whenNotPaused
        returns (uint256 disputeId)
    {
        ITaskManager.Task memory task = taskManager.getTask(taskId);

        // Verify task is in review (within challenge window)
        if (task.status != ITaskManager.TaskStatus.InReview) revert TaskNotInReview();

        // Verify caller is a submitter on this task
        if (!taskManager.hasSubmitted(taskId, msg.sender)) revert NotSubmitter();

        // Verify no existing dispute
        if (_taskDispute[taskId] != 0) revert DisputeAlreadyExists();

        // Calculate and verify stake
        uint256 requiredStake = calculateDisputeStake(task.bountyAmount);
        if (msg.value < requiredStake) revert InsufficientStake();

        disputeId = ++_disputeCounter;

        _disputes[disputeId] = Dispute({
            id: disputeId,
            taskId: taskId,
            disputer: msg.sender,
            disputeStake: msg.value,
            votingDeadline: block.timestamp + votingPeriod,
            status: DisputeStatus.Active,
            disputerWon: false,
            votesForDisputer: 0,
            votesAgainstDisputer: 0
        });

        _taskDispute[taskId] = disputeId;

        // Mark task as disputed in TaskManager
        taskManager.markDisputed(taskId, disputeId, msg.sender);

        emit DisputeCreated(
            disputeId, taskId, msg.sender, msg.value, block.timestamp + votingPeriod
        );
    }

    /**
     * @notice Submit a vote on a dispute
     * @param disputeId The dispute ID
     * @param supportsDisputer True to support disputer, false to support creator
     */
    function submitVote(uint256 disputeId, bool supportsDisputer) external whenNotPaused {
        Dispute storage dispute = _disputes[disputeId];
        if (dispute.id == 0) revert DisputeNotFound();
        if (dispute.status != DisputeStatus.Active) revert VotingNotActive();
        if (block.timestamp > dispute.votingDeadline) revert VotingNotActive();
        if (!agentAdapter.isRegistered(msg.sender)) revert NotRegistered();
        if (_votes[disputeId][msg.sender].timestamp != 0) revert AlreadyVoted();

        // Voters cannot be the disputer or the task creator
        ITaskManager.Task memory task = taskManager.getTask(dispute.taskId);
        if (msg.sender == dispute.disputer || msg.sender == task.creator) revert AlreadyVoted();

        uint256 weight = agentAdapter.getVoteWeight(msg.sender);

        // Enforce voter limit to prevent gas exhaustion during resolution
        if (_voters[disputeId].length >= MAX_VOTERS_PER_DISPUTE) revert MaxVotersReached();

        _votes[disputeId][msg.sender] = Vote({
            voter: msg.sender,
            supportsDisputer: supportsDisputer,
            weight: weight,
            timestamp: block.timestamp
        });

        _voters[disputeId].push(msg.sender);

        if (supportsDisputer) {
            dispute.votesForDisputer += weight;
        } else {
            dispute.votesAgainstDisputer += weight;
        }

        emit VoteSubmitted(disputeId, msg.sender, supportsDisputer, weight);
    }

    /**
     * @notice Resolve a dispute after voting period ends
     * @param disputeId The dispute ID
     * @dev SECURITY: nonReentrant prevents reentrancy attacks on stake transfers
     */
    function resolveDispute(uint256 disputeId) external nonReentrant {
        Dispute storage dispute = _disputes[disputeId];
        if (dispute.id == 0) revert DisputeNotFound();
        if (dispute.status != DisputeStatus.Active) revert DisputeAlreadyResolved();
        if (block.timestamp < dispute.votingDeadline) revert VotingStillActive();

        uint256 totalVotes = dispute.votesForDisputer + dispute.votesAgainstDisputer;
        bool disputerWon;

        if (totalVotes == 0) {
            // No votes - default to creator wins (status quo)
            disputerWon = false;
        } else {
            // Check if disputer got 60%+ of votes
            uint256 disputerPercent = (dispute.votesForDisputer * 100) / totalVotes;
            disputerWon = disputerPercent >= MAJORITY_THRESHOLD;
        }

        dispute.status = DisputeStatus.Resolved;
        dispute.disputerWon = disputerWon;

        // Update reputation based on outcome
        _processDisputeOutcome(dispute, disputerWon);

        // Notify TaskManager to handle bounty distribution
        taskManager.resolveDispute(dispute.taskId, disputerWon);

        emit DisputeResolved(
            disputeId,
            dispute.taskId,
            disputerWon,
            dispute.votesForDisputer,
            dispute.votesAgainstDisputer
        );
    }

    /**
     * @dev Process dispute outcome - handle stakes and reputation
     */
    function _processDisputeOutcome(Dispute storage dispute, bool disputerWon) private {
        if (disputerWon) {
            // Disputer wins - return stake
            (bool success,) = dispute.disputer.call{ value: dispute.disputeStake }("");
            if (!success) revert TransferFailed();

            emit DisputeStakeReturned(dispute.id, dispute.disputer, dispute.disputeStake);

            // Reputation handled by TaskManager.resolveDispute()
        } else {
            // Disputer loses - stake goes to protocol (or could be burned/redistributed)
            // Track the slashed stake for accounting
            totalSlashedStakes += dispute.disputeStake;
            agentAdapter.recordDisputeLoss(dispute.disputer, dispute.id);

            emit StakeSlashed(dispute.id, dispute.disputer, dispute.disputeStake);
            emit DisputeStakeSlashed(dispute.id, dispute.disputer, dispute.disputeStake);
        }

        // Update voter reputation
        _updateVoterReputation(dispute.id, disputerWon);
    }

    /**
     * @dev Update reputation for voters based on whether they voted with majority.
     *      Processes up to VOTER_REP_BATCH_SIZE voters inline. If more voters remain,
     *      they must be processed via processVoterReputationBatch().
     */
    function _updateVoterReputation(uint256 disputeId, bool disputerWon) private {
        address[] storage voters = _voters[disputeId];
        uint256 total = voters.length;
        uint256 batchEnd = total < VOTER_REP_BATCH_SIZE ? total : VOTER_REP_BATCH_SIZE;

        for (uint256 i = 0; i < batchEnd; i++) {
            Vote storage vote = _votes[disputeId][voters[i]];
            bool votedWithMajority = (vote.supportsDisputer == disputerWon);

            if (votedWithMajority) {
                agentAdapter.updateVoterReputation(voters[i], 3); // +3 for voting with majority
            } else {
                agentAdapter.updateVoterReputation(voters[i], -2); // -2 for voting against majority
            }
        }

        _voterRepProcessedIndex[disputeId] = batchEnd;

        if (batchEnd < total) {
            emit VoterReputationBatchProcessed(disputeId, batchEnd, total - batchEnd);
        }
    }

    /**
     * @notice Process voter reputation updates in batches for disputes with many voters
     * @param disputeId The dispute ID
     * @dev Anyone can call this to process remaining voter reputation updates.
     *      Processes up to VOTER_REP_BATCH_SIZE voters per call.
     */
    function processVoterReputationBatch(uint256 disputeId) external {
        Dispute storage dispute = _disputes[disputeId];
        if (dispute.id == 0) revert DisputeNotFound();
        if (dispute.status != DisputeStatus.Resolved) revert DisputeNotResolved();

        address[] storage voters = _voters[disputeId];
        uint256 startIndex = _voterRepProcessedIndex[disputeId];
        uint256 total = voters.length;

        if (startIndex >= total) revert VoterRepAlreadyComplete();

        uint256 batchEnd = startIndex + VOTER_REP_BATCH_SIZE;
        if (batchEnd > total) batchEnd = total;

        bool disputerWon = dispute.disputerWon;

        for (uint256 i = startIndex; i < batchEnd; i++) {
            Vote storage vote = _votes[disputeId][voters[i]];
            bool votedWithMajority = (vote.supportsDisputer == disputerWon);

            if (votedWithMajority) {
                agentAdapter.updateVoterReputation(voters[i], 3);
            } else {
                agentAdapter.updateVoterReputation(voters[i], -2);
            }
        }

        _voterRepProcessedIndex[disputeId] = batchEnd;
        uint256 remaining = total > batchEnd ? total - batchEnd : 0;
        emit VoterReputationBatchProcessed(disputeId, batchEnd - startIndex, remaining);
    }

    /**
     * @notice Get the number of unprocessed voter reputation updates for a dispute
     * @param disputeId The dispute ID
     * @return remaining Number of voters still needing reputation updates
     */
    function pendingVoterRepUpdates(uint256 disputeId) external view returns (uint256 remaining) {
        uint256 total = _voters[disputeId].length;
        uint256 processed = _voterRepProcessedIndex[disputeId];
        remaining = total > processed ? total - processed : 0;
    }

    /**
     * @notice Calculate required dispute stake
     * @param bountyAmount The task bounty amount
     * @return The required stake amount
     */
    function calculateDisputeStake(uint256 bountyAmount) public pure returns (uint256) {
        uint256 percentStake = (bountyAmount * DISPUTE_STAKE_PERCENT) / 100;
        return percentStake > MIN_DISPUTE_STAKE ? percentStake : MIN_DISPUTE_STAKE;
    }

    // View functions

    /**
     * @notice Get a dispute by ID
     * @param disputeId The dispute ID
     * @return The dispute data
     */
    function getDispute(uint256 disputeId) external view returns (Dispute memory) {
        return _disputes[disputeId];
    }

    /**
     * @notice Get a vote for a dispute
     * @param disputeId The dispute ID
     * @param voter The voter address
     * @return The vote data
     */
    function getVote(uint256 disputeId, address voter) external view returns (Vote memory) {
        return _votes[disputeId][voter];
    }

    /**
     * @notice Check if an address has voted on a dispute
     * @param disputeId The dispute ID
     * @param voter The voter address
     * @return True if voted
     */
    function hasVoted(uint256 disputeId, address voter) external view returns (bool) {
        return _votes[disputeId][voter].timestamp != 0;
    }

    /**
     * @notice Get the dispute ID for a task
     * @param taskId The task ID
     * @return The dispute ID (0 if no dispute)
     */
    function getDisputeByTask(uint256 taskId) external view returns (uint256) {
        return _taskDispute[taskId];
    }

    /**
     * @notice Get the total number of disputes
     * @return The dispute count
     */
    function disputeCount() external view returns (uint256) {
        return _disputeCounter;
    }

    /**
     * @notice Get all voters for a dispute
     * @param disputeId The dispute ID
     * @return Array of voter addresses
     */
    function getVoters(uint256 disputeId) external view returns (address[] memory) {
        return _voters[disputeId];
    }

    /**
     * @notice Get the available slashed stakes that can be withdrawn
     * @return The available amount (total slashed minus already withdrawn)
     */
    function availableSlashedStakes() external view returns (uint256) {
        return totalSlashedStakes - totalWithdrawnStakes;
    }

    /**
     * @notice Withdraw accumulated slashed stakes (requires timelock)
     * @param recipient The address to receive funds
     * @param amount The amount to withdraw
     * @dev SECURITY: nonReentrant prevents reentrancy attacks on withdrawals
     */
    function withdrawSlashedStakes(
        address recipient,
        uint256 amount
    )
        external
        onlyTimelock
        nonReentrant
    {
        // Validate available balance
        uint256 available = totalSlashedStakes - totalWithdrawnStakes;
        if (amount > available) revert InsufficientSlashedStakes();

        // Track withdrawal
        totalWithdrawnStakes += amount;

        (bool success,) = recipient.call{ value: amount }("");
        if (!success) revert TransferFailed();

        emit StakesWithdrawn(recipient, amount);
    }

    /**
     * @notice Cancel a dispute (requires timelock, for fraudulent disputes or emergency)
     * @param disputeId The dispute ID to cancel
     * @dev This refunds the dispute stake to the disputer and marks the dispute as cancelled.
     *      The task reverts to InReview status with a new challenge deadline.
     *      Can only cancel active disputes that haven't been resolved yet.
     */
    function cancelDispute(uint256 disputeId) external onlyTimelock nonReentrant {
        Dispute storage dispute = _disputes[disputeId];
        if (dispute.id == 0) revert DisputeNotFound();
        if (dispute.status != DisputeStatus.Active) revert DisputeNotActive();

        // Mark dispute as cancelled
        dispute.status = DisputeStatus.Cancelled;

        // Clear the task dispute mapping
        _taskDispute[dispute.taskId] = 0;

        // Return stake to disputer
        (bool success,) = dispute.disputer.call{ value: dispute.disputeStake }("");
        if (!success) revert TransferFailed();

        // Revert task to InReview status so it can be finalized normally or disputed again
        taskManager.revertDisputedTask(dispute.taskId);

        emit DisputeCancelled(disputeId, dispute.taskId, msg.sender);
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
     * @notice Emergency cancel dispute (owner only, emits event for monitoring)
     * @param disputeId The dispute ID to cancel
     */
    function emergencyCancelDispute(uint256 disputeId) external onlyOwner nonReentrant {
        Dispute storage dispute = _disputes[disputeId];
        if (dispute.id == 0) revert DisputeNotFound();
        if (dispute.status != DisputeStatus.Active) revert DisputeNotActive();

        // Mark dispute as cancelled
        dispute.status = DisputeStatus.Cancelled;

        // Clear the task dispute mapping
        _taskDispute[dispute.taskId] = 0;

        // Return stake to disputer
        (bool success,) = dispute.disputer.call{ value: dispute.disputeStake }("");
        if (!success) revert TransferFailed();

        // Revert task to InReview status so it can be finalized normally or disputed again
        taskManager.revertDisputedTask(dispute.taskId);

        emit EmergencyBypassUsed(msg.sender, this.cancelDispute.selector);
        emit DisputeCancelled(disputeId, dispute.taskId, msg.sender);
    }

    /**
     * @notice Emergency withdraw slashed stakes (owner only, emits event for monitoring)
     * @param recipient The address to receive funds
     * @param amount The amount to withdraw
     */
    function emergencyWithdrawSlashedStakes(
        address recipient,
        uint256 amount
    )
        external
        onlyOwner
        nonReentrant
    {
        // Validate available balance
        uint256 available = totalSlashedStakes - totalWithdrawnStakes;
        if (amount > available) revert InsufficientSlashedStakes();

        // Track withdrawal
        totalWithdrawnStakes += amount;

        (bool success,) = recipient.call{ value: amount }("");
        if (!success) revert TransferFailed();

        emit EmergencyBypassUsed(msg.sender, this.withdrawSlashedStakes.selector);
        emit StakesWithdrawn(recipient, amount);
    }
}
