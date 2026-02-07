// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import { Test, Vm } from "forge-std/Test.sol";
import { EscrowVault } from "../src/EscrowVault.sol";
import { IEscrowVault } from "../src/interfaces/IEscrowVault.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @dev Simple mock ERC20 for testing
contract MockERC20 is ERC20 {
    constructor() ERC20("Mock Token", "MOCK") {
        _mint(msg.sender, 1_000_000 ether);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract EscrowVaultTest is Test {
    EscrowVault public escrowVault;
    MockERC20 public token;

    address public treasury = address(0xAAA);
    address public taskManager;
    address public owner;
    address public recipient = address(0xBBB);
    address public creator = address(0xCCC);

    uint256 public constant DEFAULT_FEE_BPS = 300; // 3%
    uint256 public constant BOUNTY_AMOUNT = 1 ether;

    function setUp() public {
        owner = address(this);
        taskManager = address(0x7777);

        escrowVault = new EscrowVault(taskManager, treasury, DEFAULT_FEE_BPS);

        token = new MockERC20();

        // Fund taskManager for deposits
        vm.deal(taskManager, 100 ether);

        // Give token to taskManager and creator for ERC20 deposits
        token.mint(taskManager, 100 ether);
        token.mint(creator, 100 ether);

        // Approve escrowVault from taskManager
        vm.prank(taskManager);
        token.approve(address(escrowVault), type(uint256).max);

        // Approve escrowVault from creator (for depositFrom)
        vm.prank(creator);
        token.approve(address(escrowVault), type(uint256).max);
    }

    /*//////////////////////////////////////////////////////////////
                          CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Constructor() public view {
        assertEq(escrowVault.taskManager(), taskManager);
        assertEq(escrowVault.protocolTreasury(), treasury);
        assertEq(escrowVault.protocolFeeBps(), DEFAULT_FEE_BPS);
        assertEq(escrowVault.owner(), owner);
        assertEq(escrowVault.MAX_FEE_BPS(), 1000);
    }

    function test_Constructor_RevertIfZeroTreasury() public {
        vm.expectRevert(EscrowVault.InvalidTreasury.selector);
        new EscrowVault(taskManager, address(0), DEFAULT_FEE_BPS);
    }

    function test_Constructor_RevertIfFeeTooHigh() public {
        vm.expectRevert(EscrowVault.FeeTooHigh.selector);
        new EscrowVault(taskManager, treasury, 1001);
    }

    function test_Constructor_MaxFee() public {
        EscrowVault vault = new EscrowVault(taskManager, treasury, 1000);
        assertEq(vault.protocolFeeBps(), 1000);
    }

    function test_Constructor_ZeroFee() public {
        EscrowVault vault = new EscrowVault(taskManager, treasury, 0);
        assertEq(vault.protocolFeeBps(), 0);
    }

    /*//////////////////////////////////////////////////////////////
                       FEE CALCULATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_FeeCalculation_3Percent_ETH() public {
        uint256 taskId = 1;

        // Deposit ETH
        vm.prank(taskManager);
        escrowVault.deposit{ value: BOUNTY_AMOUNT }(taskId, address(0), BOUNTY_AMOUNT);

        uint256 recipientBalBefore = recipient.balance;
        uint256 treasuryBalBefore = treasury.balance;

        // Release
        vm.prank(taskManager);
        escrowVault.release(taskId, recipient);

        uint256 expectedFee = (BOUNTY_AMOUNT * 300) / 10_000; // 0.03 ether
        uint256 expectedNet = BOUNTY_AMOUNT - expectedFee; // 0.97 ether

        assertEq(expectedFee, 0.03 ether);
        assertEq(expectedNet, 0.97 ether);
        assertEq(recipient.balance, recipientBalBefore + expectedNet);
        assertEq(treasury.balance, treasuryBalBefore + expectedFee);
    }

    function test_FeeCalculation_3Percent_ERC20() public {
        uint256 taskId = 1;

        // Deposit ERC20
        vm.prank(taskManager);
        escrowVault.deposit(taskId, address(token), BOUNTY_AMOUNT);

        uint256 recipientBalBefore = token.balanceOf(recipient);
        uint256 treasuryBalBefore = token.balanceOf(treasury);

        // Release
        vm.prank(taskManager);
        escrowVault.release(taskId, recipient);

        uint256 expectedFee = (BOUNTY_AMOUNT * 300) / 10_000;
        uint256 expectedNet = BOUNTY_AMOUNT - expectedFee;

        assertEq(token.balanceOf(recipient), recipientBalBefore + expectedNet);
        assertEq(token.balanceOf(treasury), treasuryBalBefore + expectedFee);
    }

    function test_FeeCalculation_VariousAmounts() public {
        // Test with a small amount
        uint256 smallAmount = 100; // 100 wei
        uint256 expectedFee = (smallAmount * 300) / 10_000; // 3 wei
        assertEq(expectedFee, 3);

        // Test with a large amount
        uint256 largeAmount = 100 ether;
        uint256 expectedFeeLarge = (largeAmount * 300) / 10_000;
        assertEq(expectedFeeLarge, 3 ether);

        // Test with amount that doesn't divide evenly
        uint256 oddAmount = 1.01 ether;
        uint256 expectedFeeOdd = (oddAmount * 300) / 10_000;
        // 1.01 ether * 300 / 10000 = 0.0303 ether
        assertEq(expectedFeeOdd, 0.0303 ether);
    }

    function test_FeeCalculation_SmallAmountRoundsDown() public {
        // 1 wei with 3% fee = 0 fee (rounds down)
        uint256 taskId = 1;

        vm.prank(taskManager);
        escrowVault.deposit{ value: 1 }(taskId, address(0), 1);

        uint256 recipientBalBefore = recipient.balance;

        vm.prank(taskManager);
        escrowVault.release(taskId, recipient);

        // Fee rounds to 0, full amount goes to recipient
        assertEq(recipient.balance, recipientBalBefore + 1);
    }

    /*//////////////////////////////////////////////////////////////
                       FEE SPLIT ON RELEASE TESTS
    //////////////////////////////////////////////////////////////*/

    function test_FeeSplit_ETH_Release() public {
        uint256 taskId = 1;

        vm.prank(taskManager);
        escrowVault.deposit{ value: 10 ether }(taskId, address(0), 10 ether);

        uint256 recipientBalBefore = recipient.balance;
        uint256 treasuryBalBefore = treasury.balance;

        vm.prank(taskManager);
        escrowVault.release(taskId, recipient);

        // 3% of 10 ETH = 0.3 ETH fee, 9.7 ETH to recipient
        assertEq(treasury.balance, treasuryBalBefore + 0.3 ether);
        assertEq(recipient.balance, recipientBalBefore + 9.7 ether);
    }

    function test_FeeSplit_ERC20_Release() public {
        uint256 taskId = 1;

        vm.prank(taskManager);
        escrowVault.deposit(taskId, address(token), 10 ether);

        uint256 recipientBalBefore = token.balanceOf(recipient);
        uint256 treasuryBalBefore = token.balanceOf(treasury);

        vm.prank(taskManager);
        escrowVault.release(taskId, recipient);

        assertEq(token.balanceOf(treasury), treasuryBalBefore + 0.3 ether);
        assertEq(token.balanceOf(recipient), recipientBalBefore + 9.7 ether);
    }

    function test_NoFeeOnRefund_ETH() public {
        uint256 taskId = 1;

        vm.prank(taskManager);
        escrowVault.deposit{ value: BOUNTY_AMOUNT }(taskId, address(0), BOUNTY_AMOUNT);

        uint256 creatorBalBefore = creator.balance;
        uint256 treasuryBalBefore = treasury.balance;

        vm.prank(taskManager);
        escrowVault.refund(taskId, creator);

        // Full amount refunded, no fee
        assertEq(creator.balance, creatorBalBefore + BOUNTY_AMOUNT);
        assertEq(treasury.balance, treasuryBalBefore); // No change
    }

    function test_NoFeeOnRefund_ERC20() public {
        uint256 taskId = 1;

        vm.prank(taskManager);
        escrowVault.deposit(taskId, address(token), BOUNTY_AMOUNT);

        uint256 creatorBalBefore = token.balanceOf(creator);
        uint256 treasuryBalBefore = token.balanceOf(treasury);

        vm.prank(taskManager);
        escrowVault.refund(taskId, creator);

        assertEq(token.balanceOf(creator), creatorBalBefore + BOUNTY_AMOUNT);
        assertEq(token.balanceOf(treasury), treasuryBalBefore);
    }

    /*//////////////////////////////////////////////////////////////
                        FEE CAP ENFORCEMENT
    //////////////////////////////////////////////////////////////*/

    function test_SetProtocolFee() public {
        escrowVault.setProtocolFee(500); // 5%
        assertEq(escrowVault.protocolFeeBps(), 500);
    }

    function test_SetProtocolFee_ToZero() public {
        escrowVault.setProtocolFee(0);
        assertEq(escrowVault.protocolFeeBps(), 0);
    }

    function test_SetProtocolFee_ToMax() public {
        escrowVault.setProtocolFee(1000); // 10%
        assertEq(escrowVault.protocolFeeBps(), 1000);
    }

    function test_SetProtocolFee_RevertIfTooHigh() public {
        vm.expectRevert(EscrowVault.FeeTooHigh.selector);
        escrowVault.setProtocolFee(1001);
    }

    function test_SetProtocolFee_RevertIfNotOwner() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, address(0xDEAD))
        );
        escrowVault.setProtocolFee(500);
    }

    function test_SetProtocolFee_EmitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit IEscrowVault.ProtocolFeeUpdated(300, 500);

        escrowVault.setProtocolFee(500);
    }

    /*//////////////////////////////////////////////////////////////
                     TREASURY ADDRESS CHANGE
    //////////////////////////////////////////////////////////////*/

    function test_SetProtocolTreasury() public {
        address newTreasury = address(0xDDD);
        escrowVault.setProtocolTreasury(newTreasury);
        assertEq(escrowVault.protocolTreasury(), newTreasury);
    }

    function test_SetProtocolTreasury_RevertIfZeroAddress() public {
        vm.expectRevert(EscrowVault.InvalidTreasury.selector);
        escrowVault.setProtocolTreasury(address(0));
    }

    function test_SetProtocolTreasury_RevertIfNotOwner() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, address(0xDEAD))
        );
        escrowVault.setProtocolTreasury(address(0xDDD));
    }

    function test_SetProtocolTreasury_EmitsEvent() public {
        address newTreasury = address(0xDDD);

        vm.expectEmit(false, false, false, true);
        emit IEscrowVault.ProtocolTreasuryUpdated(treasury, newTreasury);

        escrowVault.setProtocolTreasury(newTreasury);
    }

    /*//////////////////////////////////////////////////////////////
                       ZERO FEE SCENARIO
    //////////////////////////////////////////////////////////////*/

    function test_ZeroFee_ETH() public {
        // Set fee to 0
        escrowVault.setProtocolFee(0);

        uint256 taskId = 1;
        vm.prank(taskManager);
        escrowVault.deposit{ value: BOUNTY_AMOUNT }(taskId, address(0), BOUNTY_AMOUNT);

        uint256 recipientBalBefore = recipient.balance;
        uint256 treasuryBalBefore = treasury.balance;

        vm.prank(taskManager);
        escrowVault.release(taskId, recipient);

        // Full amount to recipient, no fee to treasury
        assertEq(recipient.balance, recipientBalBefore + BOUNTY_AMOUNT);
        assertEq(treasury.balance, treasuryBalBefore);
    }

    function test_ZeroFee_ERC20() public {
        escrowVault.setProtocolFee(0);

        uint256 taskId = 1;
        vm.prank(taskManager);
        escrowVault.deposit(taskId, address(token), BOUNTY_AMOUNT);

        uint256 recipientBalBefore = token.balanceOf(recipient);
        uint256 treasuryBalBefore = token.balanceOf(treasury);

        vm.prank(taskManager);
        escrowVault.release(taskId, recipient);

        assertEq(token.balanceOf(recipient), recipientBalBefore + BOUNTY_AMOUNT);
        assertEq(token.balanceOf(treasury), treasuryBalBefore);
    }

    function test_ZeroFee_NoFeeEvent() public {
        escrowVault.setProtocolFee(0);

        uint256 taskId = 1;
        vm.prank(taskManager);
        escrowVault.deposit{ value: BOUNTY_AMOUNT }(taskId, address(0), BOUNTY_AMOUNT);

        // Should NOT emit ProtocolFeeCollected when fee is 0
        vm.recordLogs();

        vm.prank(taskManager);
        escrowVault.release(taskId, recipient);

        // Check that no ProtocolFeeCollected event was emitted
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 feeEventSig = keccak256("ProtocolFeeCollected(uint256,address,uint256,address)");
        for (uint256 i = 0; i < logs.length; i++) {
            assertTrue(logs[i].topics[0] != feeEventSig, "ProtocolFeeCollected should not emit");
        }
    }

    /*//////////////////////////////////////////////////////////////
                    PROTOCOL FEE COLLECTED EVENT
    //////////////////////////////////////////////////////////////*/

    function test_ProtocolFeeCollected_ETH() public {
        uint256 taskId = 1;
        vm.prank(taskManager);
        escrowVault.deposit{ value: BOUNTY_AMOUNT }(taskId, address(0), BOUNTY_AMOUNT);

        uint256 expectedFee = (BOUNTY_AMOUNT * 300) / 10_000;

        vm.expectEmit(true, true, false, true);
        emit IEscrowVault.ProtocolFeeCollected(taskId, address(0), expectedFee, treasury);

        vm.prank(taskManager);
        escrowVault.release(taskId, recipient);
    }

    function test_ProtocolFeeCollected_ERC20() public {
        uint256 taskId = 1;
        vm.prank(taskManager);
        escrowVault.deposit(taskId, address(token), BOUNTY_AMOUNT);

        uint256 expectedFee = (BOUNTY_AMOUNT * 300) / 10_000;

        vm.expectEmit(true, true, false, true);
        emit IEscrowVault.ProtocolFeeCollected(taskId, address(token), expectedFee, treasury);

        vm.prank(taskManager);
        escrowVault.release(taskId, recipient);
    }

    function test_Released_Event_IncludesFeeAmount() public {
        uint256 taskId = 1;
        vm.prank(taskManager);
        escrowVault.deposit{ value: BOUNTY_AMOUNT }(taskId, address(0), BOUNTY_AMOUNT);

        uint256 expectedFee = (BOUNTY_AMOUNT * 300) / 10_000;
        uint256 expectedNet = BOUNTY_AMOUNT - expectedFee;

        vm.expectEmit(true, true, false, true);
        emit IEscrowVault.Released(taskId, recipient, expectedNet, expectedFee);

        vm.prank(taskManager);
        escrowVault.release(taskId, recipient);
    }

    /*//////////////////////////////////////////////////////////////
                    ACCUMULATED FEES TRACKING
    //////////////////////////////////////////////////////////////*/

    function test_AccumulatedFees_ETH() public {
        assertEq(escrowVault.accumulatedFees(address(0)), 0);

        // First release
        uint256 taskId1 = 1;
        vm.prank(taskManager);
        escrowVault.deposit{ value: BOUNTY_AMOUNT }(taskId1, address(0), BOUNTY_AMOUNT);
        vm.prank(taskManager);
        escrowVault.release(taskId1, recipient);

        uint256 expectedFee = (BOUNTY_AMOUNT * 300) / 10_000;
        assertEq(escrowVault.accumulatedFees(address(0)), expectedFee);

        // Second release
        uint256 taskId2 = 2;
        vm.prank(taskManager);
        escrowVault.deposit{ value: BOUNTY_AMOUNT }(taskId2, address(0), BOUNTY_AMOUNT);
        vm.prank(taskManager);
        escrowVault.release(taskId2, recipient);

        assertEq(escrowVault.accumulatedFees(address(0)), expectedFee * 2);
    }

    function test_AccumulatedFees_ERC20() public {
        assertEq(escrowVault.accumulatedFees(address(token)), 0);

        uint256 taskId = 1;
        vm.prank(taskManager);
        escrowVault.deposit(taskId, address(token), BOUNTY_AMOUNT);
        vm.prank(taskManager);
        escrowVault.release(taskId, recipient);

        uint256 expectedFee = (BOUNTY_AMOUNT * 300) / 10_000;
        assertEq(escrowVault.accumulatedFees(address(token)), expectedFee);
    }

    function test_AccumulatedFees_NotAffectedByRefund() public {
        uint256 taskId = 1;
        vm.prank(taskManager);
        escrowVault.deposit{ value: BOUNTY_AMOUNT }(taskId, address(0), BOUNTY_AMOUNT);
        vm.prank(taskManager);
        escrowVault.refund(taskId, creator);

        assertEq(escrowVault.accumulatedFees(address(0)), 0);
    }

    function test_AccumulatedFees_SeparatePerToken() public {
        // ETH release
        uint256 taskId1 = 1;
        vm.prank(taskManager);
        escrowVault.deposit{ value: BOUNTY_AMOUNT }(taskId1, address(0), BOUNTY_AMOUNT);
        vm.prank(taskManager);
        escrowVault.release(taskId1, recipient);

        // ERC20 release
        uint256 taskId2 = 2;
        vm.prank(taskManager);
        escrowVault.deposit(taskId2, address(token), BOUNTY_AMOUNT);
        vm.prank(taskManager);
        escrowVault.release(taskId2, recipient);

        uint256 expectedFee = (BOUNTY_AMOUNT * 300) / 10_000;
        assertEq(escrowVault.accumulatedFees(address(0)), expectedFee);
        assertEq(escrowVault.accumulatedFees(address(token)), expectedFee);
    }

    /*//////////////////////////////////////////////////////////////
                   FEE CHANGE TAKES EFFECT IMMEDIATELY
    //////////////////////////////////////////////////////////////*/

    function test_FeeChange_AffectsNextRelease() public {
        // Deposit with 3% fee setting
        uint256 taskId1 = 1;
        vm.prank(taskManager);
        escrowVault.deposit{ value: BOUNTY_AMOUNT }(taskId1, address(0), BOUNTY_AMOUNT);

        uint256 taskId2 = 2;
        vm.prank(taskManager);
        escrowVault.deposit{ value: BOUNTY_AMOUNT }(taskId2, address(0), BOUNTY_AMOUNT);

        // Release first with 3%
        vm.prank(taskManager);
        escrowVault.release(taskId1, recipient);

        uint256 fee3pct = (BOUNTY_AMOUNT * 300) / 10_000;
        assertEq(escrowVault.accumulatedFees(address(0)), fee3pct);

        // Change fee to 5%
        escrowVault.setProtocolFee(500);

        uint256 recipientBalBefore = recipient.balance;
        uint256 treasuryBalBefore = treasury.balance;

        // Release second with 5%
        vm.prank(taskManager);
        escrowVault.release(taskId2, recipient);

        uint256 fee5pct = (BOUNTY_AMOUNT * 500) / 10_000;
        assertEq(treasury.balance, treasuryBalBefore + fee5pct);
        assertEq(recipient.balance, recipientBalBefore + BOUNTY_AMOUNT - fee5pct);
        assertEq(escrowVault.accumulatedFees(address(0)), fee3pct + fee5pct);
    }

    /*//////////////////////////////////////////////////////////////
                     TREASURY CHANGE + RELEASE
    //////////////////////////////////////////////////////////////*/

    function test_TreasuryChange_AffectsNextRelease() public {
        uint256 taskId = 1;
        vm.prank(taskManager);
        escrowVault.deposit{ value: BOUNTY_AMOUNT }(taskId, address(0), BOUNTY_AMOUNT);

        // Change treasury
        address newTreasury = address(0xEEE);
        escrowVault.setProtocolTreasury(newTreasury);

        uint256 newTreasuryBalBefore = newTreasury.balance;

        vm.prank(taskManager);
        escrowVault.release(taskId, recipient);

        uint256 expectedFee = (BOUNTY_AMOUNT * 300) / 10_000;
        assertEq(newTreasury.balance, newTreasuryBalBefore + expectedFee);
        assertEq(treasury.balance, 0); // Old treasury gets nothing
    }

    /*//////////////////////////////////////////////////////////////
                      OWNABLE INTEGRATION
    //////////////////////////////////////////////////////////////*/

    function test_OwnerCanTransfer() public {
        address newOwner = address(0xFFF);
        escrowVault.transferOwnership(newOwner);

        assertEq(escrowVault.owner(), newOwner);

        // New owner can set fee
        vm.prank(newOwner);
        escrowVault.setProtocolFee(100);
        assertEq(escrowVault.protocolFeeBps(), 100);
    }

    /*//////////////////////////////////////////////////////////////
                        DEPOSIT FROM TESTS
    //////////////////////////////////////////////////////////////*/

    function test_DepositFrom_WithFeeOnRelease() public {
        uint256 taskId = 1;

        vm.prank(taskManager);
        escrowVault.depositFrom(taskId, address(token), BOUNTY_AMOUNT, creator);

        uint256 recipientBalBefore = token.balanceOf(recipient);
        uint256 treasuryBalBefore = token.balanceOf(treasury);

        vm.prank(taskManager);
        escrowVault.release(taskId, recipient);

        uint256 expectedFee = (BOUNTY_AMOUNT * 300) / 10_000;
        assertEq(token.balanceOf(recipient), recipientBalBefore + BOUNTY_AMOUNT - expectedFee);
        assertEq(token.balanceOf(treasury), treasuryBalBefore + expectedFee);
    }

    /*//////////////////////////////////////////////////////////////
                       MAX FEE (10%) SCENARIO
    //////////////////////////////////////////////////////////////*/

    function test_MaxFee_10Percent() public {
        escrowVault.setProtocolFee(1000); // 10%

        uint256 taskId = 1;
        vm.prank(taskManager);
        escrowVault.deposit{ value: BOUNTY_AMOUNT }(taskId, address(0), BOUNTY_AMOUNT);

        uint256 recipientBalBefore = recipient.balance;
        uint256 treasuryBalBefore = treasury.balance;

        vm.prank(taskManager);
        escrowVault.release(taskId, recipient);

        uint256 expectedFee = (BOUNTY_AMOUNT * 1000) / 10_000; // 0.1 ether
        assertEq(expectedFee, 0.1 ether);
        assertEq(treasury.balance, treasuryBalBefore + expectedFee);
        assertEq(recipient.balance, recipientBalBefore + BOUNTY_AMOUNT - expectedFee);
    }
}
