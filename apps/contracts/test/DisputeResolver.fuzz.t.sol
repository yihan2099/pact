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

contract DisputeResolverFuzzTest is Test {
    TaskManager public taskManager;
    EscrowVault public escrowVault;
    ClawboyAgentAdapter public agentAdapter;
    ERC8004IdentityRegistry public identityRegistry;
    ERC8004ReputationRegistry public reputationRegistry;
    DisputeResolver public disputeResolver;

    address public creator = address(0x1);
    address public agent1 = address(0x2);
    address public agent2 = address(0x3);
    address public treasury = address(0x7);

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

        vm.deal(creator, 100 ether);
        vm.deal(agent1, 10 ether);
        vm.deal(agent2, 10 ether);

        vm.prank(agent1);
        agentAdapter.register("ipfs://agent1");
        vm.prank(agent2);
        agentAdapter.register("ipfs://agent2");
    }

    function _createDisputeScenario() internal returns (uint256 taskId, uint256 disputeId) {
        vm.prank(creator);
        taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "sub-1");

        vm.prank(agent2);
        taskManager.submitWork(taskId, "sub-2");

        vm.prank(creator);
        taskManager.selectWinner(taskId, agent1);

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);
        vm.prank(agent2);
        disputeId = disputeResolver.startDispute{ value: stake }(taskId);
    }

    /*//////////////////////////////////////////////////////////////
                     FUZZ: STAKE CALCULATION
    //////////////////////////////////////////////////////////////*/

    function testFuzz_StakeCalculation(uint256 bountyAmount) public view {
        bountyAmount = bound(bountyAmount, 0, 1_000_000 ether);

        uint256 stake = disputeResolver.calculateDisputeStake(bountyAmount);

        uint256 percentStake = (bountyAmount * 1) / 100;
        uint256 expectedStake = percentStake > 0.01 ether ? percentStake : 0.01 ether;

        assertEq(stake, expectedStake);
        assertGe(stake, 0.01 ether);
    }

    /*//////////////////////////////////////////////////////////////
                     FUZZ: VOTE WEIGHTING
    //////////////////////////////////////////////////////////////*/

    function testFuzz_VoteWeighting(uint8 numVotersFor, uint8 numVotersAgainst) public {
        numVotersFor = uint8(bound(numVotersFor, 0, 10));
        numVotersAgainst = uint8(bound(numVotersAgainst, 0, 10));

        if (numVotersFor + numVotersAgainst == 0) return;

        (, uint256 disputeId) = _createDisputeScenario();

        uint256 totalWeightFor;
        uint256 totalWeightAgainst;

        for (uint256 i = 0; i < numVotersFor; i++) {
            address voter = address(uint160(0x5000 + i));
            vm.deal(voter, 1 ether);
            vm.prank(voter);
            agentAdapter.register(string(abi.encodePacked("ipfs://vf-", i)));
            uint256 w = agentAdapter.getVoteWeight(voter);
            totalWeightFor += w;
            vm.prank(voter);
            disputeResolver.submitVote(disputeId, true);
        }

        for (uint256 i = 0; i < numVotersAgainst; i++) {
            address voter = address(uint160(0x6000 + i));
            vm.deal(voter, 1 ether);
            vm.prank(voter);
            agentAdapter.register(string(abi.encodePacked("ipfs://va-", i)));
            uint256 w = agentAdapter.getVoteWeight(voter);
            totalWeightAgainst += w;
            vm.prank(voter);
            disputeResolver.submitVote(disputeId, false);
        }

        IDisputeResolver.Dispute memory dispute = disputeResolver.getDispute(disputeId);
        assertEq(dispute.votesForDisputer, totalWeightFor);
        assertEq(dispute.votesAgainstDisputer, totalWeightAgainst);
    }

    /*//////////////////////////////////////////////////////////////
                 FUZZ: MULTI-VOTER SCENARIOS
    //////////////////////////////////////////////////////////////*/

    function testFuzz_MultiVoterScenarios(uint8 numVoters, uint256 voteSeed) public {
        numVoters = uint8(bound(numVoters, 1, 15));

        (, uint256 disputeId) = _createDisputeScenario();

        for (uint256 i = 0; i < numVoters; i++) {
            address voter = address(uint160(0x7000 + i));
            vm.deal(voter, 1 ether);
            vm.prank(voter);
            agentAdapter.register(string(abi.encodePacked("ipfs://mv-", i)));

            bool supportsDisputer = (uint256(keccak256(abi.encodePacked(voteSeed, i))) % 2) == 0;

            vm.prank(voter);
            disputeResolver.submitVote(disputeId, supportsDisputer);
        }

        address[] memory voters = disputeResolver.getVoters(disputeId);
        assertEq(voters.length, numVoters);

        // Resolve after voting period
        vm.warp(block.timestamp + 48 hours + 1);
        disputeResolver.resolveDispute(disputeId);

        IDisputeResolver.Dispute memory dispute = disputeResolver.getDispute(disputeId);
        assertEq(uint256(dispute.status), uint256(IDisputeResolver.DisputeStatus.Resolved));
    }

    /*//////////////////////////////////////////////////////////////
                 FUZZ: DISPUTE TIMING EDGE CASES
    //////////////////////////////////////////////////////////////*/

    function testFuzz_DisputeTimingEdgeCases(uint256 warpOffset) public {
        warpOffset = bound(warpOffset, 0, 48 hours - 1);

        (, uint256 disputeId) = _createDisputeScenario();

        IDisputeResolver.Dispute memory dispute = disputeResolver.getDispute(disputeId);

        // Register a voter
        address voter = address(uint160(0x8000));
        vm.deal(voter, 1 ether);
        vm.prank(voter);
        agentAdapter.register("ipfs://timing-voter");

        // Warp within voting period
        vm.warp(dispute.votingDeadline - (48 hours - warpOffset));

        if (block.timestamp <= dispute.votingDeadline) {
            // Should be able to vote
            vm.prank(voter);
            disputeResolver.submitVote(disputeId, true);
            assertTrue(disputeResolver.hasVoted(disputeId, voter));
        }
    }

    /*//////////////////////////////////////////////////////////////
                    MINIMUM STAKE DISPUTE
    //////////////////////////////////////////////////////////////*/

    function test_DisputeWithMinimumStake() public {
        // Small bounty -> minimum stake applies
        uint256 smallBounty = 0.5 ether;
        vm.prank(creator);
        uint256 taskId =
            taskManager.createTask{ value: smallBounty }("spec-cid", address(0), smallBounty, 0);

        vm.prank(agent1);
        taskManager.submitWork(taskId, "sub-1");

        vm.prank(creator);
        taskManager.selectWinner(taskId, agent1);

        // agent1 disputes their own selection? No, need agent2 to submit first.
        // We need a scenario where agent2 also submitted
        // Let's re-do with agent2 submitting too
        vm.prank(creator);
        uint256 taskId2 = taskManager.createTask{ value: smallBounty }(
            "spec-cid-2", address(0), smallBounty, 0
        );
        vm.prank(agent1);
        taskManager.submitWork(taskId2, "sub-1");
        vm.prank(agent2);
        taskManager.submitWork(taskId2, "sub-2");
        vm.prank(creator);
        taskManager.selectWinner(taskId2, agent1);

        uint256 stake = disputeResolver.calculateDisputeStake(smallBounty);
        assertEq(stake, 0.01 ether); // MIN_DISPUTE_STAKE

        vm.prank(agent2);
        uint256 disputeId = disputeResolver.startDispute{ value: stake }(taskId2);

        IDisputeResolver.Dispute memory dispute = disputeResolver.getDispute(disputeId);
        assertEq(dispute.disputeStake, 0.01 ether);
    }

    /*//////////////////////////////////////////////////////////////
                   TIED VOTES RESOLUTION
    //////////////////////////////////////////////////////////////*/

    function test_DisputeResolutionWithTiedVotes() public {
        (, uint256 disputeId) = _createDisputeScenario();

        // Create two voters with identical reputation (both fresh registrations, weight=1)
        address voterA = address(uint160(0x9001));
        address voterB = address(uint160(0x9002));
        vm.deal(voterA, 1 ether);
        vm.deal(voterB, 1 ether);
        vm.prank(voterA);
        agentAdapter.register("ipfs://voterA");
        vm.prank(voterB);
        agentAdapter.register("ipfs://voterB");

        // One vote each way - tied at 50/50
        vm.prank(voterA);
        disputeResolver.submitVote(disputeId, true);
        vm.prank(voterB);
        disputeResolver.submitVote(disputeId, false);

        vm.warp(block.timestamp + 48 hours + 1);
        disputeResolver.resolveDispute(disputeId);

        IDisputeResolver.Dispute memory dispute = disputeResolver.getDispute(disputeId);
        // 50% < 60% threshold, so creator wins
        assertFalse(dispute.disputerWon);
    }

    /*//////////////////////////////////////////////////////////////
                 NON-SUBMITTER CANNOT DISPUTE
    //////////////////////////////////////////////////////////////*/

    function test_NonSubmitterCannotDispute() public {
        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: BOUNTY_AMOUNT }(
            "spec-cid", address(0), BOUNTY_AMOUNT, 0
        );

        vm.prank(agent1);
        taskManager.submitWork(taskId, "sub-1");

        vm.prank(creator);
        taskManager.selectWinner(taskId, agent1);

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);

        // agent2 didn't submit
        vm.prank(agent2);
        vm.expectRevert(DisputeResolver.NotSubmitter.selector);
        disputeResolver.startDispute{ value: stake }(taskId);
    }

    /*//////////////////////////////////////////////////////////////
                   DOUBLE VOTING PREVENTION
    //////////////////////////////////////////////////////////////*/

    function test_DoubleVotingPrevention() public {
        (, uint256 disputeId) = _createDisputeScenario();

        address voter = address(uint160(0xA001));
        vm.deal(voter, 1 ether);
        vm.prank(voter);
        agentAdapter.register("ipfs://voter-dv");

        vm.prank(voter);
        disputeResolver.submitVote(disputeId, true);

        vm.prank(voter);
        vm.expectRevert(DisputeResolver.AlreadyVoted.selector);
        disputeResolver.submitVote(disputeId, false);
    }

    /*//////////////////////////////////////////////////////////////
              DISPUTE AFTER CHALLENGE WINDOW
    //////////////////////////////////////////////////////////////*/

    function test_DisputeAfterChallengeWindow() public {
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

        // Warp past challenge window
        ITaskManager.Task memory task = taskManager.getTask(taskId);
        vm.warp(task.challengeDeadline + 1);

        // Finalize first (so task is Completed, not InReview)
        taskManager.finalizeTask(taskId);

        uint256 stake = disputeResolver.calculateDisputeStake(BOUNTY_AMOUNT);
        vm.prank(agent2);
        vm.expectRevert(DisputeResolver.TaskNotInReview.selector);
        disputeResolver.startDispute{ value: stake }(taskId);
    }

    /*//////////////////////////////////////////////////////////////
              FUZZ: VOTER COUNT AND VOTE DISTRIBUTION
    //////////////////////////////////////////////////////////////*/

    function testFuzz_VoterCountAndDistribution(uint8 forCount, uint8 againstCount) public {
        forCount = uint8(bound(forCount, 0, 8));
        againstCount = uint8(bound(againstCount, 0, 8));

        if (forCount + againstCount == 0) return;

        (, uint256 disputeId) = _createDisputeScenario();

        for (uint256 i = 0; i < forCount; i++) {
            address voter = address(uint160(0xB000 + i));
            vm.deal(voter, 1 ether);
            vm.prank(voter);
            agentAdapter.register(string(abi.encodePacked("ipfs://f-", i)));
            vm.prank(voter);
            disputeResolver.submitVote(disputeId, true);
        }

        for (uint256 i = 0; i < againstCount; i++) {
            address voter = address(uint160(0xC000 + i));
            vm.deal(voter, 1 ether);
            vm.prank(voter);
            agentAdapter.register(string(abi.encodePacked("ipfs://g-", i)));
            vm.prank(voter);
            disputeResolver.submitVote(disputeId, false);
        }

        vm.warp(block.timestamp + 48 hours + 1);
        disputeResolver.resolveDispute(disputeId);

        IDisputeResolver.Dispute memory dispute = disputeResolver.getDispute(disputeId);
        assertEq(uint256(dispute.status), uint256(IDisputeResolver.DisputeStatus.Resolved));

        // Verify outcome matches 60% threshold logic
        uint256 totalVotes = dispute.votesForDisputer + dispute.votesAgainstDisputer;
        if (totalVotes > 0) {
            uint256 disputerBps = (dispute.votesForDisputer * 10_000) / totalVotes;
            assertEq(dispute.disputerWon, disputerBps >= 6000);
        } else {
            assertFalse(dispute.disputerWon);
        }
    }
}
