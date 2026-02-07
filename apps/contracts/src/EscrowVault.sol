// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import { IEscrowVault } from "./interfaces/IEscrowVault.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title EscrowVault
 * @notice Holds task bounties in escrow until task completion
 * @dev SECURITY: Uses ReentrancyGuard to prevent reentrancy attacks on ETH transfers
 */
contract EscrowVault is IEscrowVault, ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    struct Escrow {
        address token;
        uint256 amount;
        bool released;
    }

    // Constants
    uint256 public constant MAX_FEE_BPS = 1000; // 10%

    // State
    mapping(uint256 => Escrow) private _escrows;
    address public immutable taskManager;
    uint256 public protocolFeeBps; // default 300 = 3%
    address public protocolTreasury;
    mapping(address => uint256) public accumulatedFees; // token => total fees collected

    // Errors
    error OnlyTaskManager();
    error EscrowNotFound();
    error EscrowAlreadyReleased();
    error InvalidAmount();
    error TransferFailed();
    error FeeTooHigh();
    error InvalidTreasury();

    modifier onlyTaskManager() {
        if (msg.sender != taskManager) revert OnlyTaskManager();
        _;
    }

    constructor(
        address _taskManager,
        address _treasury,
        uint256 _initialFeeBps
    )
        Ownable(msg.sender)
    {
        if (_treasury == address(0)) revert InvalidTreasury();
        if (_initialFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        taskManager = _taskManager;
        protocolTreasury = _treasury;
        protocolFeeBps = _initialFeeBps;
    }

    /**
     * @notice Deposit bounty for a task
     * @param taskId The task ID
     * @param token Token address (address(0) for ETH)
     * @param amount Amount to deposit
     */
    function deposit(
        uint256 taskId,
        address token,
        uint256 amount
    )
        external
        payable
        onlyTaskManager
        whenNotPaused
    {
        if (amount == 0) revert InvalidAmount();

        if (token == address(0)) {
            // ETH deposit
            if (msg.value != amount) revert InvalidAmount();
        } else {
            // ERC20 deposit
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        _escrows[taskId] = Escrow({ token: token, amount: amount, released: false });

        emit Deposited(taskId, token, amount);
    }

    /**
     * @notice Deposit ERC20 bounty for a task from a specific address
     * @param taskId The task ID
     * @param token Token address (must not be address(0))
     * @param amount Amount to deposit
     * @param from Address to transfer tokens from (must have approved this contract)
     */
    function depositFrom(
        uint256 taskId,
        address token,
        uint256 amount,
        address from
    )
        external
        onlyTaskManager
    {
        if (amount == 0) revert InvalidAmount();
        if (token == address(0)) revert InvalidAmount(); // Use deposit() for ETH

        // ERC20 deposit from specified address
        IERC20(token).safeTransferFrom(from, address(this), amount);

        _escrows[taskId] = Escrow({ token: token, amount: amount, released: false });

        emit Deposited(taskId, token, amount);
    }

    /**
     * @notice Release bounty to the recipient (agent), deducting protocol fee
     * @param taskId The task ID
     * @param recipient The address to receive the bounty
     * @dev SECURITY: nonReentrant prevents reentrancy attacks on ETH transfers
     */
    function release(
        uint256 taskId,
        address recipient
    )
        external
        onlyTaskManager
        nonReentrant
        whenNotPaused
    {
        Escrow storage escrow = _escrows[taskId];
        if (escrow.amount == 0) revert EscrowNotFound();
        if (escrow.released) revert EscrowAlreadyReleased();

        escrow.released = true;

        uint256 totalAmount = escrow.amount;
        uint256 feeAmount = (totalAmount * protocolFeeBps) / 10_000;
        uint256 netAmount = totalAmount - feeAmount;

        if (escrow.token == address(0)) {
            // ETH transfers
            if (feeAmount > 0) {
                (bool feeSuccess,) = protocolTreasury.call{ value: feeAmount }("");
                if (!feeSuccess) revert TransferFailed();
            }
            (bool success,) = recipient.call{ value: netAmount }("");
            if (!success) revert TransferFailed();
        } else {
            // ERC20 transfers
            if (feeAmount > 0) {
                IERC20(escrow.token).safeTransfer(protocolTreasury, feeAmount);
            }
            IERC20(escrow.token).safeTransfer(recipient, netAmount);
        }

        if (feeAmount > 0) {
            accumulatedFees[escrow.token] += feeAmount;
            emit ProtocolFeeCollected(taskId, escrow.token, feeAmount, protocolTreasury);
        }

        emit Released(taskId, recipient, netAmount, feeAmount);
    }

    /**
     * @notice Refund bounty to the creator (on cancellation)
     * @param taskId The task ID
     * @param creator The address to receive the refund
     * @dev SECURITY: nonReentrant prevents reentrancy attacks on ETH transfers
     * @dev No fee is charged on refunds
     */
    function refund(
        uint256 taskId,
        address creator
    )
        external
        onlyTaskManager
        nonReentrant
        whenNotPaused
    {
        Escrow storage escrow = _escrows[taskId];
        if (escrow.amount == 0) revert EscrowNotFound();
        if (escrow.released) revert EscrowAlreadyReleased();

        escrow.released = true;

        if (escrow.token == address(0)) {
            // ETH transfer
            (bool success,) = creator.call{ value: escrow.amount }("");
            if (!success) revert TransferFailed();
        } else {
            // ERC20 transfer
            IERC20(escrow.token).safeTransfer(creator, escrow.amount);
        }

        emit Refunded(taskId, creator, escrow.amount);
    }

    /**
     * @notice Set the protocol fee in basis points
     * @param newFeeBps The new fee in basis points (max 1000 = 10%)
     */
    function setProtocolFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        uint256 oldFeeBps = protocolFeeBps;
        protocolFeeBps = newFeeBps;
        emit ProtocolFeeUpdated(oldFeeBps, newFeeBps);
    }

    /**
     * @notice Set the protocol treasury address
     * @param newTreasury The new treasury address
     */
    function setProtocolTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidTreasury();
        address oldTreasury = protocolTreasury;
        protocolTreasury = newTreasury;
        emit ProtocolTreasuryUpdated(oldTreasury, newTreasury);
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
     * @notice Get the balance of an escrow
     * @param taskId The task ID
     * @return token The token address
     * @return amount The escrowed amount
     */
    function getBalance(uint256 taskId) external view returns (address token, uint256 amount) {
        Escrow storage escrow = _escrows[taskId];
        if (escrow.released) {
            return (escrow.token, 0);
        }
        return (escrow.token, escrow.amount);
    }
}
