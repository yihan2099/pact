// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import { Test, console } from "forge-std/Test.sol";
import { ClawboyAgentAdapter } from "../src/ClawboyAgentAdapter.sol";
import { ERC8004IdentityRegistry } from "../src/erc8004/ERC8004IdentityRegistry.sol";
import { ERC8004ReputationRegistry } from "../src/erc8004/ERC8004ReputationRegistry.sol";
import { TaskManager } from "../src/TaskManager.sol";
import { EscrowVault } from "../src/EscrowVault.sol";
import { DisputeResolver } from "../src/DisputeResolver.sol";

contract ClawboyAgentAdapterTest is Test {
    ClawboyAgentAdapter public agentAdapter;
    ERC8004IdentityRegistry public identityRegistry;
    ERC8004ReputationRegistry public reputationRegistry;
    TaskManager public taskManager;
    EscrowVault public escrowVault;
    DisputeResolver public disputeResolver;

    address public deployer;
    address public newOwner = address(0x999);
    address public randomUser = address(0x888);
    address public agent1 = address(0x1);
    address public agent2 = address(0x2);
    address public treasury = address(0x777);

    function setUp() public {
        deployer = address(this);

        // Deploy ERC-8004 IdentityRegistry
        identityRegistry = new ERC8004IdentityRegistry();

        // Deploy ERC-8004 ReputationRegistry
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

        // Configure access control via emergency functions (timelock not set in tests)
        taskManager.emergencySetDisputeResolver(address(disputeResolver));
        agentAdapter.emergencySetTaskManager(address(taskManager));
        agentAdapter.emergencySetDisputeResolver(address(disputeResolver));

        // Authorize adapter to call registerFor on IdentityRegistry
        identityRegistry.authorizeAdapter(address(agentAdapter));

        // Give accounts some ETH
        vm.deal(agent1, 10 ether);
        vm.deal(agent2, 10 ether);
    }

    /*//////////////////////////////////////////////////////////////
                      OWNERSHIP TRANSFER TESTS
    //////////////////////////////////////////////////////////////*/

    function test_TransferOwnership() public {
        // Verify initial owner
        assertEq(agentAdapter.owner(), deployer);
        assertEq(agentAdapter.pendingOwner(), address(0));

        // Current owner initiates transfer
        agentAdapter.transferOwnership(newOwner);
        assertEq(agentAdapter.pendingOwner(), newOwner);
        assertEq(agentAdapter.owner(), deployer); // Still old owner

        // Pending owner accepts
        vm.prank(newOwner);
        agentAdapter.acceptOwnership();

        assertEq(agentAdapter.owner(), newOwner);
        assertEq(agentAdapter.pendingOwner(), address(0));
    }

    function test_TransferOwnership_RevertIfNotOwner() public {
        vm.prank(randomUser);
        vm.expectRevert(ClawboyAgentAdapter.OnlyOwner.selector);
        agentAdapter.transferOwnership(randomUser);
    }

    function test_TransferOwnership_RevertIfZeroAddress() public {
        vm.expectRevert(ClawboyAgentAdapter.ZeroAddress.selector);
        agentAdapter.transferOwnership(address(0));
    }

    function test_AcceptOwnership_RevertIfNotPendingOwner() public {
        agentAdapter.transferOwnership(newOwner);

        vm.prank(randomUser);
        vm.expectRevert(ClawboyAgentAdapter.NotPendingOwner.selector);
        agentAdapter.acceptOwnership();
    }

    function test_TransferOwnership_OverwritesPending() public {
        address firstPending = address(0x111);
        address secondPending = address(0x222);

        // First transfer
        agentAdapter.transferOwnership(firstPending);
        assertEq(agentAdapter.pendingOwner(), firstPending);

        // Second transfer overwrites
        agentAdapter.transferOwnership(secondPending);
        assertEq(agentAdapter.pendingOwner(), secondPending);

        // First pending can no longer accept
        vm.prank(firstPending);
        vm.expectRevert(ClawboyAgentAdapter.NotPendingOwner.selector);
        agentAdapter.acceptOwnership();

        // Second pending can accept
        vm.prank(secondPending);
        agentAdapter.acceptOwnership();
        assertEq(agentAdapter.owner(), secondPending);
    }

    function test_TransferOwnership_EmitsEvents() public {
        // Test OwnershipTransferInitiated event
        vm.expectEmit(true, true, false, false);
        emit ClawboyAgentAdapter.OwnershipTransferInitiated(deployer, newOwner);
        agentAdapter.transferOwnership(newOwner);

        // Test OwnershipTransferred event
        vm.expectEmit(true, true, false, false);
        emit ClawboyAgentAdapter.OwnershipTransferred(deployer, newOwner);
        vm.prank(newOwner);
        agentAdapter.acceptOwnership();
    }

    /*//////////////////////////////////////////////////////////////
                      ACCESS CONTROL TESTS
    //////////////////////////////////////////////////////////////*/

    function test_SetTaskManager_RequiresTimelock() public {
        address newTaskManager = address(0x444);

        // Non-owner cannot use emergency function
        vm.prank(randomUser);
        vm.expectRevert(ClawboyAgentAdapter.OnlyOwner.selector);
        agentAdapter.emergencySetTaskManager(newTaskManager);

        // Direct call requires timelock (which isn't set, so reverts)
        vm.expectRevert(ClawboyAgentAdapter.OnlyTimelock.selector);
        agentAdapter.setTaskManager(newTaskManager);

        // Owner can use emergency function
        agentAdapter.emergencySetTaskManager(newTaskManager);
        assertEq(agentAdapter.taskManager(), newTaskManager);
    }

    function test_SetDisputeResolver_RequiresTimelock() public {
        address newDisputeResolver = address(0x555);

        // Non-owner cannot use emergency function
        vm.prank(randomUser);
        vm.expectRevert(ClawboyAgentAdapter.OnlyOwner.selector);
        agentAdapter.emergencySetDisputeResolver(newDisputeResolver);

        // Direct call requires timelock (which isn't set, so reverts)
        vm.expectRevert(ClawboyAgentAdapter.OnlyTimelock.selector);
        agentAdapter.setDisputeResolver(newDisputeResolver);

        // Owner can use emergency function
        agentAdapter.emergencySetDisputeResolver(newDisputeResolver);
        assertEq(agentAdapter.disputeResolver(), newDisputeResolver);
    }

    function test_RecordTaskWin_OnlyAuthorized() public {
        // Register agent first
        vm.prank(agent1);
        agentAdapter.register("ipfs://agent1-profile-cid");

        // Random user cannot call recordTaskWin
        vm.prank(randomUser);
        vm.expectRevert(ClawboyAgentAdapter.Unauthorized.selector);
        agentAdapter.recordTaskWin(agent1, 1);

        // TaskManager can call (authorized)
        vm.prank(address(taskManager));
        agentAdapter.recordTaskWin(agent1, 1);
    }

    function test_RecordDisputeWin_OnlyAuthorized() public {
        // Register agent first
        vm.prank(agent1);
        agentAdapter.register("ipfs://agent1-profile-cid");

        // Random user cannot call recordDisputeWin
        vm.prank(randomUser);
        vm.expectRevert(ClawboyAgentAdapter.Unauthorized.selector);
        agentAdapter.recordDisputeWin(agent1, 1);

        // TaskManager can call (authorized)
        vm.prank(address(taskManager));
        agentAdapter.recordDisputeWin(agent1, 1);
    }

    function test_RecordDisputeLoss_OnlyAuthorized() public {
        // Register agent first
        vm.prank(agent1);
        agentAdapter.register("ipfs://agent1-profile-cid");

        // Random user cannot call recordDisputeLoss
        vm.prank(randomUser);
        vm.expectRevert(ClawboyAgentAdapter.Unauthorized.selector);
        agentAdapter.recordDisputeLoss(agent1, 1);

        // DisputeResolver can call (authorized)
        vm.prank(address(disputeResolver));
        agentAdapter.recordDisputeLoss(agent1, 1);
    }

    /*//////////////////////////////////////////////////////////////
                      REGISTRATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Register() public {
        vm.prank(agent1);
        uint256 agentId = agentAdapter.register("ipfs://agent1-profile-cid");

        assertTrue(agentId > 0);
        assertTrue(agentAdapter.isRegistered(agent1));
        assertEq(agentAdapter.getAgentId(agent1), agentId);
    }

    function test_Register_RevertIfAlreadyRegistered() public {
        vm.prank(agent1);
        agentAdapter.register("ipfs://agent1-profile-cid");

        vm.prank(agent1);
        vm.expectRevert(ClawboyAgentAdapter.AlreadyRegistered.selector);
        agentAdapter.register("ipfs://another-profile-cid");
    }

    function test_UpdateProfile_RevertIfNotRegistered() public {
        vm.prank(agent1);
        vm.expectRevert(ClawboyAgentAdapter.NotRegistered.selector);
        agentAdapter.updateProfile("ipfs://new-profile-cid");
    }

    function test_UpdateProfile() public {
        vm.prank(agent1);
        agentAdapter.register("ipfs://agent1-profile-cid");

        vm.prank(agent1);
        agentAdapter.updateProfile("ipfs://updated-profile-cid");

        // Verify URI was updated
        uint256 agentId = agentAdapter.getAgentId(agent1);
        string memory newURI = identityRegistry.getAgentURI(agentId);
        assertEq(newURI, "ipfs://updated-profile-cid");
    }

    function test_UpdateProfile_RevertIfUnauthorizedAdapter() public {
        // Deploy unauthorized adapter (NOT calling authorizeAdapter)
        ClawboyAgentAdapter unauthorizedAdapter =
            new ClawboyAgentAdapter(address(identityRegistry), address(reputationRegistry));

        vm.prank(agent1);
        identityRegistry.register("ipfs://agent1-profile-cid");

        vm.prank(agent1);
        vm.expectRevert(ERC8004IdentityRegistry.NotAgentOwner.selector);
        unauthorizedAdapter.updateProfile("ipfs://hacked-profile-cid");
    }

    /*//////////////////////////////////////////////////////////////
                      REPUTATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_GetReputationSummary() public {
        vm.prank(agent1);
        agentAdapter.register("ipfs://agent1-profile-cid");

        // Initial reputation should be zeros
        (uint64 taskWins, uint64 disputeWins, uint64 disputeLosses, int256 totalRep) =
            agentAdapter.getReputationSummary(agent1);
        assertEq(taskWins, 0);
        assertEq(disputeWins, 0);
        assertEq(disputeLosses, 0);
        assertEq(totalRep, 0);

        // Record a task win
        vm.prank(address(taskManager));
        agentAdapter.recordTaskWin(agent1, 1);

        (taskWins, disputeWins, disputeLosses, totalRep) = agentAdapter.getReputationSummary(agent1);
        assertEq(taskWins, 1);
        assertEq(totalRep, 10); // TASK_WIN_VALUE = 10
    }

    function test_GetVoteWeight() public {
        vm.prank(agent1);
        agentAdapter.register("ipfs://agent1-profile-cid");

        // New agent should have minimum weight of 1
        assertEq(agentAdapter.getVoteWeight(agent1), 1);

        // Unregistered agent should have weight 0
        assertEq(agentAdapter.getVoteWeight(randomUser), 0);
    }

    function test_GetVoteWeight_IncreasesWithReputation() public {
        vm.prank(agent1);
        agentAdapter.register("ipfs://agent1-profile-cid");

        uint256 initialWeight = agentAdapter.getVoteWeight(agent1);

        // Add multiple task wins to increase reputation
        for (uint256 i = 0; i < 10; i++) {
            vm.prank(address(taskManager));
            agentAdapter.recordTaskWin(agent1, i + 1);
        }

        uint256 newWeight = agentAdapter.getVoteWeight(agent1);
        assertTrue(newWeight > initialWeight);
    }

    /*//////////////////////////////////////////////////////////////
                   EFFICIENT LOOKUP TESTS (getFeedbackCount)
    //////////////////////////////////////////////////////////////*/

    function test_GetVoteWeight_UsesEfficientLookup() public {
        vm.prank(agent1);
        agentAdapter.register("ipfs://agent1-profile-cid");

        // Record multiple task wins
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(address(taskManager));
            agentAdapter.recordTaskWin(agent1, i + 1);
        }

        // Verify weight calculation with multiple task wins
        // 5 task wins = 50 rep, log2(51) = 5
        uint256 weight = agentAdapter.getVoteWeight(agent1);
        assertEq(weight, 5);

        // Verify reputation summary matches
        (uint64 taskWins,,, int256 totalRep) = agentAdapter.getReputationSummary(agent1);
        assertEq(taskWins, 5);
        assertEq(totalRep, 50);
    }

    function test_GetVoteWeight_WithDisputeLosses() public {
        vm.prank(agent1);
        agentAdapter.register("ipfs://agent1-profile-cid");

        // Record 2 task wins (+20 rep)
        for (uint256 i = 0; i < 2; i++) {
            vm.prank(address(taskManager));
            agentAdapter.recordTaskWin(agent1, i + 1);
        }

        // Record 2 dispute losses (-40 rep)
        for (uint256 i = 0; i < 2; i++) {
            vm.prank(address(disputeResolver));
            agentAdapter.recordDisputeLoss(agent1, i + 1);
        }

        // Net reputation: 20 - 40 = -20, clamped to 0
        // Weight should be minimum (1) for registered agent
        uint256 weight = agentAdapter.getVoteWeight(agent1);
        assertEq(weight, 1);

        // Verify reputation summary
        (uint64 taskWins,, uint64 disputeLosses, int256 totalRep) =
            agentAdapter.getReputationSummary(agent1);
        assertEq(taskWins, 2);
        assertEq(disputeLosses, 2);
        assertEq(totalRep, -20); // Raw rep can be negative in summary
    }

    /*//////////////////////////////////////////////////////////////
                      VIEW FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_GetIdentityRegistry() public view {
        assertEq(agentAdapter.getIdentityRegistry(), address(identityRegistry));
    }

    function test_GetReputationRegistry() public view {
        assertEq(agentAdapter.getReputationRegistry(), address(reputationRegistry));
    }

    function test_IsRegistered_False() public view {
        assertFalse(agentAdapter.isRegistered(randomUser));
    }

    function test_GetAgentId_Zero() public view {
        assertEq(agentAdapter.getAgentId(randomUser), 0);
    }
}
