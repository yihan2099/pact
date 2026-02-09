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
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20Fuzz is ERC20 {
    constructor() ERC20("Mock Token", "MOCK") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract TaskManagerFuzzTest is Test {
    TaskManager public taskManager;
    EscrowVault public escrowVault;
    ClawboyAgentAdapter public agentAdapter;
    ERC8004IdentityRegistry public identityRegistry;
    ERC8004ReputationRegistry public reputationRegistry;
    DisputeResolver public disputeResolver;
    MockERC20Fuzz public token;

    address public creator = address(0x1);
    address public agent1 = address(0x2);
    address public agent2 = address(0x3);
    address public agent3 = address(0x4);
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

        vm.deal(creator, 10_000 ether);
        vm.deal(agent1, 1 ether);
        vm.deal(agent2, 1 ether);
        vm.deal(agent3, 1 ether);

        vm.prank(agent1);
        agentAdapter.register("ipfs://agent1");
        vm.prank(agent2);
        agentAdapter.register("ipfs://agent2");
        vm.prank(agent3);
        agentAdapter.register("ipfs://agent3");

        token = new MockERC20Fuzz();
    }

    /*//////////////////////////////////////////////////////////////
                         FUZZ: BOUNTY AMOUNTS
    //////////////////////////////////////////////////////////////*/

    function testFuzz_CreateTaskWithVariousBounties(uint256 bountyAmount) public {
        bountyAmount = bound(bountyAmount, 1, 1000 ether);
        vm.deal(creator, bountyAmount);

        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: bountyAmount }(
            "spec-cid", address(0), bountyAmount, 0
        );

        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(task.bountyAmount, bountyAmount);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.Open));
    }

    /*//////////////////////////////////////////////////////////////
                         FUZZ: DEADLINES
    //////////////////////////////////////////////////////////////*/

    function testFuzz_CreateTaskWithVariousDeadlines(uint256 futureOffset) public {
        futureOffset = bound(futureOffset, 1, 365 days);
        vm.warp(1000);
        uint256 deadline = block.timestamp + futureOffset;

        vm.prank(creator);
        uint256 taskId =
            taskManager.createTask{ value: 1 ether }("spec-cid", address(0), 1 ether, deadline);

        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(task.deadline, deadline);
    }

    /*//////////////////////////////////////////////////////////////
                     FUZZ: MULTIPLE SUBMISSIONS
    //////////////////////////////////////////////////////////////*/

    function testFuzz_MultipleSubmissions(uint8 numSubmitters) public {
        numSubmitters = uint8(bound(numSubmitters, 1, 20));

        vm.prank(creator);
        uint256 taskId =
            taskManager.createTask{ value: 1 ether }("spec-cid", address(0), 1 ether, 0);

        for (uint256 i = 0; i < numSubmitters; i++) {
            address agent = address(uint160(0x1000 + i));
            vm.deal(agent, 1 ether);
            vm.prank(agent);
            agentAdapter.register(string(abi.encodePacked("ipfs://agent-", i)));
            vm.prank(agent);
            taskManager.submitWork(taskId, string(abi.encodePacked("cid-", i)));
        }

        assertEq(taskManager.getSubmissionCount(taskId), numSubmitters);
    }

    /*//////////////////////////////////////////////////////////////
                     FUZZ: BOUNTY AMOUNT BOUNDS
    //////////////////////////////////////////////////////////////*/

    function testFuzz_BountyAmountBounds(uint256 bountyAmount) public {
        bountyAmount = bound(bountyAmount, 1, type(uint128).max);
        vm.deal(creator, bountyAmount);

        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: bountyAmount }(
            "spec-cid", address(0), bountyAmount, 0
        );

        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(task.bountyAmount, bountyAmount);

        (, uint256 escrowed) = escrowVault.getBalance(taskId);
        assertEq(escrowed, bountyAmount);
    }

    /*//////////////////////////////////////////////////////////////
                         FUZZ: CID LENGTHS
    //////////////////////////////////////////////////////////////*/

    function testFuzz_CIDLengths(uint256 cidLength) public {
        cidLength = bound(cidLength, 1, 500);

        bytes memory cidBytes = new bytes(cidLength);
        for (uint256 i = 0; i < cidLength; i++) {
            cidBytes[i] = bytes1(uint8(65 + (i % 26))); // A-Z repeating
        }
        string memory cid = string(cidBytes);

        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: 1 ether }(cid, address(0), 1 ether, 0);

        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(keccak256(bytes(task.specificationCid)), keccak256(bytes(cid)));
    }

    /*//////////////////////////////////////////////////////////////
                     FUZZ: CREATE AND CANCEL
    //////////////////////////////////////////////////////////////*/

    function testFuzz_CreateAndCancel(uint256 bountyAmount) public {
        bountyAmount = bound(bountyAmount, 1, 100 ether);
        vm.deal(creator, bountyAmount);

        vm.prank(creator);
        uint256 taskId = taskManager.createTask{ value: bountyAmount }(
            "spec-cid", address(0), bountyAmount, 0
        );

        uint256 balBefore = creator.balance;

        vm.prank(creator);
        taskManager.cancelTask(taskId);

        assertEq(creator.balance, balBefore + bountyAmount);
        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.Cancelled));
    }

    /*//////////////////////////////////////////////////////////////
                   FUZZ: WINNER SELECTION INDEX
    //////////////////////////////////////////////////////////////*/

    function testFuzz_WinnerSelectionIndex(uint8 numAgents, uint8 winnerIdx) public {
        numAgents = uint8(bound(numAgents, 1, 10));
        winnerIdx = uint8(bound(winnerIdx, 0, numAgents - 1));

        vm.prank(creator);
        uint256 taskId =
            taskManager.createTask{ value: 1 ether }("spec-cid", address(0), 1 ether, 0);

        address[] memory agents = new address[](numAgents);
        for (uint256 i = 0; i < numAgents; i++) {
            agents[i] = address(uint160(0x2000 + i));
            vm.deal(agents[i], 1 ether);
            vm.prank(agents[i]);
            agentAdapter.register(string(abi.encodePacked("ipfs://a-", i)));
            vm.prank(agents[i]);
            taskManager.submitWork(taskId, string(abi.encodePacked("sub-", i)));
        }

        address winner = agents[winnerIdx];

        vm.prank(creator);
        taskManager.selectWinner(taskId, winner);

        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(task.selectedWinner, winner);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.InReview));
    }

    /*//////////////////////////////////////////////////////////////
                      ZERO BOUNTY REVERT
    //////////////////////////////////////////////////////////////*/

    function test_CreateTaskZeroBountyReverts() public {
        vm.prank(creator);
        vm.expectRevert(TaskManager.InsufficientBounty.selector);
        taskManager.createTask{ value: 0 }("spec-cid", address(0), 0, 0);
    }

    /*//////////////////////////////////////////////////////////////
                      PAST DEADLINE REVERT
    //////////////////////////////////////////////////////////////*/

    function test_CreateTaskPastDeadlineReverts() public {
        vm.warp(1000);
        vm.prank(creator);
        vm.expectRevert(TaskManager.InvalidDeadline.selector);
        taskManager.createTask{ value: 1 ether }(
            "spec-cid", address(0), 1 ether, block.timestamp - 1
        );
    }

    /*//////////////////////////////////////////////////////////////
                  CONCURRENT TASK CREATION
    //////////////////////////////////////////////////////////////*/

    function testFuzz_ConcurrentTaskCreation(uint8 numCreators) public {
        numCreators = uint8(bound(numCreators, 2, 10));

        for (uint256 i = 0; i < numCreators; i++) {
            address c = address(uint160(0x3000 + i));
            vm.deal(c, 2 ether);
            vm.prank(c);
            uint256 taskId =
                taskManager.createTask{ value: 1 ether }("spec-cid", address(0), 1 ether, 0);
            assertEq(taskId, i + 1);
        }

        assertEq(taskManager.taskCount(), numCreators);
    }

    /*//////////////////////////////////////////////////////////////
                   SUBMISSION AFTER DEADLINE
    //////////////////////////////////////////////////////////////*/

    function testFuzz_SubmissionAfterDeadline(uint256 futureOffset) public {
        futureOffset = bound(futureOffset, 1 hours, 30 days);
        vm.warp(1000);
        uint256 deadline = block.timestamp + futureOffset;

        vm.prank(creator);
        uint256 taskId =
            taskManager.createTask{ value: 1 ether }("spec-cid", address(0), 1 ether, deadline);

        vm.warp(deadline + 1);

        vm.prank(agent1);
        vm.expectRevert(TaskManager.DeadlinePassed.selector);
        taskManager.submitWork(taskId, "sub-cid");
    }

    /*//////////////////////////////////////////////////////////////
                  DUPLICATE SUBMISSION REVERT
    //////////////////////////////////////////////////////////////*/

    function test_DuplicateSubmissionReverts() public {
        vm.prank(creator);
        uint256 taskId =
            taskManager.createTask{ value: 1 ether }("spec-cid", address(0), 1 ether, 0);

        vm.prank(agent1);
        taskManager.submitWork(taskId, "sub-1");

        vm.prank(agent1);
        vm.expectRevert(TaskManager.AlreadySubmitted.selector);
        taskManager.submitWork(taskId, "sub-2");
    }

    /*//////////////////////////////////////////////////////////////
                   FUZZ: ERC20 TOKEN AMOUNTS
    //////////////////////////////////////////////////////////////*/

    function testFuzz_ERC20TaskCreation(uint256 bountyAmount) public {
        bountyAmount = bound(bountyAmount, 1, 1_000_000 ether);

        token.mint(creator, bountyAmount);
        vm.prank(creator);
        token.approve(address(escrowVault), bountyAmount);

        vm.prank(creator);
        uint256 taskId = taskManager.createTask("spec-cid", address(token), bountyAmount, 0);

        ITaskManager.Task memory task = taskManager.getTask(taskId);
        assertEq(task.bountyAmount, bountyAmount);
        assertEq(task.bountyToken, address(token));
        assertEq(token.balanceOf(address(escrowVault)), bountyAmount);
    }

    /*//////////////////////////////////////////////////////////////
                CHALLENGE DEADLINE TIMING EDGE CASES
    //////////////////////////////////////////////////////////////*/

    function testFuzz_ChallengeDeadlineTiming(uint256 warpOffset) public {
        warpOffset = bound(warpOffset, 0, 48 hours - 1);

        vm.prank(creator);
        uint256 taskId =
            taskManager.createTask{ value: 1 ether }("spec-cid", address(0), 1 ether, 0);

        vm.prank(agent1);
        taskManager.submitWork(taskId, "sub-cid");

        vm.prank(creator);
        taskManager.selectWinner(taskId, agent1);

        ITaskManager.Task memory task = taskManager.getTask(taskId);
        uint256 challengeDeadline = task.challengeDeadline;

        // Warp to within challenge window - finalize should revert
        vm.warp(block.timestamp + warpOffset);

        if (block.timestamp < challengeDeadline) {
            vm.expectRevert(TaskManager.ChallengeWindowNotPassed.selector);
            taskManager.finalizeTask(taskId);
        }
    }

    function test_FinalizeExactlyAtChallengeDeadline() public {
        vm.prank(creator);
        uint256 taskId =
            taskManager.createTask{ value: 1 ether }("spec-cid", address(0), 1 ether, 0);

        vm.prank(agent1);
        taskManager.submitWork(taskId, "sub-cid");

        vm.prank(creator);
        taskManager.selectWinner(taskId, agent1);

        ITaskManager.Task memory task = taskManager.getTask(taskId);

        // One second before challenge deadline - should revert
        vm.warp(task.challengeDeadline - 1);
        vm.expectRevert(TaskManager.ChallengeWindowNotPassed.selector);
        taskManager.finalizeTask(taskId);

        // Exactly at challenge deadline - condition is `<`, so this succeeds
        vm.warp(task.challengeDeadline);
        taskManager.finalizeTask(taskId);

        task = taskManager.getTask(taskId);
        assertEq(uint256(task.status), uint256(ITaskManager.TaskStatus.Completed));
    }
}
