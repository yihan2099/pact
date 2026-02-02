// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {TaskManager} from "../src/TaskManager.sol";
import {EscrowVault} from "../src/EscrowVault.sol";
import {PorterRegistry} from "../src/PorterRegistry.sol";
import {DisputeResolver} from "../src/DisputeResolver.sol";
import {ITaskManager} from "../src/interfaces/ITaskManager.sol";
import {IPorterRegistry} from "../src/interfaces/IPorterRegistry.sol";

contract TaskManagerTest is Test {
    TaskManager public taskManager;
    EscrowVault public escrowVault;
    PorterRegistry public porterRegistry;
    DisputeResolver public disputeResolver;

    address public creator = address(0x1);
    address public agent1 = address(0x2);
    address public agent2 = address(0x3);
    address public agent3 = address(0x4);

    uint256 public constant BOUNTY_AMOUNT = 1 ether;

    function setUp() public {
        // Deploy PorterRegistry first
        porterRegistry = new PorterRegistry();

        // Deploy EscrowVault with predicted TaskManager address
        address predictedTaskManager = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        escrowVault = new EscrowVault(predictedTaskManager);

        // Deploy TaskManager
        taskManager = new TaskManager(address(escrowVault), address(porterRegistry));

        // Deploy DisputeResolver
        disputeResolver = new DisputeResolver(address(taskManager), address(porterRegistry));

        // Configure access control
        taskManager.setDisputeResolver(address(disputeResolver));
        porterRegistry.setTaskManager(address(taskManager));
        porterRegistry.setDisputeResolver(address(disputeResolver));

        // Give accounts some ETH
        vm.deal(creator, 10 ether);
        vm.deal(agent1, 1 ether);
        vm.deal(agent2, 1 ether);
        vm.deal(agent3, 1 ether);

        // Register agents
        vm.prank(agent1);
        porterRegistry.register("agent1-profile-cid");

        vm.prank(agent2);
        porterRegistry.register("agent2-profile-cid");

        vm.prank(agent3);
        porterRegistry.register("agent3-profile-cid");
    }

    /*//////////////////////////////////////////////////////////////
                         TASK CREATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_CreateTask() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        assertEq(taskId, 1);

        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(task.id, 1);
        assertEq(task.creator, creator);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.Open));
        assertEq(task.bountyAmount, BOUNTY_AMOUNT);
        assertEq(task.specificationCid, "task-spec-cid");
    }

    function test_CreateTask_WithDeadline() public {
        uint256 deadline = block.timestamp + 7 days;

        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            deadline
        );

        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(task.deadline, deadline);
    }

    function test_CreateTask_RevertIfZeroBounty() public {
        vm.prank(creator);
        vm.expectRevert(TaskManager.InsufficientBounty.selector);
        taskManager.createTask{value: 0}(
            "task-spec-cid",
            address(0),
            0,
            0
        );
    }

    function test_CreateTask_RevertIfDeadlineInPast() public {
        // Warp to ensure we have a non-zero timestamp
        vm.warp(1000);

        vm.prank(creator);
        vm.expectRevert(TaskManager.InvalidDeadline.selector);
        taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            block.timestamp - 1
        );
    }

    /*//////////////////////////////////////////////////////////////
                      COMPETITIVE SUBMISSION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_SubmitWork() public {
        // Create task
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        // Agent submits work
        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        // Verify submission
        assertTrue(taskManager.hasSubmitted(taskId, agent1));
        assertEq(taskManager.getSubmissionCount(taskId), 1);

        ITaskManager.Submission memory submission = taskManager.getSubmission(taskId, 0);
        assertEq(submission.agent, agent1);
        assertEq(submission.submissionCid, "submission-cid-1");
    }

    function test_MultipleAgentsCanSubmit() public {
        // Create task
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        // Multiple agents submit
        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        vm.prank(agent2);
        taskManager.submitWork(taskId, "submission-cid-2");

        vm.prank(agent3);
        taskManager.submitWork(taskId, "submission-cid-3");

        // Verify all submissions
        assertEq(taskManager.getSubmissionCount(taskId), 3);
        assertTrue(taskManager.hasSubmitted(taskId, agent1));
        assertTrue(taskManager.hasSubmitted(taskId, agent2));
        assertTrue(taskManager.hasSubmitted(taskId, agent3));
    }

    function test_SubmitWork_RevertIfNotRegistered() public {
        address unregisteredAgent = address(0x999);

        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        vm.prank(unregisteredAgent);
        vm.expectRevert(TaskManager.AgentNotRegistered.selector);
        taskManager.submitWork(taskId, "submission-cid");
    }

    function test_SubmitWork_RevertIfAlreadySubmitted() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        // Try to submit again
        vm.prank(agent1);
        vm.expectRevert(TaskManager.AlreadySubmitted.selector);
        taskManager.submitWork(taskId, "submission-cid-2");
    }

    function test_SubmitWork_RevertAfterDeadline() public {
        uint256 deadline = block.timestamp + 1 days;

        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            deadline
        );

        // Warp past deadline
        vm.warp(deadline + 1);

        vm.prank(agent1);
        vm.expectRevert(TaskManager.DeadlinePassed.selector);
        taskManager.submitWork(taskId, "submission-cid");
    }

    function test_UpdateSubmission() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        // Update submission
        vm.prank(agent1);
        taskManager.updateSubmission(taskId, "updated-submission-cid");

        ITaskManager.Submission memory submission = taskManager.getSubmission(taskId, 0);
        assertEq(submission.submissionCid, "updated-submission-cid");
        assertTrue(submission.updatedAt >= submission.submittedAt);
    }

    function test_UpdateSubmission_RevertIfNotSubmitted() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        vm.prank(agent1);
        vm.expectRevert(TaskManager.NotSubmitted.selector);
        taskManager.updateSubmission(taskId, "submission-cid");
    }

    /*//////////////////////////////////////////////////////////////
                       WINNER SELECTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_SelectWinner() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        vm.prank(agent2);
        taskManager.submitWork(taskId, "submission-cid-2");

        // Creator selects winner
        vm.prank(creator);
        taskManager.selectWinner(taskId, agent1);

        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.InReview));
        assertEq(task.selectedWinner, agent1);
        assertTrue(task.challengeDeadline > block.timestamp);
    }

    function test_SelectWinner_RevertIfNotCreator() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        vm.prank(agent1);
        vm.expectRevert(TaskManager.NotTaskCreator.selector);
        taskManager.selectWinner(taskId, agent1);
    }

    function test_SelectWinner_RevertIfNoSubmissions() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        vm.prank(creator);
        vm.expectRevert(TaskManager.NoSubmissions.selector);
        taskManager.selectWinner(taskId, agent1);
    }

    function test_SelectWinner_RevertIfWinnerNotSubmitter() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        // Try to select agent2 who didn't submit
        vm.prank(creator);
        vm.expectRevert(TaskManager.WinnerNotSubmitter.selector);
        taskManager.selectWinner(taskId, agent2);
    }

    /*//////////////////////////////////////////////////////////////
                        REJECT ALL TESTS
    //////////////////////////////////////////////////////////////*/

    function test_RejectAll() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        // Creator rejects all
        vm.prank(creator);
        taskManager.rejectAll(taskId, "No submissions met requirements");

        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.InReview));
        assertEq(task.selectedWinner, address(0)); // No winner
        assertTrue(task.challengeDeadline > block.timestamp);
    }

    function test_RejectAll_RevertIfNoSubmissions() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        vm.prank(creator);
        vm.expectRevert(TaskManager.NoSubmissions.selector);
        taskManager.rejectAll(taskId, "reason");
    }

    /*//////////////////////////////////////////////////////////////
                       FINALIZE TASK TESTS
    //////////////////////////////////////////////////////////////*/

    function test_FinalizeTask_WithWinner() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        vm.prank(creator);
        taskManager.selectWinner(taskId, agent1);

        // Record balances before
        uint256 agent1BalanceBefore = agent1.balance;

        // Warp past challenge window (48 hours)
        vm.warp(block.timestamp + 48 hours + 1);

        // Finalize
        taskManager.finalizeTask(taskId);

        // Verify task completed
        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.Completed));

        // Verify bounty released to winner
        assertEq(agent1.balance, agent1BalanceBefore + BOUNTY_AMOUNT);

        // Verify reputation updated
        IPorterRegistry.Agent memory agentData = porterRegistry.getAgent(agent1);
        assertEq(agentData.tasksWon, 1);
        assertEq(agentData.reputation, 10); // +10 for winning
    }

    function test_FinalizeTask_AllRejected() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        uint256 creatorBalanceBefore = creator.balance;

        vm.warp(block.timestamp + 48 hours + 1);

        taskManager.finalizeTask(taskId);

        // Verify task refunded
        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.Refunded));

        // Verify bounty returned to creator
        assertEq(creator.balance, creatorBalanceBefore + BOUNTY_AMOUNT);
    }

    function test_FinalizeTask_RevertBeforeChallengeWindow() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        vm.prank(creator);
        taskManager.selectWinner(taskId, agent1);

        // Try to finalize before challenge window
        vm.expectRevert(TaskManager.ChallengeWindowNotPassed.selector);
        taskManager.finalizeTask(taskId);
    }

    /*//////////////////////////////////////////////////////////////
                         CANCEL TASK TESTS
    //////////////////////////////////////////////////////////////*/

    function test_CancelTask() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        uint256 creatorBalanceBefore = creator.balance;

        vm.prank(creator);
        taskManager.cancelTask(taskId);

        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.Cancelled));
        assertEq(creator.balance, creatorBalanceBefore + BOUNTY_AMOUNT);
    }

    function test_CancelTask_RevertIfHasSubmissions() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        vm.prank(creator);
        vm.expectRevert(TaskManager.HasSubmissions.selector);
        taskManager.cancelTask(taskId);
    }

    function test_CancelTask_RevertIfNotCreator() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        vm.prank(agent1);
        vm.expectRevert(TaskManager.NotTaskCreator.selector);
        taskManager.cancelTask(taskId);
    }

    /*//////////////////////////////////////////////////////////////
                          EVENT TESTS
    //////////////////////////////////////////////////////////////*/

    function test_EmitsWorkSubmitted() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        vm.expectEmit(true, true, false, true);
        emit ITaskManager.WorkSubmitted(taskId, agent1, "submission-cid-1", 0);

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");
    }

    function test_EmitsWinnerSelected() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        vm.expectEmit(true, true, false, false); // Don't check data (challengeDeadline)
        emit ITaskManager.WinnerSelected(taskId, agent1, 0);

        vm.prank(creator);
        taskManager.selectWinner(taskId, agent1);
    }

    function test_EmitsTaskCompleted() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        vm.prank(creator);
        taskManager.selectWinner(taskId, agent1);

        vm.warp(block.timestamp + 48 hours + 1);

        vm.expectEmit(true, true, false, true);
        emit ITaskManager.TaskCompleted(taskId, agent1, BOUNTY_AMOUNT);

        taskManager.finalizeTask(taskId);
    }
}
