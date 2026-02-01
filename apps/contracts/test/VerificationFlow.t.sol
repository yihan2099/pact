// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {TaskManager} from "../src/TaskManager.sol";
import {EscrowVault} from "../src/EscrowVault.sol";
import {PorterRegistry} from "../src/PorterRegistry.sol";
import {VerificationHub} from "../src/VerificationHub.sol";
import {ITaskManager} from "../src/interfaces/ITaskManager.sol";
import {IVerificationHub} from "../src/interfaces/IVerificationHub.sol";
import {IPorterRegistry} from "../src/interfaces/IPorterRegistry.sol";

contract VerificationFlowTest is Test {
    TaskManager public taskManager;
    EscrowVault public escrowVault;
    PorterRegistry public porterRegistry;
    VerificationHub public verificationHub;

    address public owner = address(this);
    address public creator = address(0x1);
    address public agent = address(0x2);
    address public verifier = address(0x3);

    uint256 public constant BOUNTY_AMOUNT = 1 ether;

    function setUp() public {
        // Deploy PorterRegistry first
        porterRegistry = new PorterRegistry();

        // Deploy EscrowVault with a temporary address (will set TaskManager later)
        // We need to predict TaskManager address for proper setup
        address predictedTaskManager = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        escrowVault = new EscrowVault(predictedTaskManager);

        // Deploy TaskManager
        taskManager = new TaskManager(address(escrowVault), address(porterRegistry));

        // Deploy VerificationHub
        verificationHub = new VerificationHub(address(taskManager), address(porterRegistry));

        // Configure access control
        taskManager.setVerificationHub(address(verificationHub));
        porterRegistry.setTaskManager(address(taskManager));
        porterRegistry.setVerificationHub(address(verificationHub));

        // Give accounts some ETH
        vm.deal(creator, 10 ether);
        vm.deal(verifier, 10 ether);
        vm.deal(agent, 1 ether);

        // Setup agent (register)
        vm.prank(agent);
        porterRegistry.register("agent-profile-cid");

        // Setup verifier as Elite tier
        vm.startPrank(verifier);
        porterRegistry.register("verifier-profile-cid");
        // Need to stake and gain reputation to become Elite
        porterRegistry.stake{value: 5 ether}();
        vm.stopPrank();

        // Directly set verifier to Elite tier for testing
        // (In production, they'd earn reputation over time)
        vm.prank(address(taskManager)); // TaskManager is authorized
        porterRegistry.updateReputation(verifier, 1000); // ELITE_REPUTATION
    }

    /*//////////////////////////////////////////////////////////////
                           HAPPY PATH TESTS
    //////////////////////////////////////////////////////////////*/

    function test_FullVerificationFlow_Approved() public {
        // Step 1: Creator creates a task with bounty
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0), // ETH bounty
            BOUNTY_AMOUNT,
            0 // No deadline
        );

        assertEq(taskId, 1);

        // Step 2: Agent claims the task
        vm.prank(agent);
        taskManager.claimTask(taskId);

        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.Claimed));
        assertEq(task.claimedBy, agent);

        // Step 3: Agent submits work
        vm.prank(agent);
        taskManager.submitWork(taskId, "submission-cid");

        task = taskManager.getTask(taskId);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.Submitted));

        // Step 4: Verifier approves the work
        uint256 agentBalanceBefore = agent.balance;

        vm.prank(verifier);
        verificationHub.submitVerdict(
            taskId,
            IVerificationHub.VerdictOutcome.Approved,
            85, // Quality score
            "feedback-cid"
        );

        // Verify task is completed
        task = taskManager.getTask(taskId);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.Completed));

        // Verify bounty was released to agent
        assertEq(agent.balance, agentBalanceBefore + BOUNTY_AMOUNT);

        // Verify agent's completed tasks incremented
        IPorterRegistry.Agent memory agentData = porterRegistry.getAgent(agent);
        assertEq(agentData.tasksCompleted, 1);

        // Verify verdict was recorded
        IVerificationHub.Verdict memory verdict = verificationHub.getVerdict(taskId);
        assertEq(verdict.verifier, verifier);
        assertEq(uint256(verdict.outcome), uint256(IVerificationHub.VerdictOutcome.Approved));
        assertEq(verdict.score, 85);
    }

    function test_VerificationFlow_Rejected() public {
        // Create and claim task
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        vm.prank(agent);
        taskManager.claimTask(taskId);

        vm.prank(agent);
        taskManager.submitWork(taskId, "submission-cid");

        uint256 agentBalanceBefore = agent.balance;

        // Verifier rejects the work
        vm.prank(verifier);
        verificationHub.submitVerdict(
            taskId,
            IVerificationHub.VerdictOutcome.Rejected,
            30, // Low quality score
            "rejection-feedback-cid"
        );

        // Task status should still be Submitted (not completed)
        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.Submitted));

        // Bounty should NOT be released
        assertEq(agent.balance, agentBalanceBefore);

        // Verdict should be recorded
        IVerificationHub.Verdict memory verdict = verificationHub.getVerdict(taskId);
        assertEq(uint256(verdict.outcome), uint256(IVerificationHub.VerdictOutcome.Rejected));
    }

    function test_VerificationFlow_RevisionRequested() public {
        // Create, claim, and submit task
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        vm.prank(agent);
        taskManager.claimTask(taskId);

        vm.prank(agent);
        taskManager.submitWork(taskId, "submission-cid");

        // Verifier requests revision
        vm.prank(verifier);
        verificationHub.submitVerdict(
            taskId,
            IVerificationHub.VerdictOutcome.RevisionRequested,
            50,
            "revision-feedback-cid"
        );

        // Task should still be Submitted
        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.Submitted));
    }

    /*//////////////////////////////////////////////////////////////
                         ACCESS CONTROL TESTS
    //////////////////////////////////////////////////////////////*/

    function test_CompleteTask_OnlyVerificationHub() public {
        // Create and prepare task
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        vm.prank(agent);
        taskManager.claimTask(taskId);

        vm.prank(agent);
        taskManager.submitWork(taskId, "submission-cid");

        // Try to complete task directly (not through VerificationHub)
        vm.prank(creator);
        vm.expectRevert(TaskManager.OnlyVerificationHub.selector);
        taskManager.completeTask(taskId);

        vm.prank(agent);
        vm.expectRevert(TaskManager.OnlyVerificationHub.selector);
        taskManager.completeTask(taskId);

        // Random address
        vm.prank(address(0x999));
        vm.expectRevert(TaskManager.OnlyVerificationHub.selector);
        taskManager.completeTask(taskId);
    }

    function test_SubmitVerdict_OnlyVerifier() public {
        // Create and prepare task
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        vm.prank(agent);
        taskManager.claimTask(taskId);

        vm.prank(agent);
        taskManager.submitWork(taskId, "submission-cid");

        // Non-verifier (agent is not Elite tier) cannot submit verdict
        vm.prank(agent);
        vm.expectRevert(VerificationHub.NotVerifier.selector);
        verificationHub.submitVerdict(
            taskId,
            IVerificationHub.VerdictOutcome.Approved,
            80,
            "feedback-cid"
        );

        // Creator cannot submit verdict
        vm.prank(creator);
        vm.expectRevert(VerificationHub.NotVerifier.selector);
        verificationHub.submitVerdict(
            taskId,
            IVerificationHub.VerdictOutcome.Approved,
            80,
            "feedback-cid"
        );
    }

    function test_IncrementCompleted_OnlyAuthorized() public {
        // Agent is already registered in setUp

        // Random address cannot increment
        vm.prank(address(0x999));
        vm.expectRevert(PorterRegistry.Unauthorized.selector);
        porterRegistry.incrementCompleted(agent);

        // Creator cannot increment
        vm.prank(creator);
        vm.expectRevert(PorterRegistry.Unauthorized.selector);
        porterRegistry.incrementCompleted(agent);
    }

    function test_UpdateReputation_OnlyAuthorized() public {
        // Random address cannot update reputation
        vm.prank(address(0x999));
        vm.expectRevert(PorterRegistry.Unauthorized.selector);
        porterRegistry.updateReputation(agent, 100);
    }

    /*//////////////////////////////////////////////////////////////
                          EDGE CASE TESTS
    //////////////////////////////////////////////////////////////*/

    function test_CannotSubmitVerdictTwice() public {
        // Create and prepare task
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        vm.prank(agent);
        taskManager.claimTask(taskId);

        vm.prank(agent);
        taskManager.submitWork(taskId, "submission-cid");

        // First verdict succeeds (approved -> task completed)
        vm.prank(verifier);
        verificationHub.submitVerdict(
            taskId,
            IVerificationHub.VerdictOutcome.Approved,
            80,
            "feedback-cid"
        );

        // Second verdict fails - task is now Completed, not Submitted
        // So we get TaskNotPendingVerification (checked before VerdictAlreadySubmitted)
        vm.prank(verifier);
        vm.expectRevert(VerificationHub.TaskNotPendingVerification.selector);
        verificationHub.submitVerdict(
            taskId,
            IVerificationHub.VerdictOutcome.Rejected,
            40,
            "second-feedback-cid"
        );
    }

    function test_CannotSubmitVerdictTwice_Rejected() public {
        // Test with rejected verdict where task stays in Submitted status
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        vm.prank(agent);
        taskManager.claimTask(taskId);

        vm.prank(agent);
        taskManager.submitWork(taskId, "submission-cid");

        // First verdict (rejected) - task stays Submitted
        vm.prank(verifier);
        verificationHub.submitVerdict(
            taskId,
            IVerificationHub.VerdictOutcome.Rejected,
            30,
            "feedback-cid"
        );

        // Second verdict fails with VerdictAlreadySubmitted
        // (since task is still Submitted, we hit the verdict check)
        vm.prank(verifier);
        vm.expectRevert(VerificationHub.VerdictAlreadySubmitted.selector);
        verificationHub.submitVerdict(
            taskId,
            IVerificationHub.VerdictOutcome.Approved,
            80,
            "second-feedback-cid"
        );
    }

    function test_CannotSubmitVerdictOnNonSubmittedTask() public {
        // Create task but don't claim/submit
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        // Try to submit verdict on open task
        vm.prank(verifier);
        vm.expectRevert(VerificationHub.TaskNotPendingVerification.selector);
        verificationHub.submitVerdict(
            taskId,
            IVerificationHub.VerdictOutcome.Approved,
            80,
            "feedback-cid"
        );

        // Claim but don't submit
        vm.prank(agent);
        taskManager.claimTask(taskId);

        vm.prank(verifier);
        vm.expectRevert(VerificationHub.TaskNotPendingVerification.selector);
        verificationHub.submitVerdict(
            taskId,
            IVerificationHub.VerdictOutcome.Approved,
            80,
            "feedback-cid"
        );
    }

    function test_InvalidScore() public {
        // Create and prepare task
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        vm.prank(agent);
        taskManager.claimTask(taskId);

        vm.prank(agent);
        taskManager.submitWork(taskId, "submission-cid");

        // Score > 100 should fail
        vm.prank(verifier);
        vm.expectRevert(VerificationHub.InvalidScore.selector);
        verificationHub.submitVerdict(
            taskId,
            IVerificationHub.VerdictOutcome.Approved,
            101, // Invalid score
            "feedback-cid"
        );
    }

    /*//////////////////////////////////////////////////////////////
                            EVENT TESTS
    //////////////////////////////////////////////////////////////*/

    function test_EmitsEventsInCorrectOrder() public {
        // Create and prepare task
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        vm.prank(agent);
        taskManager.claimTask(taskId);

        vm.prank(agent);
        taskManager.submitWork(taskId, "submission-cid");

        // Expect events in order: VerdictSubmitted, TaskCompleted, Released
        vm.expectEmit(true, true, false, true);
        emit IVerificationHub.VerdictSubmitted(
            taskId,
            verifier,
            IVerificationHub.VerdictOutcome.Approved,
            85,
            "feedback-cid"
        );

        vm.expectEmit(true, true, false, true);
        emit ITaskManager.TaskCompleted(taskId, agent, BOUNTY_AMOUNT);

        vm.prank(verifier);
        verificationHub.submitVerdict(
            taskId,
            IVerificationHub.VerdictOutcome.Approved,
            85,
            "feedback-cid"
        );
    }
}
