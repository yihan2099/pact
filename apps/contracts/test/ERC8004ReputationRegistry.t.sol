// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import { Test, console } from "forge-std/Test.sol";
import { ERC8004IdentityRegistry } from "../src/erc8004/ERC8004IdentityRegistry.sol";
import { ERC8004ReputationRegistry } from "../src/erc8004/ERC8004ReputationRegistry.sol";
import { IERC8004ReputationRegistry } from "../src/erc8004/interfaces/IERC8004ReputationRegistry.sol";

contract ERC8004ReputationRegistryTest is Test {
    ERC8004IdentityRegistry public identityRegistry;
    ERC8004ReputationRegistry public reputationRegistry;

    address public deployer;
    address public client1 = address(0x1);
    address public client2 = address(0x2);
    address public agent1 = address(0x3);
    address public agent2 = address(0x4);
    address public responder = address(0x5);

    uint256 public agent1Id;

    function setUp() public {
        deployer = address(this);

        identityRegistry = new ERC8004IdentityRegistry();
        reputationRegistry = new ERC8004ReputationRegistry(address(identityRegistry));

        // Register agent1
        vm.prank(agent1);
        agent1Id = identityRegistry.register("ipfs://agent1");
    }

    /*//////////////////////////////////////////////////////////////
                          GIVE FEEDBACK TESTS
    //////////////////////////////////////////////////////////////*/

    function test_GiveFeedback_Basic() public {
        vm.prank(client1);
        vm.expectEmit(true, true, false, false);
        emit IERC8004ReputationRegistry.NewFeedback(
            agent1Id, client1, 0, 10, 0, "task", "task", "win", "", "", bytes32(0)
        );
        reputationRegistry.giveFeedback(agent1Id, 10, 0, "task", "win", "", "", bytes32(0));

        // Verify feedback count
        uint64 count = reputationRegistry.getFeedbackCount(agent1Id, "task", "win");
        assertEq(count, 1);
    }

    function test_GiveFeedback_MultipleSameClient() public {
        vm.startPrank(client1);
        reputationRegistry.giveFeedback(agent1Id, 10, 0, "task", "win", "", "", bytes32(0));
        reputationRegistry.giveFeedback(agent1Id, 5, 0, "task", "win", "", "", bytes32(0));
        vm.stopPrank();

        // Index should have incremented
        uint64 lastIndex = reputationRegistry.getLastIndex(agent1Id, client1);
        assertEq(lastIndex, 2);
    }

    function test_GiveFeedback_MultipleClients() public {
        vm.prank(client1);
        reputationRegistry.giveFeedback(agent1Id, 10, 0, "task", "win", "", "", bytes32(0));

        vm.prank(client2);
        reputationRegistry.giveFeedback(agent1Id, 5, 0, "dispute", "loss", "", "", bytes32(0));

        address[] memory clients = reputationRegistry.getClients(agent1Id);
        assertEq(clients.length, 2);
        assertEq(clients[0], client1);
        assertEq(clients[1], client2);
    }

    function test_GiveFeedback_RevertOnNonExistentAgent() public {
        vm.prank(client1);
        vm.expectRevert(ERC8004ReputationRegistry.AgentNotFound.selector);
        reputationRegistry.giveFeedback(999, 10, 0, "task", "win", "", "", bytes32(0));
    }

    function test_GiveFeedback_TagCountsUpdated() public {
        vm.startPrank(client1);
        reputationRegistry.giveFeedback(agent1Id, 10, 0, "task", "win", "", "", bytes32(0));
        reputationRegistry.giveFeedback(agent1Id, 10, 0, "task", "win", "", "", bytes32(0));
        reputationRegistry.giveFeedback(agent1Id, -5, 0, "dispute", "loss", "", "", bytes32(0));
        vm.stopPrank();

        assertEq(reputationRegistry.getFeedbackCount(agent1Id, "task", "win"), 2);
        assertEq(reputationRegistry.getFeedbackCount(agent1Id, "dispute", "loss"), 1);
    }

    /*//////////////////////////////////////////////////////////////
                        REVOKE FEEDBACK TESTS
    //////////////////////////////////////////////////////////////*/

    function test_RevokeFeedback_Basic() public {
        vm.prank(client1);
        reputationRegistry.giveFeedback(agent1Id, 10, 0, "task", "win", "", "", bytes32(0));

        vm.prank(client1);
        vm.expectEmit(true, true, true, false);
        emit IERC8004ReputationRegistry.FeedbackRevoked(agent1Id, client1, 0);
        reputationRegistry.revokeFeedback(agent1Id, 0);
    }

    function test_RevokeFeedback_TagCountDecremented() public {
        vm.prank(client1);
        reputationRegistry.giveFeedback(agent1Id, 10, 0, "task", "win", "", "", bytes32(0));

        assertEq(reputationRegistry.getFeedbackCount(agent1Id, "task", "win"), 1);

        vm.prank(client1);
        reputationRegistry.revokeFeedback(agent1Id, 0);

        assertEq(reputationRegistry.getFeedbackCount(agent1Id, "task", "win"), 0);
    }

    function test_RevokeFeedback_RevertOnNonExistent() public {
        vm.prank(client1);
        vm.expectRevert(ERC8004ReputationRegistry.FeedbackNotFound.selector);
        reputationRegistry.revokeFeedback(agent1Id, 0);
    }

    function test_RevokeFeedback_RevertOnAlreadyRevoked() public {
        vm.prank(client1);
        reputationRegistry.giveFeedback(agent1Id, 10, 0, "task", "win", "", "", bytes32(0));

        vm.prank(client1);
        reputationRegistry.revokeFeedback(agent1Id, 0);

        vm.prank(client1);
        vm.expectRevert(ERC8004ReputationRegistry.FeedbackAlreadyRevoked.selector);
        reputationRegistry.revokeFeedback(agent1Id, 0);
    }

    function test_RevokeFeedback_OnlyOriginalClient() public {
        vm.prank(client1);
        reputationRegistry.giveFeedback(agent1Id, 10, 0, "task", "win", "", "", bytes32(0));

        // Different sender should fail (feedback not found for client2 at index 0)
        vm.prank(client2);
        vm.expectRevert(ERC8004ReputationRegistry.FeedbackNotFound.selector);
        reputationRegistry.revokeFeedback(agent1Id, 0);
    }

    /*//////////////////////////////////////////////////////////////
                        GET SUMMARY TESTS
    //////////////////////////////////////////////////////////////*/

    function test_GetSummary_Basic() public {
        vm.prank(client1);
        reputationRegistry.giveFeedback(agent1Id, 10, 0, "task", "win", "", "", bytes32(0));

        vm.prank(client2);
        reputationRegistry.giveFeedback(agent1Id, 5, 0, "task", "win", "", "", bytes32(0));

        address[] memory emptyClients = new address[](0);
        (uint64 count, int128 summaryValue,) =
            reputationRegistry.getSummary(agent1Id, emptyClients, "", "");

        assertEq(count, 2);
        assertEq(summaryValue, 15);
    }

    function test_GetSummary_WithTagFilters() public {
        vm.startPrank(client1);
        reputationRegistry.giveFeedback(agent1Id, 10, 0, "task", "win", "", "", bytes32(0));
        reputationRegistry.giveFeedback(agent1Id, -20, 0, "dispute", "loss", "", "", bytes32(0));
        vm.stopPrank();

        address[] memory emptyClients = new address[](0);

        // Filter by task/win only
        (uint64 count, int128 summaryValue,) =
            reputationRegistry.getSummary(agent1Id, emptyClients, "task", "win");

        assertEq(count, 1);
        assertEq(summaryValue, 10);
    }

    function test_GetSummary_SkipsRevoked() public {
        vm.startPrank(client1);
        reputationRegistry.giveFeedback(agent1Id, 10, 0, "task", "win", "", "", bytes32(0));
        reputationRegistry.giveFeedback(agent1Id, 5, 0, "task", "win", "", "", bytes32(0));
        reputationRegistry.revokeFeedback(agent1Id, 0); // Revoke first feedback
        vm.stopPrank();

        address[] memory emptyClients = new address[](0);
        (uint64 count, int128 summaryValue,) =
            reputationRegistry.getSummary(agent1Id, emptyClients, "", "");

        assertEq(count, 1);
        assertEq(summaryValue, 5);
    }

    function test_GetSummary_RevertTooManyClients() public {
        // Register 101 clients and give feedback
        for (uint256 i = 0; i < 101; i++) {
            address client = address(uint160(0x1000 + i));
            vm.prank(client);
            reputationRegistry.giveFeedback(agent1Id, 1, 0, "task", "win", "", "", bytes32(0));
        }

        address[] memory emptyClients = new address[](0);
        vm.expectRevert(ERC8004ReputationRegistry.TooManyClients.selector);
        reputationRegistry.getSummary(agent1Id, emptyClients, "", "");
    }

    function test_GetSummary_RevertTooManyFeedback() public {
        // Give 101 feedback entries from one client
        vm.startPrank(client1);
        for (uint256 i = 0; i < 101; i++) {
            reputationRegistry.giveFeedback(agent1Id, 1, 0, "task", "win", "", "", bytes32(0));
        }
        vm.stopPrank();

        address[] memory emptyClients = new address[](0);
        vm.expectRevert(ERC8004ReputationRegistry.TooManyFeedback.selector);
        reputationRegistry.getSummary(agent1Id, emptyClients, "", "");
    }

    /*//////////////////////////////////////////////////////////////
                    PAGINATED SUMMARY TESTS
    //////////////////////////////////////////////////////////////*/

    function test_GetPaginatedSummary() public {
        // Create feedback from 3 clients
        for (uint256 i = 0; i < 3; i++) {
            address client = address(uint160(0x1000 + i));
            vm.prank(client);
            reputationRegistry.giveFeedback(
                agent1Id, int128(int256(i + 1)), 0, "task", "win", "", "", bytes32(0)
            );
        }

        // Get first 2 clients
        (uint64 count, int128 summaryValue,, uint256 processed, bool hasMore) =
            reputationRegistry.getPaginatedSummary(agent1Id, "", "", 0, 2);

        assertEq(count, 2);
        assertEq(summaryValue, 3); // 1 + 2
        assertEq(processed, 2);
        assertTrue(hasMore);

        // Get remaining
        (count, summaryValue,, processed, hasMore) =
            reputationRegistry.getPaginatedSummary(agent1Id, "", "", 2, 2);

        assertEq(count, 1);
        assertEq(summaryValue, 3);
        assertEq(processed, 1);
        assertFalse(hasMore);
    }

    /*//////////////////////////////////////////////////////////////
                        READ FEEDBACK TESTS
    //////////////////////////////////////////////////////////////*/

    function test_ReadFeedback_ReturnsCorrectValues() public {
        vm.prank(client1);
        reputationRegistry.giveFeedback(agent1Id, 42, 2, "task", "win", "", "", bytes32(0));

        (int128 value, uint8 valueDecimals,,, bool isRevoked) =
            reputationRegistry.readFeedback(agent1Id, client1, 0);

        assertEq(value, 42);
        assertEq(valueDecimals, 2);
        assertFalse(isRevoked);
    }

    function test_ReadFeedback_RevertOnNonExistent() public {
        vm.expectRevert(ERC8004ReputationRegistry.FeedbackNotFound.selector);
        reputationRegistry.readFeedback(agent1Id, client1, 0);
    }

    /*//////////////////////////////////////////////////////////////
                      APPEND RESPONSE TESTS
    //////////////////////////////////////////////////////////////*/

    function test_AppendResponse_EmitsEvent() public {
        vm.prank(client1);
        reputationRegistry.giveFeedback(agent1Id, 10, 0, "task", "win", "", "", bytes32(0));

        vm.prank(responder);
        vm.expectEmit(true, true, false, false);
        emit IERC8004ReputationRegistry.ResponseAppended(
            agent1Id, client1, 0, responder, "ipfs://response", bytes32(0)
        );
        reputationRegistry.appendResponse(agent1Id, client1, 0, "ipfs://response", bytes32(0));
    }

    function test_AppendResponse_RevertOnNonExistent() public {
        vm.prank(responder);
        vm.expectRevert(ERC8004ReputationRegistry.FeedbackNotFound.selector);
        reputationRegistry.appendResponse(agent1Id, client1, 0, "ipfs://response", bytes32(0));
    }
}
