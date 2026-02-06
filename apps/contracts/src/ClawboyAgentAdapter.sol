// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import { IClawboyAgentAdapter } from "./IClawboyAgentAdapter.sol";
import { IERC8004IdentityRegistry } from "./erc8004/interfaces/IERC8004IdentityRegistry.sol";
import { IERC8004ReputationRegistry } from "./erc8004/interfaces/IERC8004ReputationRegistry.sol";

/**
 * @title ClawboyAgentAdapter
 * @notice Bridges Clawboy's TaskManager and DisputeResolver to ERC-8004 registries
 * @dev Translates Clawboy reputation events into ERC-8004 feedback
 */
contract ClawboyAgentAdapter is IClawboyAgentAdapter {
    // ERC-8004 registries
    IERC8004IdentityRegistry public immutable identityRegistry;
    IERC8004ReputationRegistry public immutable reputationRegistry;

    // Access control
    address public owner;
    address public taskManager;
    address public disputeResolver;

    // Feedback tags
    string public constant TAG_TASK = "task";
    string public constant TAG_DISPUTE = "dispute";
    string public constant TAG_WIN = "win";
    string public constant TAG_LOSS = "loss";
    string public constant TAG_VOTE = "vote";
    string public constant TAG_CORRECT = "correct";
    string public constant TAG_INCORRECT = "incorrect";

    // Feedback values (with no decimals)
    int128 public constant TASK_WIN_VALUE = 10;
    int128 public constant DISPUTE_WIN_VALUE = 15;
    int128 public constant DISPUTE_LOSS_VALUE = -20;
    int128 public constant VOTE_CORRECT_VALUE = 3;
    int128 public constant VOTE_INCORRECT_VALUE = -2;

    // Access control (continued)
    address public pendingOwner;
    address public timelock;

    // Errors
    error OnlyOwner();
    error Unauthorized();
    error NotRegistered();
    error AlreadyRegistered();
    error NotPendingOwner();
    error ZeroAddress();
    error OnlyTimelock();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyTimelock() {
        if (msg.sender != timelock) revert OnlyTimelock();
        _;
    }

    modifier onlyAuthorized() {
        if (msg.sender != taskManager && msg.sender != disputeResolver) {
            revert Unauthorized();
        }
        _;
    }

    // Ownership events
    event OwnershipTransferInitiated(address indexed currentOwner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // Emergency bypass event
    event EmergencyBypassUsed(address indexed caller, bytes4 indexed selector);

    constructor(address _identityRegistry, address _reputationRegistry) {
        identityRegistry = IERC8004IdentityRegistry(_identityRegistry);
        reputationRegistry = IERC8004ReputationRegistry(_reputationRegistry);
        owner = msg.sender;
    }

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
     * @notice Set the TaskManager address (requires timelock)
     */
    function setTaskManager(address _taskManager) external onlyTimelock {
        if (_taskManager == address(0)) revert ZeroAddress();
        taskManager = _taskManager;
    }

    /**
     * @notice Set the DisputeResolver address (requires timelock)
     */
    function setDisputeResolver(address _disputeResolver) external onlyTimelock {
        if (_disputeResolver == address(0)) revert ZeroAddress();
        disputeResolver = _disputeResolver;
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
     * @notice Emergency bypass for setTaskManager (owner only, emits event for monitoring)
     * @param _taskManager The TaskManager address
     */
    function emergencySetTaskManager(address _taskManager) external onlyOwner {
        if (_taskManager == address(0)) revert ZeroAddress();
        taskManager = _taskManager;
        emit EmergencyBypassUsed(msg.sender, this.setTaskManager.selector);
    }

    /**
     * @notice Emergency bypass for setDisputeResolver (owner only, emits event for monitoring)
     * @param _disputeResolver The DisputeResolver address
     */
    function emergencySetDisputeResolver(address _disputeResolver) external onlyOwner {
        if (_disputeResolver == address(0)) revert ZeroAddress();
        disputeResolver = _disputeResolver;
        emit EmergencyBypassUsed(msg.sender, this.setDisputeResolver.selector);
    }

    /**
     * @notice Check if a wallet is registered as an agent
     */
    function isRegistered(address wallet) external view returns (bool) {
        return identityRegistry.getAgentIdByWallet(wallet) != 0;
    }

    /**
     * @notice Get the agent ID for a wallet
     */
    function getAgentId(address wallet) external view returns (uint256) {
        return identityRegistry.getAgentIdByWallet(wallet);
    }

    /**
     * @notice Register a new agent
     */
    function register(string calldata agentURI) external returns (uint256 agentId) {
        // Check if already registered
        if (identityRegistry.getAgentIdByWallet(msg.sender) != 0) revert AlreadyRegistered();

        // Register in identity registry on behalf of the caller
        agentId = identityRegistry.registerFor(msg.sender, agentURI);

        emit AgentRegistered(msg.sender, agentId, agentURI);
    }

    /**
     * @notice Update an agent's profile URI
     */
    function updateProfile(string calldata newURI) external {
        uint256 agentId = identityRegistry.getAgentIdByWallet(msg.sender);
        if (agentId == 0) revert NotRegistered();

        identityRegistry.setAgentURIFor(msg.sender, newURI);

        emit AgentProfileUpdated(msg.sender, agentId, newURI);
    }

    /**
     * @notice Record a task win for an agent
     */
    function recordTaskWin(address agent, uint256 taskId) external onlyAuthorized {
        uint256 agentId = identityRegistry.getAgentIdByWallet(agent);
        if (agentId == 0) revert NotRegistered();

        // Record feedback with task/win tags
        reputationRegistry.giveFeedback(
            agentId,
            TASK_WIN_VALUE,
            0, // no decimals
            TAG_TASK,
            TAG_WIN,
            "", // no endpoint
            "", // no feedbackURI
            bytes32(taskId) // use taskId as hash for reference
        );

        emit TaskWinRecorded(agent, agentId, taskId);
    }

    /**
     * @notice Record a dispute win for an agent
     */
    function recordDisputeWin(address agent, uint256 disputeId) external onlyAuthorized {
        uint256 agentId = identityRegistry.getAgentIdByWallet(agent);
        if (agentId == 0) revert NotRegistered();

        // Record feedback with dispute/win tags
        reputationRegistry.giveFeedback(
            agentId,
            DISPUTE_WIN_VALUE,
            0, // no decimals
            TAG_DISPUTE,
            TAG_WIN,
            "", // no endpoint
            "", // no feedbackURI
            bytes32(disputeId) // use disputeId as hash for reference
        );

        emit DisputeWinRecorded(agent, agentId, disputeId);
    }

    /**
     * @notice Record a dispute loss for an agent
     */
    function recordDisputeLoss(address agent, uint256 disputeId) external onlyAuthorized {
        uint256 agentId = identityRegistry.getAgentIdByWallet(agent);
        if (agentId == 0) revert NotRegistered();

        // Record feedback with dispute/loss tags
        reputationRegistry.giveFeedback(
            agentId,
            DISPUTE_LOSS_VALUE,
            0, // no decimals
            TAG_DISPUTE,
            TAG_LOSS,
            "", // no endpoint
            "", // no feedbackURI
            bytes32(disputeId) // use disputeId as hash for reference
        );

        emit DisputeLossRecorded(agent, agentId, disputeId);
    }

    /**
     * @notice Update voter reputation
     */
    function updateVoterReputation(address voter, int256 delta) external onlyAuthorized {
        uint256 agentId = identityRegistry.getAgentIdByWallet(voter);
        if (agentId == 0) return; // Silently skip non-registered voters

        string memory tag2 = delta > 0 ? TAG_CORRECT : TAG_INCORRECT;
        int128 value = delta > 0 ? VOTE_CORRECT_VALUE : VOTE_INCORRECT_VALUE;

        reputationRegistry.giveFeedback(
            agentId,
            value,
            0, // no decimals
            TAG_VOTE,
            tag2,
            "", // no endpoint
            "", // no feedbackURI
            bytes32(block.timestamp) // use timestamp as unique reference
        );

        emit VoterReputationUpdated(voter, agentId, delta);
    }

    /**
     * @notice Get the vote weight for an agent in disputes
     * @dev Weight = max(1, floor(log2(reputation + 1)))
     * @dev Uses O(1) getFeedbackCount() instead of O(n) getSummary() for gas efficiency
     */
    function getVoteWeight(address agent) external view returns (uint256) {
        uint256 agentId = identityRegistry.getAgentIdByWallet(agent);
        if (agentId == 0) return 0;

        // Use O(1) tag-based counts instead of iterating over feedback arrays
        uint64 taskWins = reputationRegistry.getFeedbackCount(agentId, TAG_TASK, TAG_WIN);
        uint64 disputeWins = reputationRegistry.getFeedbackCount(agentId, TAG_DISPUTE, TAG_WIN);
        uint64 disputeLosses = reputationRegistry.getFeedbackCount(agentId, TAG_DISPUTE, TAG_LOSS);

        // Calculate equivalent reputation (same weights as original ClawboyRegistry)
        // Task wins: +10 each
        // Dispute wins: +15 each
        // Dispute losses: -20 each
        int256 rep = int256(uint256(taskWins)) * 10 + int256(uint256(disputeWins)) * 15
            - int256(uint256(disputeLosses)) * 20;

        if (rep < 0) rep = 0;

        // Calculate log2(reputation + 1) - same formula as original
        uint256 weight = _log2(uint256(rep) + 1);

        // Minimum weight of 1 for registered agents
        return weight > 0 ? weight : 1;
    }

    /**
     * @notice Get reputation summary for an agent
     * @dev Uses O(1) getFeedbackCount() instead of O(n) getSummary() for gas efficiency
     */
    function getReputationSummary(address agent)
        external
        view
        returns (uint64 taskWins, uint64 disputeWins, uint64 disputeLosses, int256 totalReputation)
    {
        uint256 agentId = identityRegistry.getAgentIdByWallet(agent);
        if (agentId == 0) return (0, 0, 0, 0);

        taskWins = reputationRegistry.getFeedbackCount(agentId, TAG_TASK, TAG_WIN);
        disputeWins = reputationRegistry.getFeedbackCount(agentId, TAG_DISPUTE, TAG_WIN);
        disputeLosses = reputationRegistry.getFeedbackCount(agentId, TAG_DISPUTE, TAG_LOSS);

        totalReputation = int256(uint256(taskWins)) * 10 + int256(uint256(disputeWins)) * 15
            - int256(uint256(disputeLosses)) * 20;
    }

    /**
     * @notice Get the ERC-8004 Identity Registry address
     */
    function getIdentityRegistry() external view returns (address) {
        return address(identityRegistry);
    }

    /**
     * @notice Get the ERC-8004 Reputation Registry address
     */
    function getReputationRegistry() external view returns (address) {
        return address(reputationRegistry);
    }

    /**
     * @dev Calculate floor(log2(x)) for x > 0
     * Returns 0 for x = 0 or x = 1
     */
    function _log2(uint256 x) private pure returns (uint256) {
        if (x <= 1) return 0;

        uint256 result = 0;
        while (x > 1) {
            x >>= 1;
            result++;
        }
        return result;
    }
}
