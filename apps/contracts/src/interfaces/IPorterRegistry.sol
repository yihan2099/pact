// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IPorterRegistry
 * @notice Interface for the PorterRegistry contract
 */
interface IPorterRegistry {
    enum AgentTier {
        Newcomer,
        Established,
        Verified,
        Elite
    }

    struct Agent {
        AgentTier tier;
        uint256 reputation;
        uint256 tasksCompleted;
        uint256 tasksFailed;
        uint256 stakedAmount;
        string profileCid;
        uint256 registeredAt;
        bool isActive;
    }

    event AgentRegistered(address indexed agent, string profileCid);

    event AgentUpdated(address indexed agent, string profileCid);

    event TierUpdated(address indexed agent, AgentTier oldTier, AgentTier newTier);

    event ReputationUpdated(address indexed agent, uint256 oldReputation, uint256 newReputation);

    event Staked(address indexed agent, uint256 amount);

    event Unstaked(address indexed agent, uint256 amount);

    function register(string calldata profileCid) external;

    function updateProfile(string calldata profileCid) external;

    function stake() external payable;

    function unstake(uint256 amount) external;

    function getAgent(address agent) external view returns (Agent memory);

    function isRegistered(address agent) external view returns (bool);

    function getStake(address agent) external view returns (uint256);
}
