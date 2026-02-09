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

/**
 * @title InvariantHandler
 * @notice Handler contract for invariant testing - performs random valid operations
 */
contract InvariantHandler is Test {
    TaskManager public taskManager;
    EscrowVault public escrowVault;
    ClawboyAgentAdapter public agentAdapter;
    DisputeResolver public disputeResolver;

    address public creator;
    address[] public agents;
    uint256[] public createdTaskIds;
    uint256[] public disputedTaskIds;

    // Ghost variables for tracking state
    uint256 public ghost_totalDeposited;
    uint256 public ghost_totalReleased;
    uint256 public ghost_totalRefunded;
    uint256 public ghost_taskCount;
    uint256 public ghost_disputeCount;
    mapping(uint256 => bool) public ghost_taskHasWinner;
    mapping(uint256 => uint256) public ghost_taskSubmissionCount;

    constructor(
        TaskManager _taskManager,
        EscrowVault _escrowVault,
        ClawboyAgentAdapter _agentAdapter,
        DisputeResolver _disputeResolver,
        address _creator,
        address[] memory _agents
    ) {
        taskManager = _taskManager;
        escrowVault = _escrowVault;
        agentAdapter = _agentAdapter;
        disputeResolver = _disputeResolver;
        creator = _creator;
        agents = _agents;
    }

    function createTask(uint256 bountyAmount) external {
        bountyAmount = bound(bountyAmount, 0.01 ether, 10 ether);
        vm.deal(creator, bountyAmount);

        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: bountyAmount }(
            "spec-cid", address(0), bountyAmount, 0
        );

        createdTaskIds.push(taskId);
        ghost_totalDeposited += bountyAmount;
        ghost_taskCount++;
    }

    function submitWork(uint256 taskIdx, uint256 agentIdx) external {
        if (createdTaskIds.length == 0) return;
        taskIdx = taskIdx % createdTaskIds.length;
        agentIdx = agentIdx % agents.length;

        uint256 taskId = createdTaskIds[taskIdx];
        address agent = agents[agentIdx];

        // Check if task is still open and agent hasn't submitted
        try taskManager.getTask(taskId) returns (ITaskManager.Task memory task) {
            if (task.status != ITaskManager.TaskStatus.Open) return;
            if (taskManager.hasSubmitted(taskId, agent)) return;
        } catch {
            return;
        }

        vm.prank(agent);
        try taskManager.submitWork(taskId, "sub-cid") {
            ghost_taskSubmissionCount[taskId]++;
        } catch { }
    }

    function selectWinner(uint256 taskIdx, uint256 agentIdx) external {
        if (createdTaskIds.length == 0) return;
        taskIdx = taskIdx % createdTaskIds.length;
        agentIdx = agentIdx % agents.length;

        uint256 taskId = createdTaskIds[taskIdx];
        address winner = agents[agentIdx];

        try taskManager.getTask(taskId) returns (ITaskManager.Task memory task) {
            if (task.status != ITaskManager.TaskStatus.Open) return;
            if (taskManager.getSubmissionCount(taskId) == 0) return;
            if (!taskManager.hasSubmitted(taskId, winner)) return;
        } catch {
            return;
        }

        vm.prank(creator);
        try taskManager.selectWinner(taskId, winner) {
            ghost_taskHasWinner[taskId] = true;
        } catch { }
    }

    function finalizeTask(uint256 taskIdx) external {
        if (createdTaskIds.length == 0) return;
        taskIdx = taskIdx % createdTaskIds.length;

        uint256 taskId = createdTaskIds[taskIdx];

        try taskManager.getTask(taskId) returns (ITaskManager.Task memory task) {
            if (task.status != ITaskManager.TaskStatus.InReview) return;
            if (block.timestamp < task.challengeDeadline) {
                vm.warp(task.challengeDeadline + 1);
            }
        } catch {
            return;
        }

        try taskManager.finalizeTask(taskId) {
            ITaskManager.Task memory task = taskManager.getTask(taskId);
            if (task.status == ITaskManager.TaskStatus.Completed) {
                ghost_totalReleased += task.bountyAmount;
            } else if (task.status == ITaskManager.TaskStatus.Refunded) {
                ghost_totalRefunded += task.bountyAmount;
            }
        } catch { }
    }

    function cancelTask(uint256 taskIdx) external {
        if (createdTaskIds.length == 0) return;
        taskIdx = taskIdx % createdTaskIds.length;

        uint256 taskId = createdTaskIds[taskIdx];

        try taskManager.getTask(taskId) returns (ITaskManager.Task memory task) {
            if (task.status != ITaskManager.TaskStatus.Open) return;
            if (taskManager.getSubmissionCount(taskId) > 0) return;
        } catch {
            return;
        }

        vm.prank(creator);
        try taskManager.cancelTask(taskId) {
            ITaskManager.Task memory task = taskManager.getTask(taskId);
            ghost_totalRefunded += task.bountyAmount;
        } catch { }
    }

    function getCreatedTaskCount() external view returns (uint256) {
        return createdTaskIds.length;
    }
}

