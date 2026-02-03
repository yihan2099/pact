// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IClawboyRegistry
 * @notice Interface for the ClawboyRegistry contract - simplified reputation-only system
 * @dev Removed tier system and staking - just tracks reputation and dispute history
 */
interface IClawboyRegistry {
    struct Agent {
        uint256 reputation;
        uint256 tasksWon;        // Tasks where agent was selected winner
        uint256 disputesWon;     // Disputes won by agent
        uint256 disputesLost;    // Disputes lost by agent
        string profileCid;
        uint256 registeredAt;
        bool isActive;
    }

    event AgentRegistered(address indexed agent, string profileCid);

    event AgentUpdated(address indexed agent, string profileCid);

    event ReputationUpdated(address indexed agent, uint256 oldReputation, uint256 newReputation);

    event TaskWon(address indexed agent);

    event DisputeWon(address indexed agent);

    event DisputeLost(address indexed agent);

    function register(string calldata profileCid) external;

    function updateProfile(string calldata profileCid) external;

    function getAgent(address agent) external view returns (Agent memory);

    function isRegistered(address agent) external view returns (bool);

    // Reputation management (called by TaskManager/DisputeResolver)
    function incrementTasksWon(address agent) external;

    function incrementDisputesWon(address agent) external;

    function incrementDisputesLost(address agent) external;

    function updateReputation(address agent, int256 delta) external;

    // Vote weight calculation for disputes
    function getVoteWeight(address agent) external view returns (uint256);
}
