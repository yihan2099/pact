// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import { Test, console } from "forge-std/Test.sol";
import { TaskManager } from "../src/TaskManager.sol";
import { EscrowVault } from "../src/EscrowVault.sol";
import { ClawboyAgentAdapter } from "../src/ClawboyAgentAdapter.sol";
import { ERC8004IdentityRegistry } from "../src/erc8004/ERC8004IdentityRegistry.sol";
import { ERC8004ReputationRegistry } from "../src/erc8004/ERC8004ReputationRegistry.sol";
import { DisputeResolver } from "../src/DisputeResolver.sol";
import { ITaskManager } from "../src/interfaces/ITaskManager.sol";
import { IClawboyAgentAdapter } from "../src/IClawboyAgentAdapter.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Simple mock ERC20 for testing
contract MockERC20 is ERC20 {
    constructor() ERC20("Mock Token", "MOCK") {
        _mint(msg.sender, 1_000_000 ether);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract TaskManagerTest is Test {
    TaskManager public taskManager;
    EscrowVault public escrowVault;
    ClawboyAgentAdapter public agentAdapter;
    ERC8004IdentityRegistry public identityRegistry;
    ERC8004ReputationRegistry public reputationRegistry;
    DisputeResolver public disputeResolver;

    address public creator = address(0x1);
    address public agent1 = address(0x2);
    address public agent2 = address(0x3);
    address public agent3 = address(0x4);
    address public treasury = address(0x5);

    uint256 public constant BOUNTY_AMOUNT = 1 ether;

    function setUp() public {
        // Deploy ERC-8004 IdentityRegistry
        identityRegistry = new ERC8004IdentityRegistry();

        // Deploy ERC-8004 ReputationRegistry (initialized with IdentityRegistry in constructor)
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
        vm.deal(creator, 10 ether);
        vm.deal(agent1, 1 ether);
        vm.deal(agent2, 1 ether);
        vm.deal(agent3, 1 ether);

        // Register agents via adapter
        vm.prank(agent1);
        agentAdapter.register("ipfs://agent1-profile-cid");

        vm.prank(agent2);
        agentAdapter.register("ipfs://agent2-profile-cid");

        vm.prank(agent3);
        agentAdapter.register("ipfs://agent3-profile-cid");
    }

    /*//////////////////////////////////////////////////////////////
                         TASK CREATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_CreateTask() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
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
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, deadline
        );

        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(task.deadline, deadline);
    }

    function test_CreateTask_RevertIfZeroBounty() public {
        vm.prank(creator);
        vm.expectRevert(TaskManager.InsufficientBounty.selector);
        taskManager.createTask{ value: 0 }("task-spec-cid", address(0), 0, 0);
    }

    function test_CreateTask_RevertIfDeadlineInPast() public {
        // Warp to ensure we have a non-zero timestamp
        vm.warp(1000);

        vm.prank(creator);
        vm.expectRevert(TaskManager.InvalidDeadline.selector);
        taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, block.timestamp - 1
        );
    }

    /*//////////////////////////////////////////////////////////////
                      COMPETITIVE SUBMISSION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_SubmitWork() public {
        // Create task
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
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
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
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
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        vm.prank(unregisteredAgent);
        vm.expectRevert(TaskManager.AgentNotRegistered.selector);
        taskManager.submitWork(taskId, "submission-cid");
    }

    function test_SubmitWork_RevertIfAlreadySubmitted() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
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
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, deadline
        );

        // Warp past deadline
        vm.warp(deadline + 1);

        vm.prank(agent1);
        vm.expectRevert(TaskManager.DeadlinePassed.selector);
        taskManager.submitWork(taskId, "submission-cid");
    }

    function test_UpdateSubmission() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
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
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
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
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
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
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        vm.prank(agent1);
        vm.expectRevert(TaskManager.NotTaskCreator.selector);
        taskManager.selectWinner(taskId, agent1);
    }

    function test_SelectWinner_RevertIfNoSubmissions() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        vm.prank(creator);
        vm.expectRevert(TaskManager.NoSubmissions.selector);
        taskManager.selectWinner(taskId, agent1);
    }

    function test_SelectWinner_RevertIfWinnerNotSubmitter() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
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
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
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
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
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
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
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

        // Verify bounty released to winner (minus 3% protocol fee)
        uint256 expectedFee = (BOUNTY_AMOUNT * 300) / 10_000;
        assertEq(agent1.balance, agent1BalanceBefore + BOUNTY_AMOUNT - expectedFee);

        // Verify ERC-8004 feedback recorded
        (uint64 taskWins,,,) = agentAdapter.getReputationSummary(agent1);
        assertEq(taskWins, 1);
    }

    function test_FinalizeTask_AllRejected() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
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
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
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
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
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
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        vm.prank(creator);
        vm.expectRevert(TaskManager.HasSubmissions.selector);
        taskManager.cancelTask(taskId);
    }

    function test_CancelTask_RevertIfNotCreator() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
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
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        vm.expectEmit(true, true, false, true);
        emit ITaskManager.WorkSubmitted(taskId, agent1, "submission-cid-1", 0);

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");
    }

    function test_EmitsWinnerSelected() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
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
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        vm.prank(creator);
        taskManager.selectWinner(taskId, agent1);

        vm.warp(block.timestamp + 48 hours + 1);

        vm.expectEmit(true, true, false, true, address(taskManager));
        emit ITaskManager.TaskCompleted(taskId, agent1, BOUNTY_AMOUNT);

        taskManager.finalizeTask(taskId);
    }

    /*//////////////////////////////////////////////////////////////
                      OWNERSHIP TRANSFER TESTS
    //////////////////////////////////////////////////////////////*/

    function test_TransferOwnership() public {
        address newOwner = address(0x999);

        // Current owner initiates transfer
        taskManager.transferOwnership(newOwner);
        assertEq(taskManager.pendingOwner(), newOwner);
        assertEq(taskManager.owner(), address(this)); // Still old owner

        // Pending owner accepts
        vm.prank(newOwner);
        taskManager.acceptOwnership();

        assertEq(taskManager.owner(), newOwner);
        assertEq(taskManager.pendingOwner(), address(0));
    }

    function test_TransferOwnership_RevertIfNotOwner() public {
        vm.prank(agent1);
        vm.expectRevert(TaskManager.OnlyOwner.selector);
        taskManager.transferOwnership(agent1);
    }

    function test_TransferOwnership_RevertIfZeroAddress() public {
        vm.expectRevert(TaskManager.ZeroAddress.selector);
        taskManager.transferOwnership(address(0));
    }

    function test_AcceptOwnership_RevertIfNotPendingOwner() public {
        address newOwner = address(0x999);
        taskManager.transferOwnership(newOwner);

        vm.prank(agent1);
        vm.expectRevert(TaskManager.NotPendingOwner.selector);
        taskManager.acceptOwnership();
    }

    function test_TransferOwnership_OverwritesPending() public {
        address firstPending = address(0x111);
        address secondPending = address(0x222);

        // First transfer
        taskManager.transferOwnership(firstPending);
        assertEq(taskManager.pendingOwner(), firstPending);

        // Second transfer overwrites
        taskManager.transferOwnership(secondPending);
        assertEq(taskManager.pendingOwner(), secondPending);

        // First pending can no longer accept
        vm.prank(firstPending);
        vm.expectRevert(TaskManager.NotPendingOwner.selector);
        taskManager.acceptOwnership();

        // Second pending can accept
        vm.prank(secondPending);
        taskManager.acceptOwnership();
        assertEq(taskManager.owner(), secondPending);
    }

    function test_TransferOwnership_EmitsEvents() public {
        address newOwner = address(0x999);

        // Test OwnershipTransferInitiated event
        vm.expectEmit(true, true, false, false);
        emit TaskManager.OwnershipTransferInitiated(address(this), newOwner);
        taskManager.transferOwnership(newOwner);

        // Test OwnershipTransferred event
        vm.expectEmit(true, true, false, false);
        emit TaskManager.OwnershipTransferred(address(this), newOwner);
        vm.prank(newOwner);
        taskManager.acceptOwnership();
    }

    /*//////////////////////////////////////////////////////////////
                         ERC20 TOKEN TESTS
    //////////////////////////////////////////////////////////////*/

    function test_CreateTask_WithERC20() public {
        // Deploy mock ERC20
        MockERC20 token = new MockERC20();
        token.mint(creator, 100 ether);

        // Creator approves EscrowVault to spend tokens
        vm.prank(creator);
        token.approve(address(escrowVault), BOUNTY_AMOUNT);

        // Create task with ERC20 bounty
        vm.prank(creator);
        uint256 taskId = taskManager.createTask("task-spec-cid", address(token), BOUNTY_AMOUNT, 0);

        assertEq(taskId, 1);

        // Verify task was created with ERC20 token
        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(task.bountyToken, address(token));
        assertEq(task.bountyAmount, BOUNTY_AMOUNT);

        // Verify tokens were transferred to escrow
        assertEq(token.balanceOf(address(escrowVault)), BOUNTY_AMOUNT);
        assertEq(token.balanceOf(creator), 100 ether - BOUNTY_AMOUNT);
    }

    function test_CreateTask_WithERC20_AndRelease() public {
        // Deploy mock ERC20
        MockERC20 token = new MockERC20();
        token.mint(creator, 100 ether);

        // Creator approves EscrowVault to spend tokens
        vm.prank(creator);
        token.approve(address(escrowVault), BOUNTY_AMOUNT);

        // Create task with ERC20 bounty
        vm.prank(creator);
        uint256 taskId = taskManager.createTask("task-spec-cid", address(token), BOUNTY_AMOUNT, 0);

        // Agent submits work
        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        // Creator selects winner
        vm.prank(creator);
        taskManager.selectWinner(taskId, agent1);

        // Record balances before
        uint256 agent1TokenBefore = token.balanceOf(agent1);

        // Warp past challenge window
        vm.warp(block.timestamp + 48 hours + 1);

        // Finalize task
        taskManager.finalizeTask(taskId);

        // Verify tokens released to winner (minus 3% protocol fee)
        uint256 expectedFee = (BOUNTY_AMOUNT * 300) / 10_000;
        assertEq(token.balanceOf(agent1), agent1TokenBefore + BOUNTY_AMOUNT - expectedFee);
        assertEq(token.balanceOf(address(escrowVault)), 0);
    }

    function test_CreateTask_WithERC20_AndRefund() public {
        // Deploy mock ERC20
        MockERC20 token = new MockERC20();
        token.mint(creator, 100 ether);

        // Creator approves EscrowVault to spend tokens
        vm.prank(creator);
        token.approve(address(escrowVault), BOUNTY_AMOUNT);

        // Create task with ERC20 bounty
        vm.prank(creator);
        uint256 taskId = taskManager.createTask("task-spec-cid", address(token), BOUNTY_AMOUNT, 0);

        // Record creator balance before
        uint256 creatorTokenBefore = token.balanceOf(creator);

        // Cancel task (no submissions yet)
        vm.prank(creator);
        taskManager.cancelTask(taskId);

        // Verify tokens refunded to creator
        assertEq(token.balanceOf(creator), creatorTokenBefore + BOUNTY_AMOUNT);
        assertEq(token.balanceOf(address(escrowVault)), 0);
    }

    function test_CreateTask_WithERC20_RevertIfNoApproval() public {
        // Deploy mock ERC20
        MockERC20 token = new MockERC20();
        token.mint(creator, 100 ether);

        // No approval given - this should revert
        vm.prank(creator);
        vm.expectRevert(); // ERC20: insufficient allowance
        taskManager.createTask("task-spec-cid", address(token), BOUNTY_AMOUNT, 0);
    }

    function test_CreateTask_WithERC20_RevertIfInsufficientApproval() public {
        // Deploy mock ERC20
        MockERC20 token = new MockERC20();
        token.mint(creator, 100 ether);

        // Creator approves less than needed
        vm.prank(creator);
        token.approve(address(escrowVault), BOUNTY_AMOUNT / 2);

        // Should revert due to insufficient approval
        vm.prank(creator);
        vm.expectRevert(); // ERC20: insufficient allowance
        taskManager.createTask("task-spec-cid", address(token), BOUNTY_AMOUNT, 0);
    }

    function test_CreateTask_WithERC20_MultipleTasksSameApproval() public {
        // Deploy mock ERC20
        MockERC20 token = new MockERC20();
        token.mint(creator, 100 ether);

        // Creator approves enough for multiple tasks
        vm.prank(creator);
        token.approve(address(escrowVault), BOUNTY_AMOUNT * 3);

        // Create first task
        vm.prank(creator);
        uint256 taskId1 =
            taskManager.createTask("task-spec-cid-1", address(token), BOUNTY_AMOUNT, 0);

        // Create second task
        vm.prank(creator);
        uint256 taskId2 =
            taskManager.createTask("task-spec-cid-2", address(token), BOUNTY_AMOUNT, 0);

        // Create third task
        vm.prank(creator);
        uint256 taskId3 =
            taskManager.createTask("task-spec-cid-3", address(token), BOUNTY_AMOUNT, 0);

        assertEq(taskId1, 1);
        assertEq(taskId2, 2);
        assertEq(taskId3, 3);

        // Verify all bounties deposited
        assertEq(token.balanceOf(address(escrowVault)), BOUNTY_AMOUNT * 3);
        assertEq(token.balanceOf(creator), 100 ether - (BOUNTY_AMOUNT * 3));

        // Verify fourth task fails (approval exhausted)
        vm.prank(creator);
        vm.expectRevert(); // ERC20: insufficient allowance
        taskManager.createTask("task-spec-cid-4", address(token), BOUNTY_AMOUNT, 0);
    }
}
