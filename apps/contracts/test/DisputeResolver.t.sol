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
import { IDisputeResolver } from "../src/interfaces/IDisputeResolver.sol";
import { IClawboyAgentAdapter } from "../src/IClawboyAgentAdapter.sol";

contract DisputeResolverTest is Test {
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
    address public voter3 = address(0x6);

    uint256 public constant BOUNTY_AMOUNT = 1 ether;

    function setUp() public {
        // Deploy ERC-8004 IdentityRegistry
        identityRegistry = new ERC8004IdentityRegistry();

        // Deploy ERC-8004 ReputationRegistry
        reputationRegistry = new ERC8004ReputationRegistry();
        reputationRegistry.initialize(address(identityRegistry));

        // Deploy ClawboyAgentAdapter
        agentAdapter =
            new ClawboyAgentAdapter(address(identityRegistry), address(reputationRegistry));

        // Deploy EscrowVault with predicted TaskManager address
        address predictedTaskManager =
            vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        escrowVault = new EscrowVault(predictedTaskManager);

        // Deploy TaskManager
        taskManager = new TaskManager(address(escrowVault), address(agentAdapter));

        // Deploy DisputeResolver
        disputeResolver = new DisputeResolver(address(taskManager), address(agentAdapter));

        // Configure access control
        taskManager.setDisputeResolver(address(disputeResolver));
        agentAdapter.setTaskManager(address(taskManager));
        agentAdapter.setDisputeResolver(address(disputeResolver));

        // Give accounts some ETH
        vm.deal(creator, 10 ether);
        vm.deal(agent1, 1 ether);
        vm.deal(agent2, 1 ether);
        vm.deal(voter1, 1 ether);
        vm.deal(voter2, 1 ether);
        vm.deal(voter3, 1 ether);

        // Register all agents/voters
        vm.prank(agent1);
        agentAdapter.register("ipfs://agent1-profile-cid");

        vm.prank(agent2);
        agentAdapter.register("ipfs://agent2-profile-cid");

        vm.prank(voter1);
        agentAdapter.register("ipfs://voter1-profile-cid");

        vm.prank(voter2);
        agentAdapter.register("ipfs://voter2-profile-cid");

        vm.prank(voter3);
        agentAdapter.register("ipfs://voter3-profile-cid");

        // Give voters some reputation for weighted voting via task wins
        _giveVoterReputation(voter1, 10); // ~100 rep -> weight ~7
        _giveVoterReputation(voter2, 5); // ~50 rep -> weight ~6
        _giveVoterReputation(voter3, 1); // ~10 rep -> weight ~4
    }

    /// @dev Helper to give voters reputation by simulating task wins
    function _giveVoterReputation(address voter, uint256 taskWinCount) internal {
        for (uint256 i = 0; i < taskWinCount; i++) {
            vm.prank(address(taskManager));
            agentAdapter.recordTaskWin(voter, i + 1000); // Use high task IDs to avoid conflicts
        }
    }

    /*//////////////////////////////////////////////////////////////
                          HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _createTaskWithSubmission() internal returns (uint256 taskId) {
        vm.prank(creator);
        taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "submission-cid-1");
    }

    function _createTaskWithMultipleSubmissions() internal returns (uint256 taskId) {
        vm.prank(creator);
        taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "task-spec-cid", address(0), BOUNTY_AMOUNT, 0
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

        // Creator rejects all
        vm.prank(creator);
        taskManager.rejectAll(taskId, "Not good enough");

        // Agent1 disputes the rejection
        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);
        uint256 agent1BalanceBefore = agent1.balance;

        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{ value: stake }(taskId);

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
        disputeResolver.startDispute{ value: stake }(taskId);
    }

    function test_StartDispute_RevertIfInsufficientStake() public {
        uint256 taskId = _createTaskWithSubmission();

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        // Send less than required stake
        vm.prank(agent1);
        vm.expectRevert(DisputeResolver.InsufficientStake.selector);
        disputeResolver.startDispute{ value: 0.001 ether }(taskId);
    }

    function test_StartDispute_RevertIfNotInReview() public {
        uint256 taskId = _createTaskWithSubmission();

        // Task is still Open, not InReview
        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);

        vm.prank(agent1);
        vm.expectRevert(DisputeResolver.TaskNotInReview.selector);
        disputeResolver.startDispute{ value: stake }(taskId);
    }

    function test_StartDispute_RevertIfDisputeAlreadyExists() public {
        uint256 taskId = _createTaskWithMultipleSubmissions();

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);

        // First dispute succeeds
        vm.prank(agent1);
        disputeResolver.startDispute{ value: stake }(taskId);

        // Second dispute fails - task is now Disputed, not InReview
        vm.prank(agent2);
        vm.expectRevert(DisputeResolver.TaskNotInReview.selector);
        disputeResolver.startDispute{ value: stake }(taskId);
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
        uint256 disputeId = disputeResolver.startDispute{ value: stake }(taskId);

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
        uint256 disputeId = disputeResolver.startDispute{ value: stake }(taskId);

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
        uint256 disputeId = disputeResolver.startDispute{ value: stake }(taskId);

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
        uint256 disputeId = disputeResolver.startDispute{ value: stake }(taskId);

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
        uint256 disputeId = disputeResolver.startDispute{ value: stake }(taskId);

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
        agentAdapter.register("ipfs://creator-profile");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);
        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{ value: stake }(taskId);

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
        uint256 disputeId = disputeResolver.startDispute{ value: stake }(taskId);

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
        uint256 disputeId = disputeResolver.startDispute{ value: stake }(taskId);

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
        assertEq(agent1.balance, agent1BalanceBefore - stake + stake + BOUNTY_AMOUNT);

        // Verify task completed with disputer as winner
        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.Completed));
        assertEq(task.selectedWinner, agent1);

        // Verify ERC-8004 feedback recorded
        (, uint64 disputeWins,,) = agentAdapter.getReputationSummary(agent1);
        assertEq(disputeWins, 1);
    }

    function test_ResolveDispute_CreatorWins() public {
        uint256 taskId = _createTaskWithSubmission();

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);
        uint256 agent1BalanceBefore = agent1.balance;
        uint256 creatorBalanceBefore = creator.balance;

        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{ value: stake }(taskId);

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

        // Verify ERC-8004 feedback recorded for dispute loss
        (,, uint64 disputeLosses,) = agentAdapter.getReputationSummary(agent1);
        assertEq(disputeLosses, 1);
    }

    function test_ResolveDispute_NoVotesCreatorWins() public {
        uint256 taskId = _createTaskWithSubmission();

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);

        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{ value: stake }(taskId);

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
        uint256 disputeId = disputeResolver.startDispute{ value: stake }(taskId);

        // Get vote weights
        uint256 voter1Weight = agentAdapter.getVoteWeight(voter1);
        uint256 voter2Weight = agentAdapter.getVoteWeight(voter2);
        uint256 voter3Weight = agentAdapter.getVoteWeight(voter3);

        // voter1 votes for disputer, voter2 and voter3 vote against
        // If voter1's weight is less than 60% of total, creator wins
        vm.prank(voter1);
        disputeResolver.submitVote(disputeId, true);

        vm.prank(voter2);
        disputeResolver.submitVote(disputeId, false);

        vm.prank(voter3);
        disputeResolver.submitVote(disputeId, false);

        vm.warp(block.timestamp + 48 hours + 1);

        disputeResolver.resolveDispute(disputeId);

        IDisputeResolver.Dispute memory dispute = disputeResolver.getDispute(disputeId);

        // Check if voter1 alone is < 60% of total
        uint256 totalWeight = voter1Weight + voter2Weight + voter3Weight;
        bool shouldDisputerWin = (voter1Weight * 100) / totalWeight >= 60;
        assertEq(dispute.disputerWon, shouldDisputerWin);
    }

    function test_ResolveDispute_RevertIfVotingStillActive() public {
        uint256 taskId = _createTaskWithSubmission();

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);

        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{ value: stake }(taskId);

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
        uint256 disputeId = disputeResolver.startDispute{ value: stake }(taskId);

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
        uint256 disputeId = disputeResolver.startDispute{ value: stake }(taskId);

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
                         VIEW FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_GetVoters() public {
        uint256 taskId = _createTaskWithSubmission();

        vm.prank(creator);
        taskManager.rejectAll(taskId, "reason");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);

        vm.prank(agent1);
        uint256 disputeId = disputeResolver.startDispute{ value: stake }(taskId);

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
        uint256 disputeId = disputeResolver.startDispute{ value: stake }(taskId);

        assertEq(disputeResolver.getDisputeByTask(taskId), disputeId);
    }

    function test_DisputeCount() public {
        assertEq(disputeResolver.disputeCount(), 0);

        uint256 taskId1 = _createTaskWithSubmission();
        vm.prank(creator);
        taskManager.rejectAll(taskId1, "reason");

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);

        vm.prank(agent1);
        disputeResolver.startDispute{ value: stake }(taskId1);

        assertEq(disputeResolver.disputeCount(), 1);
    }
}
