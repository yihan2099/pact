// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { TaskManager } from "../src/TaskManager.sol";
import { EscrowVault } from "../src/EscrowVault.sol";
import { ClawboyAgentAdapter } from "../src/ClawboyAgentAdapter.sol";
import { ERC8004IdentityRegistry } from "../src/erc8004/ERC8004IdentityRegistry.sol";
import { ERC8004ReputationRegistry } from "../src/erc8004/ERC8004ReputationRegistry.sol";
import { DisputeResolver } from "../src/DisputeResolver.sol";
import { ITaskManager } from "../src/interfaces/ITaskManager.sol";
import { IDisputeResolver } from "../src/interfaces/IDisputeResolver.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract PausableTest is Test {
    TaskManager public taskManager;
    EscrowVault public escrowVault;
    ClawboyAgentAdapter public agentAdapter;
    ERC8004IdentityRegistry public identityRegistry;
    ERC8004ReputationRegistry public reputationRegistry;
    DisputeResolver public disputeResolver;

    address public creator = address(0x1);
    address public agent1 = address(0x2);
    address public agent2 = address(0x3);
    address public voter1 = address(0x4);
    address public voter2 = address(0x5);
    address public treasury = address(0x7);
    address public nonOwner = address(0x99);

    uint256 public constant BOUNTY_AMOUNT = 1 ether;

    function setUp() public {
        identityRegistry = new ERC8004IdentityRegistry();
        reputationRegistry = new ERC8004ReputationRegistry(address(identityRegistry));
        agentAdapter =
            new ClawboyAgentAdapter(address(identityRegistry), address(reputationRegistry));

        address predictedTaskManager =
            vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        escrowVault = new EscrowVault(predictedTaskManager, treasury, 300);

        taskManager = new TaskManager(address(escrowVault), address(agentAdapter));
        disputeResolver = new DisputeResolver(address(taskManager), address(agentAdapter));

        taskManager.emergencySetDisputeResolver(address(disputeResolver));
        agentAdapter.emergencySetTaskManager(address(taskManager));
        agentAdapter.emergencySetDisputeResolver(address(disputeResolver));

        identityRegistry.authorizeAdapter(address(agentAdapter));

        vm.deal(creator, 10 ether);
        vm.deal(agent1, 1 ether);
        vm.deal(agent2, 1 ether);
        vm.deal(voter1, 1 ether);
        vm.deal(voter2, 1 ether);

        vm.prank(agent1);
        agentAdapter.register("ipfs://agent1-profile-cid");

        vm.prank(agent2);
        agentAdapter.register("ipfs://agent2-profile-cid");

        vm.prank(voter1);
        agentAdapter.register("ipfs://voter1-profile-cid");

        vm.prank(voter2);
        agentAdapter.register("ipfs://voter2-profile-cid");

        // Give voters some reputation
        _giveVoterReputation(voter1, 5);
        _giveVoterReputation(voter2, 5);
    }

    function _giveVoterReputation(address voter, uint256 taskWinCount) internal {
        for (uint256 i = 0; i < taskWinCount; i++) {
            vm.prank(address(taskManager));
            agentAdapter.recordTaskWin(voter, i + 1000);
        }
    }

    /*//////////////////////////////////////////////////////////////
                    TASKMANAGER: PAUSE / UNPAUSE ACCESS
    //////////////////////////////////////////////////////////////*/

    function test_TaskManager_PauseOnlyOwner() public {
        taskManager.pause();
        assertTrue(taskManager.paused());
    }

    function test_TaskManager_PauseRevertIfNotOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert(TaskManager.OnlyOwner.selector);
        taskManager.pause();
    }

    function test_TaskManager_UnpauseOnlyOwner() public {
        taskManager.pause();
        taskManager.unpause();
        assertFalse(taskManager.paused());
    }

    function test_TaskManager_UnpauseRevertIfNotOwner() public {
        taskManager.pause();

        vm.prank(nonOwner);
        vm.expectRevert(TaskManager.OnlyOwner.selector);
        taskManager.unpause();
    }

    /*//////////////////////////////////////////////////////////////
                TASKMANAGER: PAUSED STATE BLOCKS FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function test_TaskManager_CreateTaskBlockedWhenPaused() public {
        taskManager.pause();

        vm.prank(creator);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
        );
    }

    function test_TaskManager_SubmitWorkBlockedWhenPaused() public {
        // Create task before pausing
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        taskManager.pause();

        vm.prank(agent1);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        taskManager.submitWork(taskId, "submission-cid");
    }

    function test_TaskManager_SelectWinnerBlockedWhenPaused() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        taskManager.pause();

        vm.prank(creator);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        taskManager.selectWinner(taskId, agent1);
    }

    function test_TaskManager_RejectAllBlockedWhenPaused() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        taskManager.pause();

        vm.prank(creator);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        taskManager.rejectAll(taskId, "reason");
    }

    function test_TaskManager_FinalizeTaskBlockedWhenPaused() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        vm.prank(creator);
        taskManager.selectWinner(taskId, agent1);

        vm.warp(block.timestamp + 48 hours + 1);

        taskManager.pause();

        vm.expectRevert(Pausable.EnforcedPause.selector);
        taskManager.finalizeTask(taskId);
    }

    /*//////////////////////////////////////////////////////////////
              TASKMANAGER: UNPAUSING RESTORES FUNCTIONALITY
    //////////////////////////////////////////////////////////////*/

    function test_TaskManager_UnpauseRestoresFunctionality() public {
        taskManager.pause();
        taskManager.unpause();

        // createTask should work again
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
        );
        assertEq(taskId, 1);

        // submitWork should work again
        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");
        assertTrue(taskManager.hasSubmitted(taskId, agent1));

        // selectWinner should work again
        vm.prank(creator);
        taskManager.selectWinner(taskId, agent1);

        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.InReview));

        // finalizeTask should work again
        vm.warp(block.timestamp + 48 hours + 1);
        taskManager.finalizeTask(taskId);

        task = taskManager.getTask(taskId);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.Completed));
    }

    /*//////////////////////////////////////////////////////////////
                    ESCROWVAULT: PAUSE / UNPAUSE ACCESS
    //////////////////////////////////////////////////////////////*/

    function test_EscrowVault_PauseOnlyOwner() public {
        escrowVault.pause();
        assertTrue(escrowVault.paused());
    }

    function test_EscrowVault_PauseRevertIfNotOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, nonOwner)
        );
        escrowVault.pause();
    }

    function test_EscrowVault_UnpauseOnlyOwner() public {
        escrowVault.pause();
        escrowVault.unpause();
        assertFalse(escrowVault.paused());
    }

    function test_EscrowVault_UnpauseRevertIfNotOwner() public {
        escrowVault.pause();

        vm.prank(nonOwner);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, nonOwner)
        );
        escrowVault.unpause();
    }

    /*//////////////////////////////////////////////////////////////
              ESCROWVAULT: PAUSED STATE BLOCKS FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function test_EscrowVault_DepositBlockedWhenPaused() public {
        escrowVault.pause();

        // TaskManager calling deposit should fail when escrowVault is paused
        vm.prank(creator);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
        );
    }

    function test_EscrowVault_ReleaseBlockedWhenPaused() public {
        // Create task and set up for finalization
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        vm.prank(creator);
        taskManager.selectWinner(taskId, agent1);

        vm.warp(block.timestamp + 48 hours + 1);

        // Pause escrow vault
        escrowVault.pause();

        // FinalizeTask calls release on escrowVault, which should revert
        vm.expectRevert(Pausable.EnforcedPause.selector);
        taskManager.finalizeTask(taskId);
    }

    function test_EscrowVault_RefundBlockedWhenPaused() public {
        // Create task with no submissions
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        // Pause escrow vault
        escrowVault.pause();

        // CancelTask calls refund on escrowVault, which should revert
        vm.prank(creator);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        taskManager.cancelTask(taskId);
    }

    /*//////////////////////////////////////////////////////////////
            ESCROWVAULT: UNPAUSING RESTORES FUNCTIONALITY
    //////////////////////////////////////////////////////////////*/

    function test_EscrowVault_UnpauseRestoresFunctionality() public {
        escrowVault.pause();
        escrowVault.unpause();

        // deposit should work (via createTask)
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        (address token, uint256 amount) = escrowVault.getBalance(taskId);
        assertEq(token, address(0));
        assertEq(amount, BOUNTY_AMOUNT);
    }

    /*//////////////////////////////////////////////////////////////
                DISPUTERESOLVER: PAUSE / UNPAUSE ACCESS
    //////////////////////////////////////////////////////////////*/

    function test_DisputeResolver_PauseOnlyOwner() public {
        disputeResolver.pause();
        assertTrue(disputeResolver.paused());
    }

    function test_DisputeResolver_PauseRevertIfNotOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert(DisputeResolver.OnlyOwner.selector);
        disputeResolver.pause();
    }

    function test_DisputeResolver_UnpauseOnlyOwner() public {
        disputeResolver.pause();
        disputeResolver.unpause();
        assertFalse(disputeResolver.paused());
    }

    function test_DisputeResolver_UnpauseRevertIfNotOwner() public {
        disputeResolver.pause();

        vm.prank(nonOwner);
        vm.expectRevert(DisputeResolver.OnlyOwner.selector);
        disputeResolver.unpause();
    }

    /*//////////////////////////////////////////////////////////////
          DISPUTERESOLVER: PAUSED STATE BLOCKS FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function test_DisputeResolver_StartDisputeBlockedWhenPaused() public {
        // Set up a task in InReview state
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        // Pause dispute resolver
        disputeResolver.pause();

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);

        vm.prank(agent1);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        disputeResolver.startDispute{ value: stake }(taskId);
    }

    function test_DisputeResolver_SubmitVoteBlockedWhenPaused() public {
        // Set up an active dispute
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);

        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{ value: stake }(taskId);

        // Pause dispute resolver
        disputeResolver.pause();

        vm.prank(voter1);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        disputeResolver.submitVote(disputeId, true);
    }

    /*//////////////////////////////////////////////////////////////
       DISPUTERESOLVER: resolveDispute WORKS WHEN PAUSED
    //////////////////////////////////////////////////////////////*/

    function test_DisputeResolver_ResolveDisputeWorksWhenPaused() public {
        // Set up an active dispute
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);

        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{ value: stake }(taskId);

        // Vote before pausing
        vm.prank(voter1);
        disputeResolver.submitVote(disputeId, false);

        vm.prank(voter2);
        disputeResolver.submitVote(disputeId, false);

        // Warp past voting deadline
        vm.warp(block.timestamp + 48 hours + 1);

        // Pause dispute resolver
        disputeResolver.pause();

        // resolveDispute should still work when paused
        disputeResolver.resolveDispute(disputeId);

        IDisputeResolver.Dispute memory dispute = disputeResolver.getDispute(disputeId);
        assertEq(uint256(dispute.status), uint256(IDisputeResolver.DisputeStatus.Resolved));
    }

    /*//////////////////////////////////////////////////////////////
        DISPUTERESOLVER: UNPAUSING RESTORES FUNCTIONALITY
    //////////////////////////////////////////////////////////////*/

    function test_DisputeResolver_UnpauseRestoresFunctionality() public {
        // Set up a task in InReview state
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        // Pause and then unpause
        disputeResolver.pause();
        disputeResolver.unpause();

        // startDispute should work again
        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);

        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{ value: stake }(taskId);
        assertEq(disputeId, 1);

        // submitVote should work again
        vm.prank(voter1);
        disputeResolver.submitVote(disputeId, true);
        assertTrue(disputeResolver.hasVoted(disputeId, voter1));
    }

    /*//////////////////////////////////////////////////////////////
               CROSS-CONTRACT PAUSE INDEPENDENCE
    //////////////////////////////////////////////////////////////*/

    function test_PausingTaskManagerDoesNotPauseEscrowVault() public {
        taskManager.pause();
        assertFalse(escrowVault.paused());
    }

    function test_PausingEscrowVaultDoesNotPauseTaskManager() public {
        escrowVault.pause();
        assertFalse(taskManager.paused());
    }

    function test_PausingDisputeResolverDoesNotPauseOthers() public {
        disputeResolver.pause();
        assertFalse(taskManager.paused());
        assertFalse(escrowVault.paused());
    }
}
