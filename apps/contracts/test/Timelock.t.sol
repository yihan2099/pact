// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import { Test, console } from "forge-std/Test.sol";
import { TaskManager } from "../src/TaskManager.sol";
import { EscrowVault } from "../src/EscrowVault.sol";
import { DisputeResolver } from "../src/DisputeResolver.sol";
import { ClawboyAgentAdapter } from "../src/ClawboyAgentAdapter.sol";
import { ERC8004IdentityRegistry } from "../src/erc8004/ERC8004IdentityRegistry.sol";
import { ERC8004ReputationRegistry } from "../src/erc8004/ERC8004ReputationRegistry.sol";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
import { IDisputeResolver } from "../src/interfaces/IDisputeResolver.sol";

contract TimelockTest is Test {
    TaskManager public taskManager;
    EscrowVault public escrowVault;
    DisputeResolver public disputeResolver;
    ClawboyAgentAdapter public agentAdapter;
    ERC8004IdentityRegistry public identityRegistry;
    ERC8004ReputationRegistry public reputationRegistry;
    TimelockController public timelock;

    address public deployer;
    address public randomUser = address(0x888);
    address public agent1 = address(0x1);
    address public creator = address(0x2);
    address public treasury = address(0x777);

    uint256 public constant TIMELOCK_DELAY = 48 hours;

    function setUp() public {
        deployer = address(this);

        // Deploy ERC-8004 registries
        identityRegistry = new ERC8004IdentityRegistry();
        reputationRegistry = new ERC8004ReputationRegistry(address(identityRegistry));

        // Deploy ClawboyAgentAdapter
        agentAdapter =
            new ClawboyAgentAdapter(address(identityRegistry), address(reputationRegistry));

        // Deploy EscrowVault with predicted TaskManager address
        address predictedTaskManager =
            vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        escrowVault = new EscrowVault(predictedTaskManager, treasury, 300);

        // Deploy TaskManager
        taskManager = new TaskManager(address(escrowVault), address(agentAdapter));

        // Deploy DisputeResolver
        disputeResolver = new DisputeResolver(address(taskManager), address(agentAdapter));

        // Deploy TimelockController
        address[] memory proposers = new address[](1);
        proposers[0] = deployer;
        address[] memory executors = new address[](1);
        executors[0] = deployer;

        timelock = new TimelockController(TIMELOCK_DELAY, proposers, executors, deployer);

        // Configure timelock on all contracts
        taskManager.setTimelock(address(timelock));
        agentAdapter.setTimelock(address(timelock));
        disputeResolver.setTimelock(address(timelock));

        // Configure initial access control via emergency functions
        taskManager.emergencySetDisputeResolver(address(disputeResolver));
        agentAdapter.emergencySetTaskManager(address(taskManager));
        agentAdapter.emergencySetDisputeResolver(address(disputeResolver));

        // Authorize adapter
        identityRegistry.authorizeAdapter(address(agentAdapter));

        // Give accounts some ETH
        vm.deal(agent1, 10 ether);
        vm.deal(creator, 10 ether);
    }

    /*//////////////////////////////////////////////////////////////
                      TASKMANAGER TIMELOCK TESTS
    //////////////////////////////////////////////////////////////*/

    function test_TaskManager_SetDisputeResolver_RequiresTimelock() public {
        address newResolver = address(0x111);

        // Direct call should revert
        vm.expectRevert(TaskManager.OnlyTimelock.selector);
        taskManager.setDisputeResolver(newResolver);
    }

    function test_TaskManager_SetDisputeResolver_ViaTimelock() public {
        address newResolver = address(0x111);

        // Schedule the operation
        bytes memory data =
            abi.encodeWithSelector(TaskManager.setDisputeResolver.selector, newResolver);

        timelock.schedule(address(taskManager), 0, data, bytes32(0), bytes32(0), TIMELOCK_DELAY);

        // Try to execute before delay - should fail
        vm.expectRevert();
        timelock.execute(address(taskManager), 0, data, bytes32(0), bytes32(0));

        // Warp time past delay
        vm.warp(block.timestamp + TIMELOCK_DELAY + 1);

        // Execute should succeed now
        timelock.execute(address(taskManager), 0, data, bytes32(0), bytes32(0));

        // Verify the change
        assertEq(address(taskManager.disputeResolver()), newResolver);
    }

    function test_TaskManager_SetAgentAdapter_RequiresTimelock() public {
        address newAdapter = address(0x222);

        // Direct call should revert
        vm.expectRevert(TaskManager.OnlyTimelock.selector);
        taskManager.setAgentAdapter(newAdapter);
    }

    function test_TaskManager_EmergencySetDisputeResolver_OnlyOwner() public {
        address newResolver = address(0x333);

        // Random user cannot call emergency function
        vm.prank(randomUser);
        vm.expectRevert(TaskManager.OnlyOwner.selector);
        taskManager.emergencySetDisputeResolver(newResolver);

        // Owner can call
        taskManager.emergencySetDisputeResolver(newResolver);
        assertEq(address(taskManager.disputeResolver()), newResolver);
    }

    function test_TaskManager_EmergencySetAgentAdapter_OnlyOwner() public {
        address newAdapter = address(0x444);

        // Random user cannot call emergency function
        vm.prank(randomUser);
        vm.expectRevert(TaskManager.OnlyOwner.selector);
        taskManager.emergencySetAgentAdapter(newAdapter);

        // Owner can call
        taskManager.emergencySetAgentAdapter(newAdapter);
        assertEq(address(taskManager.agentAdapter()), newAdapter);
    }

    function test_TaskManager_EmergencyBypassEmitsEvent() public {
        address newResolver = address(0x555);

        vm.expectEmit(true, true, false, false);
        emit TaskManager.EmergencyBypassUsed(deployer, TaskManager.setDisputeResolver.selector);
        taskManager.emergencySetDisputeResolver(newResolver);
    }

    /*//////////////////////////////////////////////////////////////
                      DISPUTERESOLVER TIMELOCK TESTS
    //////////////////////////////////////////////////////////////*/

    function test_DisputeResolver_CancelDispute_RequiresTimelock() public {
        // Create a dispute first
        _createDispute();

        // Direct call should revert
        vm.expectRevert(DisputeResolver.OnlyTimelock.selector);
        disputeResolver.cancelDispute(1);
    }

    function test_DisputeResolver_WithdrawSlashedStakes_RequiresTimelock() public {
        // Direct call should revert
        vm.expectRevert(DisputeResolver.OnlyTimelock.selector);
        disputeResolver.withdrawSlashedStakes(deployer, 1 ether);
    }

    function test_DisputeResolver_EmergencyCancelDispute_OnlyOwner() public {
        // Create a dispute first
        _createDispute();

        // Random user cannot call emergency function
        vm.prank(randomUser);
        vm.expectRevert(DisputeResolver.OnlyOwner.selector);
        disputeResolver.emergencyCancelDispute(1);

        // Owner can call
        disputeResolver.emergencyCancelDispute(1);

        // Verify dispute is cancelled
        assertEq(
            uint256(disputeResolver.getDispute(1).status),
            uint256(IDisputeResolver.DisputeStatus.Cancelled)
        );
    }

    function test_DisputeResolver_EmergencyWithdrawSlashedStakes_OnlyOwner() public {
        // We need to have some slashed stakes first
        // This requires a full dispute resolution flow where disputer loses
        // For simplicity, we just test access control

        // Random user cannot call
        vm.prank(randomUser);
        vm.expectRevert(DisputeResolver.OnlyOwner.selector);
        disputeResolver.emergencyWithdrawSlashedStakes(deployer, 0);
    }

    function test_DisputeResolver_EmergencyBypassEmitsEvent() public {
        _createDispute();

        vm.expectEmit(true, true, false, false);
        emit DisputeResolver.EmergencyBypassUsed(deployer, DisputeResolver.cancelDispute.selector);
        disputeResolver.emergencyCancelDispute(1);
    }

    /*//////////////////////////////////////////////////////////////
                      CLAWBOYAGENTADAPTER TIMELOCK TESTS
    //////////////////////////////////////////////////////////////*/

    function test_AgentAdapter_SetTaskManager_RequiresTimelock() public {
        address newTaskManager = address(0x666);

        // Direct call should revert
        vm.expectRevert(ClawboyAgentAdapter.OnlyTimelock.selector);
        agentAdapter.setTaskManager(newTaskManager);
    }

    function test_AgentAdapter_SetDisputeResolver_RequiresTimelock() public {
        address newResolver = address(0x777);

        // Direct call should revert
        vm.expectRevert(ClawboyAgentAdapter.OnlyTimelock.selector);
        agentAdapter.setDisputeResolver(newResolver);
    }

    function test_AgentAdapter_SetTaskManager_ViaTimelock() public {
        address newTaskManager = address(0x888);

        // Schedule the operation
        bytes memory data =
            abi.encodeWithSelector(ClawboyAgentAdapter.setTaskManager.selector, newTaskManager);

        timelock.schedule(address(agentAdapter), 0, data, bytes32(0), bytes32(0), TIMELOCK_DELAY);

        // Warp time past delay
        vm.warp(block.timestamp + TIMELOCK_DELAY + 1);

        // Execute
        timelock.execute(address(agentAdapter), 0, data, bytes32(0), bytes32(0));

        // Verify
        assertEq(agentAdapter.taskManager(), newTaskManager);
    }

    function test_AgentAdapter_EmergencyFunctions_OnlyOwner() public {
        address newAddr = address(0x999);

        // Random user cannot call emergency functions
        vm.startPrank(randomUser);
        vm.expectRevert(ClawboyAgentAdapter.OnlyOwner.selector);
        agentAdapter.emergencySetTaskManager(newAddr);

        vm.expectRevert(ClawboyAgentAdapter.OnlyOwner.selector);
        agentAdapter.emergencySetDisputeResolver(newAddr);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                      TIMELOCK DELAY ENFORCEMENT TESTS
    //////////////////////////////////////////////////////////////*/

    function test_TimelockDelayEnforced() public {
        address newResolver = address(0xAAA);
        bytes memory data =
            abi.encodeWithSelector(TaskManager.setDisputeResolver.selector, newResolver);

        // Start at a known timestamp
        vm.warp(1000);
        uint256 scheduleTime = block.timestamp;

        // Schedule the operation
        timelock.schedule(address(taskManager), 0, data, bytes32(0), bytes32(0), TIMELOCK_DELAY);

        // Try to execute immediately - should fail
        vm.expectRevert();
        timelock.execute(address(taskManager), 0, data, bytes32(0), bytes32(0));

        // Try at half the delay - should still fail
        vm.warp(scheduleTime + TIMELOCK_DELAY / 2);
        vm.expectRevert();
        timelock.execute(address(taskManager), 0, data, bytes32(0), bytes32(0));

        // At exactly the delay from schedule time - should succeed
        // OZ TimelockController is ready when block.timestamp >= timestamp + delay
        vm.warp(scheduleTime + TIMELOCK_DELAY);
        timelock.execute(address(taskManager), 0, data, bytes32(0), bytes32(0));

        // Verify the change was applied
        assertEq(address(taskManager.disputeResolver()), newResolver);
    }

    function test_SetTimelock_OnlyOwner() public {
        address newTimelock = address(0xBBB);

        // Random user cannot set timelock
        vm.prank(randomUser);
        vm.expectRevert(TaskManager.OnlyOwner.selector);
        taskManager.setTimelock(newTimelock);

        vm.prank(randomUser);
        vm.expectRevert(ClawboyAgentAdapter.OnlyOwner.selector);
        agentAdapter.setTimelock(newTimelock);

        vm.prank(randomUser);
        vm.expectRevert(DisputeResolver.OnlyOwner.selector);
        disputeResolver.setTimelock(newTimelock);
    }

    function test_SetTimelock_RevertOnZeroAddress() public {
        vm.expectRevert(TaskManager.ZeroAddress.selector);
        taskManager.setTimelock(address(0));

        vm.expectRevert(ClawboyAgentAdapter.ZeroAddress.selector);
        agentAdapter.setTimelock(address(0));

        vm.expectRevert(DisputeResolver.ZeroAddress.selector);
        disputeResolver.setTimelock(address(0));
    }

    /*//////////////////////////////////////////////////////////////
                            HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _createDispute() internal {
        // Register agent
        vm.prank(agent1);
        agentAdapter.register("ipfs://agent1");

        // Create task
        vm.prank(creator);
        taskManager.createTask{ value: 1 ether }("ipfs://task-spec", address(0), 1 ether, 0);

        // Submit work
        vm.prank(agent1);
        taskManager.submitWork(1, "ipfs://submission");

        // Creator rejects all
        vm.prank(creator);
        taskManager.rejectAll(1, "Not good enough");

        // Agent starts dispute
        uint256 stake = disputeResolver.calculateDisputeStake(1 ether);
        vm.prank(agent1);
        disputeResolver.startDispute{ value: stake }(1);
    }
}
