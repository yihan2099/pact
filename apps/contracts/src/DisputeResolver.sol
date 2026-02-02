// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IDisputeResolver} from "./interfaces/IDisputeResolver.sol";
import {ITaskManager} from "./interfaces/ITaskManager.sol";
import {IPorterRegistry} from "./interfaces/IPorterRegistry.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DisputeResolver
 * @notice Handles disputes when agents disagree with creator's selection/rejection
 * @dev Community votes with reputation-weighted voting to resolve disputes
 * @dev SECURITY: Uses ReentrancyGuard to prevent reentrancy attacks on stake transfers
 */
contract DisputeResolver is IDisputeResolver, ReentrancyGuard {
    // Constants
    uint256 public constant MIN_DISPUTE_STAKE = 0.01 ether;
    uint256 public constant DISPUTE_STAKE_PERCENT = 1; // 1% of bounty
    uint256 public constant VOTING_PERIOD = 48 hours;
    uint256 public constant MAJORITY_THRESHOLD = 60; // 60% weighted majority

    // State
    uint256 private _disputeCounter;
    mapping(uint256 => Dispute) private _disputes;
    mapping(uint256 => mapping(address => Vote)) private _votes; // disputeId => voter => Vote
    mapping(uint256 => address[]) private _voters; // disputeId => list of voters
    mapping(uint256 => uint256) private _taskDispute; // taskId => disputeId

    // External contracts
    ITaskManager public immutable taskManager;
    IPorterRegistry public immutable porterRegistry;

    // Access control
    address public owner;

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

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(address _taskManager, address _porterRegistry) {
        taskManager = ITaskManager(_taskManager);
        porterRegistry = IPorterRegistry(_porterRegistry);
        owner = msg.sender;
    }

    /**
     * @notice Start a dispute on a task selection/rejection
     * @param taskId The task ID to dispute
     * @return disputeId The created dispute ID
     */
    function startDispute(uint256 taskId) external payable returns (uint256 disputeId) {
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
            votingDeadline: block.timestamp + VOTING_PERIOD,
            status: DisputeStatus.Active,
            disputerWon: false,
            votesForDisputer: 0,
            votesAgainstDisputer: 0
        });

        _taskDispute[taskId] = disputeId;

        // Mark task as disputed in TaskManager
        taskManager.markDisputed(taskId, disputeId, msg.sender);

        emit DisputeCreated(disputeId, taskId, msg.sender, msg.value, block.timestamp + VOTING_PERIOD);
    }

    /**
     * @notice Submit a vote on a dispute
     * @param disputeId The dispute ID
     * @param supportsDisputer True to support disputer, false to support creator
     */
    function submitVote(uint256 disputeId, bool supportsDisputer) external {
        Dispute storage dispute = _disputes[disputeId];
        if (dispute.id == 0) revert DisputeNotFound();
        if (dispute.status != DisputeStatus.Active) revert VotingNotActive();
        if (block.timestamp > dispute.votingDeadline) revert VotingNotActive();
        if (!porterRegistry.isRegistered(msg.sender)) revert NotRegistered();
        if (_votes[disputeId][msg.sender].timestamp != 0) revert AlreadyVoted();

        // Voters cannot be the disputer or the task creator
        ITaskManager.Task memory task = taskManager.getTask(dispute.taskId);
        if (msg.sender == dispute.disputer || msg.sender == task.creator) revert AlreadyVoted();

        uint256 weight = porterRegistry.getVoteWeight(msg.sender);

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
            (bool success,) = dispute.disputer.call{value: dispute.disputeStake}("");
            if (!success) revert TransferFailed();

            emit DisputeStakeReturned(dispute.id, dispute.disputer, dispute.disputeStake);

            // Reputation handled by TaskManager.resolveDispute()
        } else {
            // Disputer loses - stake goes to protocol (or could be burned/redistributed)
            // For now, keep in contract (could add treasury later)
            porterRegistry.incrementDisputesLost(dispute.disputer);
            porterRegistry.updateReputation(dispute.disputer, -20); // -20 rep for losing dispute

            emit DisputeStakeSlashed(dispute.id, dispute.disputer, dispute.disputeStake);
        }

        // Update voter reputation
        _updateVoterReputation(dispute.id, disputerWon);
    }

    /**
     * @dev Update reputation for voters based on whether they voted with majority
     */
    function _updateVoterReputation(uint256 disputeId, bool disputerWon) private {
        address[] storage voters = _voters[disputeId];

        for (uint256 i = 0; i < voters.length; i++) {
            Vote storage vote = _votes[disputeId][voters[i]];
            bool votedWithMajority = (vote.supportsDisputer == disputerWon);

            if (votedWithMajority) {
                porterRegistry.updateReputation(voters[i], 3); // +3 for voting with majority
            } else {
                porterRegistry.updateReputation(voters[i], -2); // -2 for voting against majority
            }
        }
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
     * @notice Withdraw accumulated slashed stakes (owner only)
     * @param recipient The address to receive funds
     * @param amount The amount to withdraw
     * @dev SECURITY: nonReentrant prevents reentrancy attacks on withdrawals
     */
    function withdrawSlashedStakes(address recipient, uint256 amount) external onlyOwner nonReentrant {
        (bool success,) = recipient.call{value: amount}("");
        if (!success) revert TransferFailed();
    }
}
