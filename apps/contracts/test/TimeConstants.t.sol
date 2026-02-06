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

contract TimeConstantsTest is Test {
    TaskManager public taskManager;
    EscrowVault public escrowVault;
    ClawboyAgentAdapter public agentAdapter;
    ERC8004IdentityRegistry public identityRegistry;
    ERC8004ReputationRegistry public reputationRegistry;
    DisputeResolver public disputeResolver;

    address public creator = address(0x1);
    address public agent1 = address(0x2);
    address public agent2 = address(0x3);
    address public nonOwner = address(0x99);

    uint256 public constant BOUNTY_AMOUNT = 1 ether;

    function setUp() public {
        identityRegistry = new ERC8004IdentityRegistry();
        reputationRegistry = new ERC8004ReputationRegistry(address(identityRegistry));
        agentAdapter =
            new ClawboyAgentAdapter(address(identityRegistry), address(reputationRegistry));

        address predictedTaskManager =
            vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        escrowVault = new EscrowVault(predictedTaskManager, address(this), 0);

        taskManager = new TaskManager(address(escrowVault), address(agentAdapter));
        disputeResolver = new DisputeResolver(address(taskManager), address(agentAdapter));

        taskManager.emergencySetDisputeResolver(address(disputeResolver));
        agentAdapter.emergencySetTaskManager(address(taskManager));
        agentAdapter.emergencySetDisputeResolver(address(disputeResolver));

        identityRegistry.authorizeAdapter(address(agentAdapter));

        vm.deal(creator, 10 ether);
        vm.deal(agent1, 1 ether);
        vm.deal(agent2, 1 ether);

        vm.prank(agent1);
        agentAdapter.register("ipfs://agent1-profile-cid");

        vm.prank(agent2);
        agentAdapter.register("ipfs://agent2-profile-cid");
    }

    /*//////////////////////////////////////////////////////////////
                    TASKMANAGER: DEFAULT VALUES
    //////////////////////////////////////////////////////////////*/

    function test_DefaultChallengeWindow() public view {
        assertEq(taskManager.challengeWindow(), 48 hours);
    }

    function test_DefaultSelectionDeadline() public view {
        assertEq(taskManager.selectionDeadline(), 7 days);
    }

    /*//////////////////////////////////////////////////////////////
                    TASKMANAGER: setChallengeWindow
    //////////////////////////////////////////////////////////////*/

    function test_SetChallengeWindow() public {
        taskManager.setChallengeWindow(72 hours);
        assertEq(taskManager.challengeWindow(), 72 hours);
    }

    function test_SetChallengeWindow_AtMinBound() public {
        taskManager.setChallengeWindow(24 hours);
        assertEq(taskManager.challengeWindow(), 24 hours);
    }

    function test_SetChallengeWindow_AtMaxBound() public {
        taskManager.setChallengeWindow(7 days);
        assertEq(taskManager.challengeWindow(), 7 days);
    }

    function test_SetChallengeWindow_RevertBelowMin() public {
        vm.expectRevert(TaskManager.ValueOutOfBounds.selector);
        taskManager.setChallengeWindow(24 hours - 1);
    }

    function test_SetChallengeWindow_RevertAboveMax() public {
        vm.expectRevert(TaskManager.ValueOutOfBounds.selector);
        taskManager.setChallengeWindow(7 days + 1);
    }

    function test_SetChallengeWindow_RevertIfNotOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert(TaskManager.OnlyOwner.selector);
        taskManager.setChallengeWindow(72 hours);
    }

    function test_SetChallengeWindow_EmitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit TaskManager.ChallengeWindowUpdated(48 hours, 72 hours);
        taskManager.setChallengeWindow(72 hours);
    }

    /*//////////////////////////////////////////////////////////////
                    TASKMANAGER: setSelectionDeadline
    //////////////////////////////////////////////////////////////*/

    function test_SetSelectionDeadline() public {
        taskManager.setSelectionDeadline(14 days);
        assertEq(taskManager.selectionDeadline(), 14 days);
    }

    function test_SetSelectionDeadline_AtMinBound() public {
        taskManager.setSelectionDeadline(3 days);
        assertEq(taskManager.selectionDeadline(), 3 days);
    }

    function test_SetSelectionDeadline_AtMaxBound() public {
        taskManager.setSelectionDeadline(30 days);
        assertEq(taskManager.selectionDeadline(), 30 days);
    }

    function test_SetSelectionDeadline_RevertBelowMin() public {
        vm.expectRevert(TaskManager.ValueOutOfBounds.selector);
        taskManager.setSelectionDeadline(3 days - 1);
    }

    function test_SetSelectionDeadline_RevertAboveMax() public {
        vm.expectRevert(TaskManager.ValueOutOfBounds.selector);
        taskManager.setSelectionDeadline(30 days + 1);
    }

    function test_SetSelectionDeadline_RevertIfNotOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert(TaskManager.OnlyOwner.selector);
        taskManager.setSelectionDeadline(14 days);
    }

    function test_SetSelectionDeadline_EmitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit TaskManager.SelectionDeadlineUpdated(7 days, 14 days);
        taskManager.setSelectionDeadline(14 days);
    }

    /*//////////////////////////////////////////////////////////////
                    TASKMANAGER: NEW VALUES TAKE EFFECT
    //////////////////////////////////////////////////////////////*/

    function test_NewChallengeWindow_AffectsNewTasks() public {
        // Change challenge window to 72 hours
        taskManager.setChallengeWindow(72 hours);

        // Create task and submit
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        // Select winner
        uint256 selectTime = block.timestamp;
        vm.prank(creator);
        taskManager.selectWinner(taskId, agent1);

        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(task.challengeDeadline, selectTime + 72 hours);

        // Cannot finalize before new challenge window
        vm.warp(selectTime + 48 hours + 1);
        vm.expectRevert(TaskManager.ChallengeWindowNotPassed.selector);
        taskManager.finalizeTask(taskId);

        // Can finalize after new challenge window
        vm.warp(selectTime + 72 hours + 1);
        taskManager.finalizeTask(taskId);

        ITaskManager.Task memory finalizedTask = taskManager.getTask(taskId);
        assertEq(uint256(finalizedTask.status), uint256(ITaskManager.TaskStatus.Completed));
    }

    function test_NewSelectionDeadline_AffectsNewTasks() public {
        // Change selection deadline to 14 days
        taskManager.setSelectionDeadline(14 days);

        uint256 deadline = block.timestamp + 7 days;

        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, deadline
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        // Cannot refund before the new selection deadline (14 days after task deadline)
        vm.warp(deadline + 7 days + 1); // Old deadline would have expired
        vm.expectRevert(TaskManager.DeadlineNotPassed.selector);
        taskManager.refundExpiredTask(taskId);

        // Can refund after new selection deadline
        vm.warp(deadline + 14 days + 1);
        taskManager.refundExpiredTask(taskId);

        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.Refunded));
    }

    function test_ExistingTasks_NotAffectedByChallengeWindowChange() public {
        // Create task and select winner with default 48h challenge window
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        uint256 selectTime = block.timestamp;
        vm.prank(creator);
        taskManager.selectWinner(taskId, agent1);

        // Verify challenge deadline is based on old window
        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(task.challengeDeadline, selectTime + 48 hours);

        // Now change the challenge window to 72 hours
        taskManager.setChallengeWindow(72 hours);

        // The existing task's challenge deadline should NOT change
        ITaskManager.Task memory taskAfter = taskManager.getTask(taskId);
        assertEq(taskAfter.challengeDeadline, selectTime + 48 hours);

        // Can still finalize after original 48h window
        vm.warp(selectTime + 48 hours + 1);
        taskManager.finalizeTask(taskId);
    }

    /*//////////////////////////////////////////////////////////////
                    DISPUTERESOLVER: DEFAULT VALUE
    //////////////////////////////////////////////////////////////*/

    function test_DefaultVotingPeriod() public view {
        assertEq(disputeResolver.votingPeriod(), 48 hours);
    }

    /*//////////////////////////////////////////////////////////////
                    DISPUTERESOLVER: setVotingPeriod
    //////////////////////////////////////////////////////////////*/

    function test_SetVotingPeriod() public {
        disputeResolver.setVotingPeriod(72 hours);
        assertEq(disputeResolver.votingPeriod(), 72 hours);
    }

    function test_SetVotingPeriod_AtMinBound() public {
        disputeResolver.setVotingPeriod(24 hours);
        assertEq(disputeResolver.votingPeriod(), 24 hours);
    }

    function test_SetVotingPeriod_AtMaxBound() public {
        disputeResolver.setVotingPeriod(7 days);
        assertEq(disputeResolver.votingPeriod(), 7 days);
    }

    function test_SetVotingPeriod_RevertBelowMin() public {
        vm.expectRevert(DisputeResolver.ValueOutOfBounds.selector);
        disputeResolver.setVotingPeriod(24 hours - 1);
    }

    function test_SetVotingPeriod_RevertAboveMax() public {
        vm.expectRevert(DisputeResolver.ValueOutOfBounds.selector);
        disputeResolver.setVotingPeriod(7 days + 1);
    }

    function test_SetVotingPeriod_RevertIfNotOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert(DisputeResolver.OnlyOwner.selector);
        disputeResolver.setVotingPeriod(72 hours);
    }

    function test_SetVotingPeriod_EmitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit DisputeResolver.VotingPeriodUpdated(48 hours, 72 hours);
        disputeResolver.setVotingPeriod(72 hours);
    }

    /*//////////////////////////////////////////////////////////////
                DISPUTERESOLVER: NEW VALUES TAKE EFFECT
    //////////////////////////////////////////////////////////////*/

    function test_NewVotingPeriod_AffectsNewDisputes() public {
        // Change voting period to 72 hours
        disputeResolver.setVotingPeriod(72 hours);

        // Create task, submit, reject, start dispute
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);
        uint256 disputeStartTime = block.timestamp;

        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{ value: stake }(taskId);

        // Verify voting deadline uses new period
        IDisputeResolver.Dispute memory dispute = disputeResolver.getDispute(disputeId);
        assertEq(dispute.votingDeadline, disputeStartTime + 72 hours);

        // Cannot resolve before new voting period ends
        vm.warp(disputeStartTime + 48 hours + 1);
        vm.expectRevert(DisputeResolver.VotingStillActive.selector);
        disputeResolver.resolveDispute(disputeId);

        // Can resolve after new voting period
        vm.warp(disputeStartTime + 72 hours + 1);
        disputeResolver.resolveDispute(disputeId);
    }

    function test_ExistingDisputes_NotAffectedByVotingPeriodChange() public {
        // Create task, submit, reject, start dispute with default 48h period
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);
        uint256 disputeStartTime = block.timestamp;

        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{ value: stake }(taskId);

        // Verify voting deadline uses original period
        IDisputeResolver.Dispute memory dispute = disputeResolver.getDispute(disputeId);
        assertEq(dispute.votingDeadline, disputeStartTime + 48 hours);

        // Change voting period to 72 hours
        disputeResolver.setVotingPeriod(72 hours);

        // The existing dispute's deadline should NOT change
        IDisputeResolver.Dispute memory disputeAfter = disputeResolver.getDispute(disputeId);
        assertEq(disputeAfter.votingDeadline, disputeStartTime + 48 hours);

        // Can still resolve after original 48h period
        vm.warp(disputeStartTime + 48 hours + 1);
        disputeResolver.resolveDispute(disputeId);
    }

    /*//////////////////////////////////////////////////////////////
                    BOUNDS CONSTANTS EXPOSED
    //////////////////////////////////////////////////////////////*/

    function test_BoundsConstants_TaskManager() public view {
        assertEq(taskManager.MIN_CHALLENGE_WINDOW(), 24 hours);
        assertEq(taskManager.MAX_CHALLENGE_WINDOW(), 7 days);
        assertEq(taskManager.MIN_SELECTION_DEADLINE(), 3 days);
        assertEq(taskManager.MAX_SELECTION_DEADLINE(), 30 days);
    }

    function test_BoundsConstants_DisputeResolver() public view {
        assertEq(disputeResolver.MIN_VOTING_PERIOD(), 24 hours);
        assertEq(disputeResolver.MAX_VOTING_PERIOD(), 7 days);
    }

    /*//////////////////////////////////////////////////////////////
                    REVERT DISPUTED TASK USES NEW WINDOW
    //////////////////////////////////////////////////////////////*/

    function test_RevertDisputedTask_UsesCurrentChallengeWindow() public {
        // Change challenge window to 72 hours
        taskManager.setChallengeWindow(72 hours);

        // Create task, submit, reject, dispute, then cancel dispute
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

        // Cancel dispute via emergency
        uint256 cancelTime = block.timestamp;
        disputeResolver.emergencyCancelDispute(disputeId);

        // Verify the new challenge deadline uses the updated window (72 hours)
        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(task.challengeDeadline, cancelTime + 72 hours);
    }
}
