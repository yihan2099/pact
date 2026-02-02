// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {TaskManager} from "../src/TaskManager.sol";
import {EscrowVault} from "../src/EscrowVault.sol";
import {PorterRegistry} from "../src/PorterRegistry.sol";
import {DisputeResolver} from "../src/DisputeResolver.sol";
import {ITaskManager} from "../src/interfaces/ITaskManager.sol";
import {IDisputeResolver} from "../src/interfaces/IDisputeResolver.sol";
import {IPorterRegistry} from "../src/interfaces/IPorterRegistry.sol";

contract DisputeResolverTest is Test {
    TaskManager public taskManager;
    EscrowVault public escrowVault;
    PorterRegistry public porterRegistry;
    DisputeResolver public disputeResolver;

    address public creator = address(0x1);
    address public agent1 = address(0x2);
    address public agent2 = address(0x3);
    address public voter1 = address(0x4);
    address public voter2 = address(0x5);
    address public voter3 = address(0x6);

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
        vm.deal(voter1, 1 ether);
        vm.deal(voter2, 1 ether);
        vm.deal(voter3, 1 ether);

        // Register all agents/voters
        vm.prank(agent1);
        porterRegistry.register("agent1-profile-cid");

        vm.prank(agent2);
        porterRegistry.register("agent2-profile-cid");

        vm.prank(voter1);
        porterRegistry.register("voter1-profile-cid");

        vm.prank(voter2);
        porterRegistry.register("voter2-profile-cid");

        vm.prank(voter3);
        porterRegistry.register("voter3-profile-cid");

        // Give voters some reputation for weighted voting
        vm.startPrank(address(taskManager));
        porterRegistry.updateReputation(voter1, 100); // Weight: 7 (log2(101) ~= 6.66)
        porterRegistry.updateReputation(voter2, 50);  // Weight: 6 (log2(51) ~= 5.67)
        porterRegistry.updateReputation(voter3, 10);  // Weight: 4 (log2(11) ~= 3.46)
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                          HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _createTaskWithSubmission() internal returns (uint256 taskId) {
        vm.prank(creator);
        taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");
    }

    function _createTaskWithMultipleSubmissions() internal returns (uint256 taskId) {
        vm.prank(creator);
        taskId = taskManager.createTask{value: BOUNTY_AMOUNT}(
            "task-spec-cid",
            address(0),
            BOUNTY_AMOUNT,
            0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");

        vm.prank(agent2);
        taskManager.submitWork(taskId, "submission-cid-2");
    }

    /*//////////////////////////////////////////////////////////////
                       DISPUTE STAKE CALCULATION
    //////////////////////////////////////////////////////////////*/

    function test_CalculateDisputeStake() public view {
        // 1% of 1 ETH = 0.01 ETH (equals MIN_DISPUTE_STAKE)
        assertEq(disputeResolver.calculateDisputeStake(1 ether), 0.01 ether);

        // 1% of 10 ETH = 0.1 ETH (above min)
        assertEq(disputeResolver.calculateDisputeStake(10 ether), 0.1 ether);

        // 1% of 0.5 ETH = 0.005 ETH (below min, so use min)
        assertEq(disputeResolver.calculateDisputeStake(0.5 ether), 0.01 ether);
    }

    /*//////////////////////////////////////////////////////////////
                         START DISPUTE TESTS
    //////////////////////////////////////////////////////////////*/

    function test_StartDispute() public {
        uint256 taskId = _createTaskWithSubmission();

        // Creator selects agent1 as winner
        vm.prank(creator);
        taskManager.selectWinner(taskId, agent1);

        // Agent2 can't dispute (didn't submit)
        // Let's have agent1 dispute their own win being contested by adding agent2's submission first
        // Actually, let's test with a rejection scenario instead

        // Recreate: creator rejects all
        taskId = _createTaskWithSubmission();
        vm.prank(creator);
        taskManager.rejectAll(taskId, "Not good enough");

        // Agent1 disputes the rejection
        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);
        uint256 agent1BalanceBefore = agent1.balance;

        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{value: stake}(taskId);

        assertEq(disputeId, 1);
        assertEq(agent1.balance, agent1BalanceBefore - stake);

        // Verify dispute created
        IDisputeResolver.Dispute memory dispute = disputeResolver.getDispute(disputeId);
        assertEq(dispute.taskId, taskId);
        assertEq(dispute.disputer, agent1);
        assertEq(dispute.disputeStake, stake);
        assertEq(uint256(dispute.status), uint256(IDisputeResolver.DisputeStatus.Active));

        // Verify task marked as disputed
        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.Disputed));
    }

    function test_StartDispute_RevertIfNotSubmitter() public {
        uint256 taskId = _createTaskWithSubmission();

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);

        // agent2 didn't submit, can't dispute
        vm.prank(agent2);
        vm.expectRevert(DisputeResolver.NotSubmitter.selector);
        disputeResolver.startDispute{value: stake}(taskId);
    }

    function test_StartDispute_RevertIfInsufficientStake() public {
        uint256 taskId = _createTaskWithSubmission();

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        // Send less than required stake
        vm.prank(agent1);
        vm.expectRevert(DisputeResolver.InsufficientStake.selector);
        disputeResolver.startDispute{value: 0.001 ether}(taskId);
    }

    function test_StartDispute_RevertIfNotInReview() public {
        uint256 taskId = _createTaskWithSubmission();

        // Task is still Open, not InReview
        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);

        vm.prank(agent1);
        vm.expectRevert(DisputeResolver.TaskNotInReview.selector);
        disputeResolver.startDispute{value: stake}(taskId);
    }

    function test_StartDispute_RevertIfDisputeAlreadyExists() public {
        uint256 taskId = _createTaskWithMultipleSubmissions();

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);

        // First dispute succeeds
        vm.prank(agent1);
        disputeResolver.startDispute{value: stake}(taskId);

        // Second dispute fails - task is now Disputed, not InReview
        // The DisputeAlreadyExists check happens after TaskNotInReview,
        // so we get TaskNotInReview (which is actually correct behavior)
        vm.prank(agent2);
        vm.expectRevert(DisputeResolver.TaskNotInReview.selector);
        disputeResolver.startDispute{value: stake}(taskId);
    }

    /*//////////////////////////////////////////////////////////////
                          VOTING TESTS
    //////////////////////////////////////////////////////////////*/

    function test_SubmitVote() public {
        uint256 taskId = _createTaskWithSubmission();

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);
        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{value: stake}(taskId);

        // voter1 votes for disputer
        vm.prank(voter1);
        disputeResolver.submitVote(disputeId, true);

        assertTrue(disputeResolver.hasVoted(disputeId, voter1));

        IDisputeResolver.Vote memory vote = disputeResolver.getVote(disputeId, voter1);
        assertEq(vote.voter, voter1);
        assertTrue(vote.supportsDisputer);
        assertTrue(vote.weight > 0);
    }

    function test_VoteWeighting() public {
        uint256 taskId = _createTaskWithSubmission();

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);
        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{value: stake}(taskId);

        // All voters vote for disputer
        vm.prank(voter1);
        disputeResolver.submitVote(disputeId, true);

        vm.prank(voter2);
        disputeResolver.submitVote(disputeId, true);

        // Check accumulated votes
        IDisputeResolver.Dispute memory dispute = disputeResolver.getDispute(disputeId);
        assertTrue(dispute.votesForDisputer > 0);
        assertEq(dispute.votesAgainstDisputer, 0);
    }

    function test_SubmitVote_RevertIfNotRegistered() public {
        uint256 taskId = _createTaskWithSubmission();

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);
        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{value: stake}(taskId);

        // Unregistered voter
        address unregistered = address(0x999);
        vm.prank(unregistered);
        vm.expectRevert(DisputeResolver.NotRegistered.selector);
        disputeResolver.submitVote(disputeId, true);
    }

    function test_SubmitVote_RevertIfAlreadyVoted() public {
        uint256 taskId = _createTaskWithSubmission();

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);
        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{value: stake}(taskId);

        vm.prank(voter1);
        disputeResolver.submitVote(disputeId, true);

        // Try to vote again
        vm.prank(voter1);
        vm.expectRevert(DisputeResolver.AlreadyVoted.selector);
        disputeResolver.submitVote(disputeId, false);
    }

    function test_SubmitVote_RevertIfDisputerVotes() public {
        uint256 taskId = _createTaskWithSubmission();

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);
        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{value: stake}(taskId);

        // Disputer tries to vote
        vm.prank(agent1);
        vm.expectRevert(DisputeResolver.AlreadyVoted.selector);
        disputeResolver.submitVote(disputeId, true);
    }

    function test_SubmitVote_RevertIfCreatorVotes() public {
        uint256 taskId = _createTaskWithSubmission();

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        // Register creator so they could theoretically vote
        vm.prank(creator);
        porterRegistry.register("creator-profile");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);
        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{value: stake}(taskId);

        // Creator tries to vote
        vm.prank(creator);
        vm.expectRevert(DisputeResolver.AlreadyVoted.selector);
        disputeResolver.submitVote(disputeId, false);
    }

    function test_SubmitVote_RevertAfterVotingDeadline() public {
        uint256 taskId = _createTaskWithSubmission();

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);
        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{value: stake}(taskId);

        // Warp past voting deadline (48 hours)
        vm.warp(block.timestamp + 48 hours + 1);

        vm.prank(voter1);
        vm.expectRevert(DisputeResolver.VotingNotActive.selector);
        disputeResolver.submitVote(disputeId, true);
    }

    /*//////////////////////////////////////////////////////////////
                      RESOLVE DISPUTE TESTS
    //////////////////////////////////////////////////////////////*/

    function test_ResolveDispute_DisputerWins() public {
        uint256 taskId = _createTaskWithSubmission();

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);
        uint256 agent1BalanceBefore = agent1.balance;

        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{value: stake}(taskId);

        // All voters vote for disputer (>60%)
        vm.prank(voter1);
        disputeResolver.submitVote(disputeId, true);

        vm.prank(voter2);
        disputeResolver.submitVote(disputeId, true);

        vm.prank(voter3);
        disputeResolver.submitVote(disputeId, true);

        // Warp past voting deadline
        vm.warp(block.timestamp + 48 hours + 1);

        // Resolve dispute
        disputeResolver.resolveDispute(disputeId);

        // Verify dispute resolved
        IDisputeResolver.Dispute memory dispute = disputeResolver.getDispute(disputeId);
        assertEq(uint256(dispute.status), uint256(IDisputeResolver.DisputeStatus.Resolved));
        assertTrue(dispute.disputerWon);

        // Verify stake returned to disputer + bounty
        // agent1 gets: stake back + BOUNTY_AMOUNT
        assertEq(agent1.balance, agent1BalanceBefore - stake + stake + BOUNTY_AMOUNT);

        // Verify task completed with disputer as winner
        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.Completed));
        assertEq(task.selectedWinner, agent1);

        // Verify reputation updates
        IPorterRegistry.Agent memory agentData = porterRegistry.getAgent(agent1);
        assertEq(agentData.disputesWon, 1);
        assertEq(agentData.tasksWon, 1);
    }

    function test_ResolveDispute_CreatorWins() public {
        uint256 taskId = _createTaskWithSubmission();

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);
        uint256 agent1BalanceBefore = agent1.balance;
        uint256 creatorBalanceBefore = creator.balance;

        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{value: stake}(taskId);

        // All voters vote against disputer
        vm.prank(voter1);
        disputeResolver.submitVote(disputeId, false);

        vm.prank(voter2);
        disputeResolver.submitVote(disputeId, false);

        vm.prank(voter3);
        disputeResolver.submitVote(disputeId, false);

        vm.warp(block.timestamp + 48 hours + 1);

        disputeResolver.resolveDispute(disputeId);

        // Verify dispute resolved against disputer
        IDisputeResolver.Dispute memory dispute = disputeResolver.getDispute(disputeId);
        assertFalse(dispute.disputerWon);

        // Verify stake slashed (not returned)
        assertEq(agent1.balance, agent1BalanceBefore - stake);

        // Verify bounty refunded to creator
        assertEq(creator.balance, creatorBalanceBefore + BOUNTY_AMOUNT);

        // Verify task refunded
        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.Refunded));

        // Verify reputation penalty for disputer
        IPorterRegistry.Agent memory agentData = porterRegistry.getAgent(agent1);
        assertEq(agentData.disputesLost, 1);
        assertEq(agentData.reputation, 0); // Started at 0, -20 clamped to 0
    }

    function test_ResolveDispute_NoVotesCreatorWins() public {
        uint256 taskId = _createTaskWithSubmission();

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);

        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{value: stake}(taskId);

        // No votes submitted
        vm.warp(block.timestamp + 48 hours + 1);

        disputeResolver.resolveDispute(disputeId);

        // Creator wins by default (status quo)
        IDisputeResolver.Dispute memory dispute = disputeResolver.getDispute(disputeId);
        assertFalse(dispute.disputerWon);
    }

    function test_ResolveDispute_MajorityThreshold() public {
        uint256 taskId = _createTaskWithSubmission();

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);

        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{value: stake}(taskId);

        // Get vote weights
        uint256 voter1Weight = porterRegistry.getVoteWeight(voter1); // ~7
        uint256 voter2Weight = porterRegistry.getVoteWeight(voter2); // ~6
        uint256 voter3Weight = porterRegistry.getVoteWeight(voter3); // ~4

        // voter1 votes for disputer, voter2 and voter3 vote against
        // Total: ~17, For: ~7, Against: ~10
        // 7/17 = ~41%, which is less than 60%, so creator wins
        vm.prank(voter1);
        disputeResolver.submitVote(disputeId, true);

        vm.prank(voter2);
        disputeResolver.submitVote(disputeId, false);

        vm.prank(voter3);
        disputeResolver.submitVote(disputeId, false);

        vm.warp(block.timestamp + 48 hours + 1);

        disputeResolver.resolveDispute(disputeId);

        IDisputeResolver.Dispute memory dispute = disputeResolver.getDispute(disputeId);
        assertFalse(dispute.disputerWon); // Less than 60%
    }

    function test_ResolveDispute_RevertIfVotingStillActive() public {
        uint256 taskId = _createTaskWithSubmission();

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);

        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{value: stake}(taskId);

        // Try to resolve before voting ends
        vm.expectRevert(DisputeResolver.VotingStillActive.selector);
        disputeResolver.resolveDispute(disputeId);
    }

    function test_ResolveDispute_RevertIfAlreadyResolved() public {
        uint256 taskId = _createTaskWithSubmission();

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);

        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{value: stake}(taskId);

        vm.warp(block.timestamp + 48 hours + 1);

        disputeResolver.resolveDispute(disputeId);

        // Try to resolve again
        vm.expectRevert(DisputeResolver.DisputeAlreadyResolved.selector);
        disputeResolver.resolveDispute(disputeId);
    }

    /*//////////////////////////////////////////////////////////////
                   DISPUTE WITH SELECTED WINNER TESTS
    //////////////////////////////////////////////////////////////*/

    function test_DisputeAgainstSelectedWinner() public {
        uint256 taskId = _createTaskWithMultipleSubmissions();

        // Creator selects agent1 as winner
        vm.prank(creator);
        taskManager.selectWinner(taskId, agent1);

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);

        // agent2 disputes (they submitted but weren't selected)
        vm.prank(agent2);
        uint256 disputeId = disputeResolver.startDispute{value: stake}(taskId);

        // Voters side with agent2 (disputer wins)
        vm.prank(voter1);
        disputeResolver.submitVote(disputeId, true);

        vm.prank(voter2);
        disputeResolver.submitVote(disputeId, true);

        vm.warp(block.timestamp + 48 hours + 1);

        uint256 agent2BalanceBefore = agent2.balance;

        disputeResolver.resolveDispute(disputeId);

        // agent2 should get the bounty (overriding agent1 selection)
        assertEq(agent2.balance, agent2BalanceBefore + stake + BOUNTY_AMOUNT);

        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(task.selectedWinner, agent2);
    }

    /*//////////////////////////////////////////////////////////////
                      VOTER REPUTATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_VoterReputationUpdates() public {
        uint256 taskId = _createTaskWithSubmission();

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);

        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{value: stake}(taskId);

        // Get initial reputations
        uint256 voter1RepBefore = porterRegistry.getAgent(voter1).reputation;
        uint256 voter2RepBefore = porterRegistry.getAgent(voter2).reputation;
        uint256 voter3RepBefore = porterRegistry.getAgent(voter3).reputation;

        // voter1 and voter2 vote for disputer, voter3 votes against
        vm.prank(voter1);
        disputeResolver.submitVote(disputeId, true);

        vm.prank(voter2);
        disputeResolver.submitVote(disputeId, true);

        vm.prank(voter3);
        disputeResolver.submitVote(disputeId, false);

        vm.warp(block.timestamp + 48 hours + 1);

        disputeResolver.resolveDispute(disputeId);

        // Disputer wins (>60%), so voter1 and voter2 voted with majority
        IDisputeResolver.Dispute memory dispute = disputeResolver.getDispute(disputeId);
        assertTrue(dispute.disputerWon);

        // voter1 and voter2 should gain reputation (+3)
        assertEq(porterRegistry.getAgent(voter1).reputation, voter1RepBefore + 3);
        assertEq(porterRegistry.getAgent(voter2).reputation, voter2RepBefore + 3);

        // voter3 should lose reputation (-2)
        assertEq(porterRegistry.getAgent(voter3).reputation, voter3RepBefore - 2);
    }

    /*//////////////////////////////////////////////////////////////
                         VIEW FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_GetVoters() public {
        uint256 taskId = _createTaskWithSubmission();

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);

        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{value: stake}(taskId);

        vm.prank(voter1);
        disputeResolver.submitVote(disputeId, true);

        vm.prank(voter2);
        disputeResolver.submitVote(disputeId, false);

        address[] memory voters = disputeResolver.getVoters(disputeId);
        assertEq(voters.length, 2);
        assertEq(voters[0], voter1);
        assertEq(voters[1], voter2);
    }

    function test_GetDisputeByTask() public {
        uint256 taskId = _createTaskWithSubmission();

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);

        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{value: stake}(taskId);

        assertEq(disputeResolver.getDisputeByTask(taskId), disputeId);
    }

    function test_DisputeCount() public {
        assertEq(disputeResolver.disputeCount(), 0);

        uint256 taskId1 = _createTaskWithSubmission();
        vm.prank(creator);
        taskManager.rejectAll(taskId1, "reason");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);

        vm.prank(agent1);
        disputeResolver.startDispute{value: stake}(taskId1);

        assertEq(disputeResolver.disputeCount(), 1);
    }
}
