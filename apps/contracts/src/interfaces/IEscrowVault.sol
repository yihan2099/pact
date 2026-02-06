// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/**
 * @title IEscrowVault
 * @notice Interface for the EscrowVault contract
 */
interface IEscrowVault {
    event Deposited(uint256 indexed taskId, address indexed token, uint256 amount);

    event Released(
        uint256 indexed taskId, address indexed recipient, uint256 netAmount, uint256 feeAmount
    );

    event Refunded(uint256 indexed taskId, address indexed creator, uint256 amount);

    event ProtocolFeeCollected(
        uint256 indexed taskId, address indexed token, uint256 feeAmount, address treasury
    );

    event ProtocolFeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);

    event ProtocolTreasuryUpdated(address oldTreasury, address newTreasury);

    function deposit(uint256 taskId, address token, uint256 amount) external payable;

    function depositFrom(uint256 taskId, address token, uint256 amount, address from) external;

    function release(uint256 taskId, address recipient) external;

    function refund(uint256 taskId, address creator) external;

    function getBalance(uint256 taskId) external view returns (address token, uint256 amount);

    function taskManager() external view returns (address);

    function protocolFeeBps() external view returns (uint256);

    function protocolTreasury() external view returns (address);

    function accumulatedFees(address token) external view returns (uint256);

    function setProtocolFee(uint256 newFeeBps) external;

    function setProtocolTreasury(address newTreasury) external;
}
