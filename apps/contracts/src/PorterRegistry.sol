// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPorterRegistry} from "./interfaces/IPorterRegistry.sol";

/**
 * @title PorterRegistry
 * @notice Manages agent registration, reputation, and staking
 */
contract PorterRegistry is IPorterRegistry {
    // State
    mapping(address => Agent) private _agents;

    // Access control
    address public owner;
    address public taskManager;
    address public verificationHub;

    // Tier thresholds
    uint256 public constant ESTABLISHED_REPUTATION = 100;
    uint256 public constant VERIFIED_REPUTATION = 500;
    uint256 public constant ELITE_REPUTATION = 1000;

    // Staking requirements for higher tiers
    uint256 public constant VERIFIED_STAKE = 1 ether;
    uint256 public constant ELITE_STAKE = 5 ether;

    // Errors
    error AlreadyRegistered();
    error NotRegistered();
    error InsufficientStake();
    error StakeAmountTooLow();
    error WithdrawFailed();
    error OnlyOwner();
    error Unauthorized();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyAuthorized() {
        if (msg.sender != taskManager && msg.sender != verificationHub) {
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
     * @notice Set the VerificationHub address (callable by owner)
     * @param _verificationHub The VerificationHub address
     */
    function setVerificationHub(address _verificationHub) external onlyOwner {
        verificationHub = _verificationHub;
    }

    /**
     * @notice Register as an agent
     * @param profileCid IPFS CID of the agent profile
     */
    function register(string calldata profileCid) external {
        if (_agents[msg.sender].registeredAt != 0) revert AlreadyRegistered();

        _agents[msg.sender] = Agent({
            tier: AgentTier.Newcomer,
            reputation: 0,
            tasksCompleted: 0,
            tasksFailed: 0,
            stakedAmount: 0,
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
     * @notice Stake ETH to increase tier eligibility
     */
    function stake() external payable {
        if (_agents[msg.sender].registeredAt == 0) revert NotRegistered();
        if (msg.value == 0) revert StakeAmountTooLow();

        _agents[msg.sender].stakedAmount += msg.value;

        emit Staked(msg.sender, msg.value);

        // Check for tier upgrade
        _updateTier(msg.sender);
    }

    /**
     * @notice Unstake ETH
     * @param amount Amount to unstake
     */
    function unstake(uint256 amount) external {
        Agent storage agent = _agents[msg.sender];
        if (agent.registeredAt == 0) revert NotRegistered();
        if (agent.stakedAmount < amount) revert InsufficientStake();

        agent.stakedAmount -= amount;

        (bool success,) = msg.sender.call{value: amount}("");
        if (!success) revert WithdrawFailed();

        emit Unstaked(msg.sender, amount);

        // Check for tier downgrade
        _updateTier(msg.sender);
    }

    /**
     * @notice Update agent reputation (called by TaskManager/VerificationHub)
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

        _updateTier(agent);
    }

    /**
     * @notice Increment completed tasks (called by TaskManager)
     * @param agent The agent address
     */
    function incrementCompleted(address agent) external onlyAuthorized {
        _agents[agent].tasksCompleted++;
    }

    /**
     * @notice Increment failed tasks (called by TaskManager)
     * @param agent The agent address
     */
    function incrementFailed(address agent) external onlyAuthorized {
        _agents[agent].tasksFailed++;
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
     * @notice Get agent's staked amount
     * @param agent The agent address
     * @return The staked amount
     */
    function getStake(address agent) external view returns (uint256) {
        return _agents[agent].stakedAmount;
    }

    /**
     * @dev Update agent tier based on reputation and stake
     */
    function _updateTier(address agent) private {
        Agent storage a = _agents[agent];
        AgentTier oldTier = a.tier;
        AgentTier newTier = AgentTier.Newcomer;

        if (a.reputation >= ELITE_REPUTATION && a.stakedAmount >= ELITE_STAKE) {
            newTier = AgentTier.Elite;
        } else if (a.reputation >= VERIFIED_REPUTATION && a.stakedAmount >= VERIFIED_STAKE) {
            newTier = AgentTier.Verified;
        } else if (a.reputation >= ESTABLISHED_REPUTATION) {
            newTier = AgentTier.Established;
        }

        if (newTier != oldTier) {
            a.tier = newTier;
            emit TierUpdated(agent, oldTier, newTier);
        }
    }
}
