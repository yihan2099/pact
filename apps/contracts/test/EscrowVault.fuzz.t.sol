// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { EscrowVault } from "../src/EscrowVault.sol";
import { IEscrowVault } from "../src/interfaces/IEscrowVault.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20EscrowFuzz is ERC20 {
    constructor() ERC20("Mock Token", "MOCK") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract EscrowVaultFuzzTest is Test {
    EscrowVault public escrowVault;
    MockERC20EscrowFuzz public token;

    address public treasury = address(0xAAA);
    address public taskManager;
    address public recipient = address(0xBBB);
    address public creator = address(0xCCC);

    uint256 public constant DEFAULT_FEE_BPS = 300; // 3%

    function setUp() public {
        taskManager = address(0x7777);
        escrowVault = new EscrowVault(taskManager, treasury, DEFAULT_FEE_BPS);

        token = new MockERC20EscrowFuzz();

        vm.deal(taskManager, 10_000 ether);
        token.mint(taskManager, 10_000_000 ether);

        vm.prank(taskManager);
        token.approve(address(escrowVault), type(uint256).max);
    }

    /*//////////////////////////////////////////////////////////////
                     FUZZ: FEE CALCULATION
    //////////////////////////////////////////////////////////////*/

    function testFuzz_FeeCalculation(uint256 amount, uint256 feeBps) public {
        amount = bound(amount, 1, 1000 ether);
        feeBps = bound(feeBps, 0, 1000); // 0% to 10%

        escrowVault.setProtocolFee(feeBps);

        vm.deal(taskManager, amount);

        uint256 taskId = 1;
        vm.prank(taskManager);
        escrowVault.deposit{ value: amount }(taskId, address(0), amount);

        uint256 recipientBefore = recipient.balance;
        uint256 treasuryBefore = treasury.balance;

        vm.prank(taskManager);
        escrowVault.release(taskId, recipient);

        uint256 expectedFee = (amount * feeBps) / 10_000;
        uint256 expectedNet = amount - expectedFee;

        assertEq(recipient.balance, recipientBefore + expectedNet);
        assertEq(treasury.balance, treasuryBefore + expectedFee);

        // Invariant: fee + net = total
        assertEq(expectedFee + expectedNet, amount);
    }

    /*//////////////////////////////////////////////////////////////
                     FUZZ: DEPOSIT AND RELEASE
    //////////////////////////////////////////////////////////////*/

    function testFuzz_DepositRelease(uint256 amount) public {
        amount = bound(amount, 1, 1000 ether);

        uint256 taskId = 1;
        vm.prank(taskManager);
        escrowVault.deposit{ value: amount }(taskId, address(0), amount);

        (, uint256 escrowed) = escrowVault.getBalance(taskId);
        assertEq(escrowed, amount);

        uint256 recipientBefore = recipient.balance;

        vm.prank(taskManager);
        escrowVault.release(taskId, recipient);

        // After release, balance should be 0
        (, uint256 afterRelease) = escrowVault.getBalance(taskId);
        assertEq(afterRelease, 0);

        // Recipient got net amount
        uint256 expectedFee = (amount * DEFAULT_FEE_BPS) / 10_000;
        assertEq(recipient.balance, recipientBefore + amount - expectedFee);
    }

    /*//////////////////////////////////////////////////////////////
              FUZZ: MULTIPLE DEPOSITS AND RELEASES
    //////////////////////////////////////////////////////////////*/

    function testFuzz_MultipleDepositsAndReleases(uint8 numTasks) public {
        numTasks = uint8(bound(numTasks, 1, 20));

        uint256 totalFees;

        for (uint256 i = 1; i <= numTasks; i++) {
            uint256 amount = 1 ether + (i * 0.1 ether);

            vm.prank(taskManager);
            escrowVault.deposit{ value: amount }(i, address(0), amount);

            vm.prank(taskManager);
            escrowVault.release(i, recipient);

            uint256 fee = (amount * DEFAULT_FEE_BPS) / 10_000;
            totalFees += fee;
        }

        assertEq(escrowVault.accumulatedFees(address(0)), totalFees);
    }

    /*//////////////////////////////////////////////////////////////
                 FEE ROUNDING WITH SMALL AMOUNTS
    //////////////////////////////////////////////////////////////*/

    function testFuzz_FeeRoundingSmallAmounts(uint256 amount) public {
        // Small amounts where fee rounds to 0
        amount = bound(amount, 1, 33); // 3% of 33 = 0.99 -> rounds to 0

        uint256 taskId = 1;
        vm.prank(taskManager);
        escrowVault.deposit{ value: amount }(taskId, address(0), amount);

        uint256 recipientBefore = recipient.balance;
        uint256 treasuryBefore = treasury.balance;

        vm.prank(taskManager);
        escrowVault.release(taskId, recipient);

        uint256 expectedFee = (amount * DEFAULT_FEE_BPS) / 10_000;
        uint256 expectedNet = amount - expectedFee;

        // Verify no value lost
        assertEq(
            (recipient.balance - recipientBefore) + (treasury.balance - treasuryBefore), amount
        );
        assertEq(recipient.balance, recipientBefore + expectedNet);
    }

    /*//////////////////////////////////////////////////////////////
                  DEPOSIT WITH EXACT BALANCE
    //////////////////////////////////////////////////////////////*/

    function testFuzz_DepositWithExactBalance(uint256 amount) public {
        amount = bound(amount, 1, 100 ether);

        // Give taskManager exactly the amount needed
        address freshManager = address(0x8888);
        EscrowVault freshVault = new EscrowVault(freshManager, treasury, DEFAULT_FEE_BPS);
        vm.deal(freshManager, amount);

        vm.prank(freshManager);
        freshVault.deposit{ value: amount }(1, address(0), amount);

        assertEq(freshManager.balance, 0);
        (, uint256 escrowed) = freshVault.getBalance(1);
        assertEq(escrowed, amount);
    }

    /*//////////////////////////////////////////////////////////////
                RELEASE MORE THAN DEPOSITED (REVERT)
    //////////////////////////////////////////////////////////////*/

    function test_ReleaseNonexistentEscrow() public {
        // No deposit made for taskId 999
        vm.prank(taskManager);
        vm.expectRevert(EscrowVault.EscrowNotFound.selector);
        escrowVault.release(999, recipient);
    }

    function test_DoubleRelease() public {
        uint256 taskId = 1;
        vm.prank(taskManager);
        escrowVault.deposit{ value: 1 ether }(taskId, address(0), 1 ether);

        vm.prank(taskManager);
        escrowVault.release(taskId, recipient);

        // Second release should fail
        vm.prank(taskManager);
        vm.expectRevert(EscrowVault.EscrowAlreadyReleased.selector);
        escrowVault.release(taskId, recipient);
    }

    /*//////////////////////////////////////////////////////////////
               FUZZ: ERC20 DEPOSITS AND RELEASES
    //////////////////////////////////////////////////////////////*/

    function testFuzz_ERC20DepositAndRelease(uint256 amount) public {
        amount = bound(amount, 1, 1_000_000 ether);

        uint256 taskId = 1;
        vm.prank(taskManager);
        escrowVault.deposit(taskId, address(token), amount);

        (, uint256 escrowed) = escrowVault.getBalance(taskId);
        assertEq(escrowed, amount);

        uint256 recipientBefore = token.balanceOf(recipient);
        uint256 treasuryBefore = token.balanceOf(treasury);

        vm.prank(taskManager);
        escrowVault.release(taskId, recipient);

        uint256 expectedFee = (amount * DEFAULT_FEE_BPS) / 10_000;
        uint256 expectedNet = amount - expectedFee;

        assertEq(token.balanceOf(recipient), recipientBefore + expectedNet);
        assertEq(token.balanceOf(treasury), treasuryBefore + expectedFee);
    }

    /*//////////////////////////////////////////////////////////////
                  ACCUMULATED FEES ACCURACY
    //////////////////////////////////////////////////////////////*/

    function testFuzz_AccumulatedFeesAccuracy(uint8 numReleases) public {
        numReleases = uint8(bound(numReleases, 1, 15));
        uint256 totalExpectedFees;

        for (uint256 i = 1; i <= numReleases; i++) {
            uint256 amount = i * 0.5 ether;

            vm.prank(taskManager);
            escrowVault.deposit{ value: amount }(i, address(0), amount);

            vm.prank(taskManager);
            escrowVault.release(i, recipient);

            totalExpectedFees += (amount * DEFAULT_FEE_BPS) / 10_000;
        }

        assertEq(escrowVault.accumulatedFees(address(0)), totalExpectedFees);
    }
}