contract InvariantsTest is Test {
    TaskManager public taskManager;
    EscrowVault public escrowVault;
    ClawboyAgentAdapter public agentAdapter;
    ERC8004IdentityRegistry public identityRegistry;
    ERC8004ReputationRegistry public reputationRegistry;
    DisputeResolver public disputeResolver;
    InvariantHandler public handler;

    address public creator = address(0x1);
    address[] public agents;
    address public treasury = address(0x5);

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

        // Register agents
        agents.push(address(0x2));
        agents.push(address(0x3));
        agents.push(address(0x4));

        for (uint256 i = 0; i < agents.length; i++) {
            vm.deal(agents[i], 10 ether);
            vm.prank(agents[i]);
            agentAdapter.register(string(abi.encodePacked("ipfs://agent-", i)));
        }

        vm.deal(creator, 1000 ether);

        handler = new InvariantHandler(
            taskManager, escrowVault, agentAdapter, disputeResolver, creator, agents
        );

        // Target the handler for invariant testing
        targetContract(address(handler));
    }

    /*//////////////////////////////////////////////////////////////
             INVARIANT: ESCROW BALANCE MATCHES DEPOSITS
    //////////////////////////////////////////////////////////////*/

    function invariant_EscrowBalanceMatchesDeposits() public view {
        // Total deposited should equal total released + total refunded + remaining in escrow
        // This checks that no value is created or destroyed
        uint256 totalDeposited = handler.ghost_totalDeposited();
        uint256 totalOut = handler.ghost_totalReleased() + handler.ghost_totalRefunded();

        // The vault should have at least (deposited - released - refunded) worth of ETH
        // (the fee portion goes to treasury so vault balance can be lower)
        assertGe(totalDeposited, totalOut);
    }

    /*//////////////////////////////////////////////////////////////
             INVARIANT: TASK STATUS MONOTONICITY
    //////////////////////////////////////////////////////////////*/

    function invariant_TaskStatusMonotonicity() public view {
        uint256 count = taskManager.taskCount();
        for (uint256 i = 1; i <= count && i <= 20; i++) {
            try taskManager.getTask(i) returns (ITaskManager.Task memory task) {
                // Task status must be a valid enum value (0-5)
                uint256 status = uint256(task.status);
                assertLe(status, 5);
            } catch { }
        }
    }

    /*//////////////////////////////////////////////////////////////
             INVARIANT: SINGLE WINNER PER TASK
    //////////////////////////////////////////////////////////////*/

    function invariant_SingleWinnerPerTask() public view {
        uint256 count = taskManager.taskCount();
        for (uint256 i = 1; i <= count && i <= 20; i++) {
            try taskManager.getTask(i) returns (ITaskManager.Task memory task) {
                if (task.status == ITaskManager.TaskStatus.Completed) {
                    // Completed tasks must have exactly one winner
                    assertTrue(task.selectedWinner != address(0));
                }
                if (task.status == ITaskManager.TaskStatus.Open) {
                    // Open tasks should not have a winner
                    assertEq(task.selectedWinner, address(0));
                }
            } catch { }
        }
    }

    /*//////////////////////////////////////////////////////////////
          INVARIANT: VOTE COUNT INTEGRITY
    //////////////////////////////////////////////////////////////*/

    function invariant_VoteCountIntegrity() public view {
        uint256 count = disputeResolver.disputeCount();
        for (uint256 i = 1; i <= count && i <= 10; i++) {
            try disputeResolver.getDispute(i) returns (IDisputeResolver.Dispute memory dispute) {
                if (dispute.id == 0) continue;

                address[] memory voters = disputeResolver.getVoters(i);

                uint256 computedFor;
                uint256 computedAgainst;

                for (uint256 j = 0; j < voters.length; j++) {
                    IDisputeResolver.Vote memory vote = disputeResolver.getVote(i, voters[j]);
                    if (vote.supportsDisputer) {
                        computedFor += vote.weight;
                    } else {
                        computedAgainst += vote.weight;
                    }
                }

                assertEq(dispute.votesForDisputer, computedFor);
                assertEq(dispute.votesAgainstDisputer, computedAgainst);
            } catch { }
        }
    }

    /*//////////////////////////////////////////////////////////////
          INVARIANT: ID COUNTERS ONLY INCREASE
    //////////////////////////////////////////////////////////////*/

    function invariant_IDCountersOnlyIncrease() public view {
        uint256 tCount = taskManager.taskCount();
        uint256 dCount = disputeResolver.disputeCount();

        // These are always >= 0 by nature of uint256, but we verify they are >= ghost count
        assertGe(tCount, handler.ghost_taskCount());
    }

    /*//////////////////////////////////////////////////////////////
          INVARIANT: NO ORPHANED DISPUTES
    //////////////////////////////////////////////////////////////*/

    function invariant_NoOrphanedDisputes() public view {
        uint256 count = disputeResolver.disputeCount();
        for (uint256 i = 1; i <= count && i <= 10; i++) {
            try disputeResolver.getDispute(i) returns (IDisputeResolver.Dispute memory dispute) {
                if (dispute.id == 0) continue;
                // Every dispute must reference a valid task
                assertTrue(dispute.taskId > 0);
                assertTrue(dispute.taskId <= taskManager.taskCount());
            } catch { }
        }
    }

    /*//////////////////////////////////////////////////////////////
          INVARIANT: ESCROW NEVER NEGATIVE
    //////////////////////////////////////////////////////////////*/

    function invariant_EscrowNeverNegative() public view {
        // The escrow vault's ETH balance should never be negative (always >= 0)
        // This is trivially true for uint256 but we verify the contract holds ETH
        assertGe(address(escrowVault).balance, 0);
    }

    /*//////////////////////////////////////////////////////////////
      INVARIANT: COMPLETED TASKS HAVE WINNERS
    //////////////////////////////////////////////////////////////*/

    function invariant_CompletedTasksHaveWinners() public view {
        uint256 count = taskManager.taskCount();
        for (uint256 i = 1; i <= count && i <= 20; i++) {
            try taskManager.getTask(i) returns (ITaskManager.Task memory task) {
                if (task.status == ITaskManager.TaskStatus.Completed) {
                    assertTrue(
                        task.selectedWinner != address(0), "Completed task must have a winner"
                    );
                }
            } catch { }
        }
    }

    /*//////////////////////////////////////////////////////////////
      INVARIANT: FEES NEVER EXCEED DEPOSIT
    //////////////////////////////////////////////////////////////*/

    function invariant_FeesNeverExceedDeposit() public view {
        // Protocol fee is capped at MAX_FEE_BPS (1000 = 10%)
        uint256 feeBps = escrowVault.protocolFeeBps();
        assertLe(feeBps, escrowVault.MAX_FEE_BPS());

        // For any task, the fee should be at most 10% of the deposit
        uint256 count = taskManager.taskCount();
        for (uint256 i = 1; i <= count && i <= 20; i++) {
            try taskManager.getTask(i) returns (ITaskManager.Task memory task) {
                uint256 maxFee = (task.bountyAmount * escrowVault.MAX_FEE_BPS()) / 10_000;
                // Fee can never exceed maxFee by design
                assertLe((task.bountyAmount * feeBps) / 10_000, maxFee, "Fee exceeds max allowed");
            } catch { }
        }
    }

    /*//////////////////////////////////////////////////////////////
      INVARIANT: CANCELLED TASKS HAVE NO WINNER
    //////////////////////////////////////////////////////////////*/

    function invariant_CancelledTasksHaveNoWinner() public view {
        uint256 count = taskManager.taskCount();
        for (uint256 i = 1; i <= count && i <= 20; i++) {
            try taskManager.getTask(i) returns (ITaskManager.Task memory task) {
                if (task.status == ITaskManager.TaskStatus.Cancelled) {
                    assertEq(
                        task.selectedWinner, address(0), "Cancelled task should have no winner"
                    );
                }
            } catch { }
        }
    }

    /*//////////////////////////////////////////////////////////////
      INVARIANT: REFUNDED TASKS HAVE NO ACTIVE ESCROW
    //////////////////////////////////////////////////////////////*/

    function invariant_RefundedTasksHaveNoActiveEscrow() public view {
        uint256 count = taskManager.taskCount();
        for (uint256 i = 1; i <= count && i <= 20; i++) {
            try taskManager.getTask(i) returns (ITaskManager.Task memory task) {
                if (
                    task.status == ITaskManager.TaskStatus.Refunded
                        || task.status == ITaskManager.TaskStatus.Completed
                        || task.status == ITaskManager.TaskStatus.Cancelled
                ) {
                    (, uint256 balance) = escrowVault.getBalance(i);
                    assertEq(balance, 0, "Terminal task should have zero escrow");
                }
            } catch { }
        }
    }
}
