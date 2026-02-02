// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IPorterRegistry} from "./interfaces/IPorterRegistry.sol";

/**
 * @title PorterRegistry
 * @notice Manages agent registration and reputation - simplified model without tiers/staking
 * @dev Reputation is earned through winning tasks and disputes, lost through losing disputes
 */
contract PorterRegistry is IPorterRegistry {
    // State
    mapping(address => Agent) private _agents;

    // Access control
    address public owner;
    address public taskManager;
    address public disputeResolver;

    // Errors
    error AlreadyRegistered();
    error NotRegistered();
    error OnlyOwner();
    error Unauthorized();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyAuthorized() {
        if (msg.sender != taskManager && msg.sender != disputeResolver) {
            revert Unauthorized();
        }
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Set the TaskManager address (callable by owner)
     * @param _taskManager The TaskManager address
     */
    function setTaskManager(address _taskManager) external onlyOwner {
        taskManager = _taskManager;
    }

    /**
     * @notice Set the DisputeResolver address (callable by owner)
     * @param _disputeResolver The DisputeResolver address
     */
    function setDisputeResolver(address _disputeResolver) external onlyOwner {
        disputeResolver = _disputeResolver;
    }

    /**
     * @notice Register as an agent
     * @param profileCid IPFS CID of the agent profile
     */
    function register(string calldata profileCid) external {
        if (_agents[msg.sender].registeredAt != 0) revert AlreadyRegistered();

        _agents[msg.sender] = Agent({
            reputation: 0,
            tasksWon: 0,
            disputesWon: 0,
            disputesLost: 0,
            profileCid: profileCid,
            registeredAt: block.timestamp,
            isActive: true
        });

        emit AgentRegistered(msg.sender, profileCid);
    }

    /**
     * @notice Update agent profile
     * @param profileCid New IPFS CID of the agent profile
     */
    function updateProfile(string calldata profileCid) external {
        if (_agents[msg.sender].registeredAt == 0) revert NotRegistered();

        _agents[msg.sender].profileCid = profileCid;

        emit AgentUpdated(msg.sender, profileCid);
    }

    /**
     * @notice Update agent reputation (called by TaskManager/DisputeResolver)
     * @param agent The agent address
     * @param delta The reputation change (can be negative)
     */
    function updateReputation(address agent, int256 delta) external onlyAuthorized {
        Agent storage a = _agents[agent];
        if (a.registeredAt == 0) revert NotRegistered();

        uint256 oldReputation = a.reputation;

        if (delta >= 0) {
            a.reputation += uint256(delta);
        } else {
            uint256 decrease = uint256(-delta);
            if (decrease > a.reputation) {
                a.reputation = 0;
            } else {
                a.reputation -= decrease;
            }
        }

        emit ReputationUpdated(agent, oldReputation, a.reputation);
    }

    /**
     * @notice Increment tasks won (called by TaskManager)
     * @param agent The agent address
     */
    function incrementTasksWon(address agent) external onlyAuthorized {
        if (_agents[agent].registeredAt == 0) revert NotRegistered();
        _agents[agent].tasksWon++;
        emit TaskWon(agent);
    }

    /**
     * @notice Increment disputes won (called by DisputeResolver)
     * @param agent The agent address
     */
    function incrementDisputesWon(address agent) external onlyAuthorized {
        if (_agents[agent].registeredAt == 0) revert NotRegistered();
        _agents[agent].disputesWon++;
        emit DisputeWon(agent);
    }

    /**
     * @notice Increment disputes lost (called by DisputeResolver)
     * @param agent The agent address
     */
    function incrementDisputesLost(address agent) external onlyAuthorized {
        if (_agents[agent].registeredAt == 0) revert NotRegistered();
        _agents[agent].disputesLost++;
        emit DisputeLost(agent);
    }

    /**
     * @notice Calculate vote weight for disputes based on reputation
     * @dev Weight = max(1, floor(log2(reputation + 1)))
     * @param agent The agent address
     * @return The vote weight
     */
    function getVoteWeight(address agent) external view returns (uint256) {
        Agent storage a = _agents[agent];
        if (a.registeredAt == 0) return 0;

        // Calculate log2(reputation + 1) using bit manipulation
        uint256 repPlusOne = a.reputation + 1;
        uint256 weight = _log2(repPlusOne);

        // Minimum weight of 1 for registered agents
        return weight > 0 ? weight : 1;
    }

    /**
     * @notice Get agent data
     * @param agent The agent address
     * @return The agent data
     */
    function getAgent(address agent) external view returns (Agent memory) {
        return _agents[agent];
    }

    /**
     * @notice Check if an address is registered
     * @param agent The agent address
     * @return True if registered
     */
    function isRegistered(address agent) external view returns (bool) {
        return _agents[agent].registeredAt != 0;
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
