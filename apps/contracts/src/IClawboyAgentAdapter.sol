// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/**
 * @title IClawboyAgentAdapter
 * @notice Interface for the Clawboy to ERC-8004 adapter
 * @dev Bridges Clawboy's TaskManager and DisputeResolver to ERC-8004 registries
 */
interface IClawboyAgentAdapter {
    /// @notice Emitted when an agent is registered
    event AgentRegistered(address indexed wallet, uint256 indexed agentId, string agentURI);

    /// @notice Emitted when an agent's profile is updated
    event AgentProfileUpdated(address indexed wallet, uint256 indexed agentId, string newURI);

    /// @notice Emitted when a task win is recorded
    event TaskWinRecorded(address indexed wallet, uint256 indexed agentId, uint256 indexed taskId);

    /// @notice Emitted when a dispute win is recorded
    event DisputeWinRecorded(
        address indexed wallet, uint256 indexed agentId, uint256 indexed disputeId
    );

    /// @notice Emitted when a dispute loss is recorded
    event DisputeLossRecorded(
        address indexed wallet, uint256 indexed agentId, uint256 indexed disputeId
    );

    /// @notice Emitted when reputation is updated (for voters)
    event VoterReputationUpdated(address indexed wallet, uint256 indexed agentId, int256 delta);

    /**
     * @notice Check if a wallet is registered as an agent
     * @param wallet The wallet address
     * @return True if the wallet is linked to an agent
     */
    function isRegistered(address wallet) external view returns (bool);

    /**
     * @notice Get the agent ID for a wallet
     * @param wallet The wallet address
     * @return The agent ID (0 if not registered)
     */
    function getAgentId(address wallet) external view returns (uint256);

    /**
     * @notice Register a new agent
     * @param agentURI The URI for the agent's profile
     * @return agentId The created agent ID
     */
    function register(string calldata agentURI) external returns (uint256 agentId);

    /**
     * @notice Update an agent's profile URI
     * @param newURI The new profile URI
     */
    function updateProfile(string calldata newURI) external;

    /**
     * @notice Record a task win for an agent (called by TaskManager)
     * @param agent The agent's wallet address
     * @param taskId The task ID
     */
    function recordTaskWin(address agent, uint256 taskId) external;

    /**
     * @notice Record a dispute win for an agent (called by DisputeResolver)
     * @param agent The agent's wallet address
     * @param disputeId The dispute ID
     */
    function recordDisputeWin(address agent, uint256 disputeId) external;

    /**
     * @notice Record a dispute loss for an agent (called by DisputeResolver)
     * @param agent The agent's wallet address
     * @param disputeId The dispute ID
     */
    function recordDisputeLoss(address agent, uint256 disputeId) external;

    /**
     * @notice Update voter reputation (called by DisputeResolver)
     * @param voter The voter's wallet address
     * @param delta The reputation change (+3 for correct vote, -2 for incorrect)
     */
    function updateVoterReputation(address voter, int256 delta) external;

    /**
     * @notice Get the vote weight for an agent in disputes
     * @dev Calculated from feedback: weight = log2(reputation + 1)
     * @param agent The agent's wallet address
     * @return The vote weight (minimum 1 for registered agents)
     */
    function getVoteWeight(address agent) external view returns (uint256);

    /**
     * @notice Get reputation summary for an agent
     * @param agent The agent's wallet address
     * @return taskWins Number of tasks won
     * @return disputeWins Number of disputes won
     * @return disputeLosses Number of disputes lost
     * @return totalReputation Calculated total reputation
     */
    function getReputationSummary(address agent)
        external
        view
        returns (uint64 taskWins, uint64 disputeWins, uint64 disputeLosses, int256 totalReputation);

    /**
     * @notice Get the ERC-8004 Identity Registry address
     * @return The identity registry address
     */
    function getIdentityRegistry() external view returns (address);

    /**
     * @notice Get the ERC-8004 Reputation Registry address
     * @return The reputation registry address
     */
    function getReputationRegistry() external view returns (address);
}
