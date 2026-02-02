// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IEscrowVault} from "./interfaces/IEscrowVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title EscrowVault
 * @notice Holds task bounties in escrow until task completion
 * @dev SECURITY: Uses ReentrancyGuard to prevent reentrancy attacks on ETH transfers
 */
contract EscrowVault is IEscrowVault, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Escrow {
        address token;
        uint256 amount;
        bool released;
    }

    // State
    mapping(uint256 => Escrow) private _escrows;
    address public immutable taskManager;

    // Errors
    error OnlyTaskManager();
    error EscrowNotFound();
    error EscrowAlreadyReleased();
    error InvalidAmount();
    error TransferFailed();

    modifier onlyTaskManager() {
        if (msg.sender != taskManager) revert OnlyTaskManager();
        _;
    }

    constructor(address _taskManager) {
        taskManager = _taskManager;
    }

    /**
     * @notice Deposit bounty for a task
     * @param taskId The task ID
     * @param token Token address (address(0) for ETH)
     * @param amount Amount to deposit
     */
    function deposit(uint256 taskId, address token, uint256 amount) external payable onlyTaskManager {
        if (amount == 0) revert InvalidAmount();

        if (token == address(0)) {
            // ETH deposit
            if (msg.value != amount) revert InvalidAmount();
        } else {
            // ERC20 deposit
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        _escrows[taskId] = Escrow({token: token, amount: amount, released: false});

        emit Deposited(taskId, token, amount);
    }

    /**
     * @notice Release bounty to the recipient (agent)
     * @param taskId The task ID
     * @param recipient The address to receive the bounty
     * @dev SECURITY: nonReentrant prevents reentrancy attacks on ETH transfers
     */
    function release(uint256 taskId, address recipient) external onlyTaskManager nonReentrant {
        Escrow storage escrow = _escrows[taskId];
        if (escrow.amount == 0) revert EscrowNotFound();
        if (escrow.released) revert EscrowAlreadyReleased();

        escrow.released = true;

        if (escrow.token == address(0)) {
            // ETH transfer
            (bool success,) = recipient.call{value: escrow.amount}("");
            if (!success) revert TransferFailed();
        } else {
            // ERC20 transfer
            IERC20(escrow.token).safeTransfer(recipient, escrow.amount);
        }

        emit Released(taskId, recipient, escrow.amount);
    }

    /**
     * @notice Refund bounty to the creator (on cancellation)
     * @param taskId The task ID
     * @param creator The address to receive the refund
     * @dev SECURITY: nonReentrant prevents reentrancy attacks on ETH transfers
     */
    function refund(uint256 taskId, address creator) external onlyTaskManager nonReentrant {
        Escrow storage escrow = _escrows[taskId];
        if (escrow.amount == 0) revert EscrowNotFound();
        if (escrow.released) revert EscrowAlreadyReleased();

        escrow.released = true;

        if (escrow.token == address(0)) {
            // ETH transfer
            (bool success,) = creator.call{value: escrow.amount}("");
            if (!success) revert TransferFailed();
        } else {
            // ERC20 transfer
            IERC20(escrow.token).safeTransfer(creator, escrow.amount);
        }

        emit Refunded(taskId, creator, escrow.amount);
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
