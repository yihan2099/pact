// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {TaskManager} from "../src/TaskManager.sol";
import {EscrowVault} from "../src/EscrowVault.sol";
import {PorterRegistry} from "../src/PorterRegistry.sol";
import {ITaskManager} from "../src/interfaces/ITaskManager.sol";

contract TaskManagerTest is Test {
    TaskManager public taskManager;
    EscrowVault public escrowVault;
    PorterRegistry public porterRegistry;

    address public creator = address(0x1);
    address public agent = address(0x2);

    uint256 public constant BOUNTY_AMOUNT = 1 ether;

    function setUp() public {
        // Deploy PorterRegistry first
        porterRegistry = new PorterRegistry();

        // Deploy EscrowVault with predicted TaskManager address
        address predictedTaskManager = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        escrowVault = new EscrowVault(predictedTaskManager);

        // Deploy TaskManager
        taskManager = new TaskManager(address(escrowVault), address(porterRegistry));

        // Configure access control (but NOT verificationHub - that's the point of the test)
        porterRegistry.setTaskManager(address(taskManager));

        // Give accounts some ETH
        vm.deal(creator, 10 ether);
        vm.deal(agent, 1 ether);

        // Register agent
        vm.prank(agent);
        porterRegistry.register("agent-profile-cid");
    }

    function test_placeholder() public {
        // Placeholder test to verify setup
        assertTrue(true);
    }

    function test_SubmitWork_RevertsIfVerificationHubNotSet() public {
        // Create task
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        // Agent claims task
        vm.prank(agent);
        taskManager.claimTask(taskId);

        // Agent tries to submit work, but verificationHub is not set
        vm.prank(agent);
        vm.expectRevert(TaskManager.VerificationHubNotSet.selector);
        taskManager.submitWork(taskId, "submission-cid");
    }
}
