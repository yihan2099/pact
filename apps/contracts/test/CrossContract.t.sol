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
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20Cross is ERC20 {
    constructor() ERC20("Mock Token", "MOCK") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract CrossContractTest is Test {
    TaskManager public taskManager;
    EscrowVault public escrowVault;
    ClawboyAgentAdapter public agentAdapter;
    ERC8004IdentityRegistry public identityRegistry;
    ERC8004ReputationRegistry public reputationRegistry;
    DisputeResolver public disputeResolver;
    MockERC20Cross public token;

    address public creator = address(0x1);
    address public agent1 = address(0x2);
    address public agent2 = address(0x3);
    address public agent3 = address(0x4);
    address public treasury = address(0x5);
    address public voter1 = address(0x6);
    address public voter2 = address(0x7);
    address public voter3 = address(0x8);

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

        token = new MockERC20Cross();

        vm.deal(creator, 100 ether);
        vm.deal(agent1, 10 ether);
        vm.deal(agent2, 10 ether);
        vm.deal(agent3, 10 ether);
        vm.deal(voter1, 1 ether);
        vm.deal(voter2, 1 ether);
        vm.deal(voter3, 1 ether);

        vm.prank(agent1);
        agentAdapter.register("ipfs://agent1");
        vm.prank(agent2);
        agentAdapter.register("ipfs://agent2");
        vm.prank(agent3);
        agentAdapter.register("ipfs://agent3");
        vm.prank(voter1);
        agentAdapter.register("ipfs://voter1");
        vm.prank(voter2);
        agentAdapter.register("ipfs://voter2");
        vm.prank(voter3);
        agentAdapter.register("ipfs://voter3");
    }

    /*//////////////////////////////////////////////////////////////
      1. FULL LIFECYCLE: CREATE -> SUBMIT -> SELECT -> FINALIZE
    //////////////////////////////////////////////////////////////*/

    function test_FullLifecycle_ETH() public {
        // 1. Create task
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        // 2. Agent submits work
        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid");

        // 3. Creator selects winner
        vm.prank(creator);
        taskManager.selectWinner(taskId, agent1);

        // 4. Wait for challenge window
        vm.warp(block.timestamp + 48 hours + 1);

        // 5. Finalize
        uint256 agent1Before = agent1.balance;
        uint256 treasuryBefore = treasury.balance;

        taskManager.finalizeTask(taskId);

        // Verify final state
        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.Completed));
        assertEq(task.selectedWinner, agent1);

        uint256 fee = (BOUNTY_AMOUNT * 300) / 10_000;
        assertEq(agent1.balance, agent1Before + BOUNTY_AMOUNT - fee);
        assertEq(treasury.balance, treasuryBefore + fee);

        // Verify reputation updated
        (uint64 taskWins,,,) = agentAdapter.getReputationSummary(agent1);
        assertEq(taskWins, 1);

        // Verify escrow empty
        (, uint256 escrowed) = escrowVault.getBalance(taskId);
        assertEq(escrowed, 0);
    }

    /*//////////////////////////////////////////////////////////////
      2. FULL LIFECYCLE WITH ERC20 TOKEN
    //////////////////////////////////////////////////////////////*/

    function test_FullLifecycle_ERC20() public {
        token.mint(creator, BOUNTY_AMOUNT);

        vm.prank(creator);
        token.approve(address(escrowVault), BOUNTY_AMOUNT);

        vm.prank(creator);
        uint256 taskId = taskManager.createTask("spec-cid", address(token), BOUNTY_AMOUNT, 0);

        assertEq(token.balanceOf(address(escrowVault)), BOUNTY_AMOUNT);

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid");

        vm.prank(creator);
        taskManager.selectWinner(taskId, agent1);

        vm.warp(block.timestamp + 48 hours + 1);

        uint256 agent1TokenBefore = token.balanceOf(agent1);
        uint256 treasuryTokenBefore = token.balanceOf(treasury);

        taskManager.finalizeTask(taskId);

        uint256 fee = (BOUNTY_AMOUNT * 300) / 10_000;
        assertEq(token.balanceOf(agent1), agent1TokenBefore + BOUNTY_AMOUNT - fee);
        assertEq(token.balanceOf(treasury), treasuryTokenBefore + fee);
        assertEq(token.balanceOf(address(escrowVault)), 0);
    }

    /*//////////////////////////////////////////////////////////////
      3. DISPUTE FLOW: DISPUTER WINS
    //////////////////////////////////////////////////////////////*/

    function test_DisputeFlow_DisputerWins() public {
        // Create task with two submissions
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "sub-1");
        vm.prank(agent2);
        taskManager.submitWork(taskId, "sub-2");

        // Creator selects agent1
        vm.prank(creator);
        taskManager.selectWinner(taskId, agent1);

        // agent2 disputes
        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);
        uint256 agent2Before = agent2.balance;

        vm.prank(agent2);
        uint256 disputeId = disputeResolver.startDispute{ value: stake }(taskId);

        // Voters support disputer (>60%)
        vm.prank(voter1);
        disputeResolver.submitVote(disputeId, true);
        vm.prank(voter2);
        disputeResolver.submitVote(disputeId, true);
        vm.prank(voter3);
        disputeResolver.submitVote(disputeId, true);

        vm.warp(block.timestamp + 48 hours + 1);
        disputeResolver.resolveDispute(disputeId);

        // Verify disputer won
        IDisputeResolver.Dispute memory dispute = disputeResolver.getDispute(disputeId);
        assertTrue(dispute.disputerWon);

        // Verify agent2 got bounty + stake back
        uint256 fee = (BOUNTY_AMOUNT * 300) / 10_000;
        assertEq(agent2.balance, agent2Before - stake + stake + BOUNTY_AMOUNT - fee);

        // Verify task completed with agent2 as winner
        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.Completed));
        assertEq(task.selectedWinner, agent2);

        // Verify reputation: agent2 gets task win + dispute win
        (uint64 taskWins, uint64 disputeWins,,) = agentAdapter.getReputationSummary(agent2);
        assertEq(taskWins, 1);
        assertEq(disputeWins, 1);
    }

    /*//////////////////////////////////////////////////////////////
      4. DISPUTE FLOW: DISPUTER LOSES
    //////////////////////////////////////////////////////////////*/

    function test_DisputeFlow_DisputerLoses() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "sub-1");
        vm.prank(agent2);
        taskManager.submitWork(taskId, "sub-2");

        vm.prank(creator);
        taskManager.selectWinner(taskId, agent1);

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);
        uint256 agent2Before = agent2.balance;
        uint256 agent1Before = agent1.balance;

        vm.prank(agent2);
        uint256 disputeId = disputeResolver.startDispute{ value: stake }(taskId);

        // Voters side against disputer
        vm.prank(voter1);
        disputeResolver.submitVote(disputeId, false);
        vm.prank(voter2);
        disputeResolver.submitVote(disputeId, false);
        vm.prank(voter3);
        disputeResolver.submitVote(disputeId, false);

        vm.warp(block.timestamp + 48 hours + 1);
        disputeResolver.resolveDispute(disputeId);

        // Disputer loses stake
        IDisputeResolver.Dispute memory dispute = disputeResolver.getDispute(disputeId);
        assertFalse(dispute.disputerWon);
        assertEq(agent2.balance, agent2Before - stake);

        // Original winner gets bounty
        uint256 fee = (BOUNTY_AMOUNT * 300) / 10_000;
        assertEq(agent1.balance, agent1Before + BOUNTY_AMOUNT - fee);

        // Task completed with original winner
        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.Completed));
        assertEq(task.selectedWinner, agent1);

        // agent2 gets dispute loss
        (,, uint64 disputeLosses,) = agentAdapter.getReputationSummary(agent2);
        assertEq(disputeLosses, 1);
    }

    /*//////////////////////////////////////////////////////////////
      5. MULTI-SUBMISSION THEN SELECT SPECIFIC WINNER
    //////////////////////////////////////////////////////////////*/

    function test_MultiSubmissionSelectSpecificWinner() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        // Three agents submit
        vm.prank(agent1);
        taskManager.submitWork(taskId, "sub-1");
        vm.prank(agent2);
        taskManager.submitWork(taskId, "sub-2");
        vm.prank(agent3);
        taskManager.submitWork(taskId, "sub-3");

        assertEq(taskManager.getSubmissionCount(taskId), 3);

        // Select agent3 specifically
        vm.prank(creator);
        taskManager.selectWinner(taskId, agent3);

        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(task.selectedWinner, agent3);

        vm.warp(block.timestamp + 48 hours + 1);

        uint256 agent3Before = agent3.balance;
        taskManager.finalizeTask(taskId);

        uint256 fee = (BOUNTY_AMOUNT * 300) / 10_000;
        assertEq(agent3.balance, agent3Before + BOUNTY_AMOUNT - fee);
    }

    /*//////////////////////////////////////////////////////////////
      6. CANCEL AND REFUND FLOW
    //////////////////////////////////////////////////////////////*/

    function test_CancelAndRefundFlow() public {
        uint256 creatorBefore = creator.balance;

        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        assertEq(creator.balance, creatorBefore - BOUNTY_AMOUNT);

        // Verify escrow holds funds
        (, uint256 escrowed) = escrowVault.getBalance(taskId);
        assertEq(escrowed, BOUNTY_AMOUNT);

        // Cancel (no submissions)
        vm.prank(creator);
        taskManager.cancelTask(taskId);

        // Full refund
        assertEq(creator.balance, creatorBefore);

        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.Cancelled));

        (, uint256 afterCancel) = escrowVault.getBalance(taskId);
        assertEq(afterCancel, 0);
    }

    /*//////////////////////////////////////////////////////////////
      7. AGENT REGISTRATION -> SUBMISSION -> WIN -> REPUTATION
    //////////////////////////////////////////////////////////////*/

    function test_AgentRegistrationToReputationUpdate() public {
        // Fresh agent registers
        address newAgent = address(0x9999);
        vm.deal(newAgent, 1 ether);

        vm.prank(newAgent);
        uint256 agentId = agentAdapter.register("ipfs://new-agent");
        assertTrue(agentId > 0);
        assertTrue(agentAdapter.isRegistered(newAgent));

        // Check initial reputation
        (uint64 tw1, uint64 dw1, uint64 dl1,) = agentAdapter.getReputationSummary(newAgent);
        assertEq(tw1, 0);
        assertEq(dw1, 0);
        assertEq(dl1, 0);

        // Create task
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        // Submit and win
        vm.prank(newAgent);
        taskManager.submitWork(taskId, "sub-cid");

        vm.prank(creator);
        taskManager.selectWinner(taskId, newAgent);

        vm.warp(block.timestamp + 48 hours + 1);
        taskManager.finalizeTask(taskId);

        // Check reputation updated
        (uint64 tw2,,, int256 rep) = agentAdapter.getReputationSummary(newAgent);
        assertEq(tw2, 1);
        assertEq(rep, 10); // TASK_WIN_VALUE = 10

        // Check vote weight increased
        uint256 weight = agentAdapter.getVoteWeight(newAgent);
        assertGe(weight, 1);
    }

    /*//////////////////////////////////////////////////////////////
      8. MULTIPLE AGENTS COMPETING ON SAME TASK
    //////////////////////////////////////////////////////////////*/

    function test_MultipleAgentsCompeting() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        // All three agents submit
        vm.prank(agent1);
        taskManager.submitWork(taskId, "sub-1");
        vm.prank(agent2);
        taskManager.submitWork(taskId, "sub-2");
        vm.prank(agent3);
        taskManager.submitWork(taskId, "sub-3");

        // All have submitted
        assertTrue(taskManager.hasSubmitted(taskId, agent1));
        assertTrue(taskManager.hasSubmitted(taskId, agent2));
        assertTrue(taskManager.hasSubmitted(taskId, agent3));
        assertEq(taskManager.getSubmissionCount(taskId), 3);

        // Creator picks agent2
        uint256 agent2Before = agent2.balance;

        vm.prank(creator);
        taskManager.selectWinner(taskId, agent2);

        vm.warp(block.timestamp + 48 hours + 1);
        taskManager.finalizeTask(taskId);

        // Only agent2 gets paid
        uint256 fee = (BOUNTY_AMOUNT * 300) / 10_000;
        assertEq(agent2.balance, agent2Before + BOUNTY_AMOUNT - fee);

        // Only agent2 gets reputation
        (uint64 tw1,,,) = agentAdapter.getReputationSummary(agent1);
        (uint64 tw2,,,) = agentAdapter.getReputationSummary(agent2);
        (uint64 tw3,,,) = agentAdapter.getReputationSummary(agent3);
        assertEq(tw1, 0);
        assertEq(tw2, 1);
        assertEq(tw3, 0);
    }

    /*//////////////////////////////////////////////////////////////
      9. TASK WITH DEADLINE EXPIRY
    //////////////////////////////////////////////////////////////*/

    function test_TaskWithDeadlineExpiry() public {
        vm.warp(1000);
        uint256 deadline = block.timestamp + 7 days;

        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "spec-cid", address(0), BOUNTY_AMOUNT, deadline
        );

        // Agent submits before deadline
        vm.prank(agent1);
        taskManager.submitWork(taskId, "sub-cid");

        // Creator doesn't select within selection deadline
        vm.warp(deadline + taskManager.selectionDeadline() + 1);

        uint256 creatorBefore = creator.balance;

        // Anyone can trigger refund for expired task
        taskManager.refundExpiredTask(taskId);

        assertEq(creator.balance, creatorBefore + BOUNTY_AMOUNT);

        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.Refunded));
    }

    /*//////////////////////////////////////////////////////////////
      10. REJECT ALL AND DISPUTE ON REJECTION
    //////////////////////////////////////////////////////////////*/

    function test_RejectAllAndDisputeOnRejection() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "sub-1");
        vm.prank(agent2);
        taskManager.submitWork(taskId, "sub-2");

        // Creator rejects all
        vm.prank(creator);
        taskManager.rejectAll(taskId, "Not good enough");

        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.InReview));
        assertEq(task.selectedWinner, address(0));

        // agent1 disputes the rejection
        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);
        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{ value: stake }(taskId);

        // Voters support the disputer
        vm.prank(voter1);
        disputeResolver.submitVote(disputeId, true);
        vm.prank(voter2);
        disputeResolver.submitVote(disputeId, true);

        vm.warp(block.timestamp + 48 hours + 1);

        uint256 agent1Before = agent1.balance;
        disputeResolver.resolveDispute(disputeId);

        // agent1 (disputer) wins - gets bounty
        IDisputeResolver.Dispute memory dispute = disputeResolver.getDispute(disputeId);
        assertTrue(dispute.disputerWon);

        uint256 fee = (BOUNTY_AMOUNT * 300) / 10_000;
        assertEq(agent1.balance, agent1Before + stake + BOUNTY_AMOUNT - fee);

        // Task completed with agent1 as winner (overriding rejection)
        task = taskManager.getTask(taskId);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.Completed));
        assertEq(task.selectedWinner, agent1);
    }
}
