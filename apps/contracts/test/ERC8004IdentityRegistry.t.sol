// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import { Test, console } from "forge-std/Test.sol";
import { ERC8004IdentityRegistry } from "../src/erc8004/ERC8004IdentityRegistry.sol";
import { IERC8004IdentityRegistry } from "../src/erc8004/interfaces/IERC8004IdentityRegistry.sol";

contract ERC8004IdentityRegistryTest is Test {
    ERC8004IdentityRegistry public registry;

    address public deployer;
    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public adapter = address(0x3);
    address public randomUser = address(0x4);

    function setUp() public {
        deployer = address(this);
        registry = new ERC8004IdentityRegistry();
    }

    /*//////////////////////////////////////////////////////////////
                        REGISTRATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Register_Basic() public {
        vm.prank(user1);
        vm.expectEmit(true, false, true, false);
        emit IERC8004IdentityRegistry.Registered(1, "", user1);
        uint256 agentId = registry.register();

        assertEq(agentId, 1);
        assertEq(registry.totalAgents(), 1);
        assertEq(registry.ownerOf(agentId), user1);
    }

    function test_Register_WithURI() public {
        vm.prank(user1);
        uint256 agentId = registry.register("ipfs://agent1-uri");

        assertEq(registry.tokenURI(agentId), "ipfs://agent1-uri");
    }

    function test_Register_WithURIAndMetadata() public {
        IERC8004IdentityRegistry.MetadataEntry[] memory metadata =
            new IERC8004IdentityRegistry.MetadataEntry[](2);
        metadata[0] = IERC8004IdentityRegistry.MetadataEntry({
            metadataKey: "name",
            metadataValue: abi.encode("Agent One")
        });
        metadata[1] = IERC8004IdentityRegistry.MetadataEntry({
            metadataKey: "version",
            metadataValue: abi.encode("1.0")
        });

        vm.prank(user1);
        uint256 agentId = registry.register("ipfs://agent1-uri", metadata);

        assertEq(registry.tokenURI(agentId), "ipfs://agent1-uri");

        bytes memory nameValue = registry.getMetadata(agentId, "name");
        assertEq(abi.decode(nameValue, (string)), "Agent One");

        bytes memory versionValue = registry.getMetadata(agentId, "version");
        assertEq(abi.decode(versionValue, (string)), "1.0");
    }

    function test_RegisterFor_AuthorizedAdapter() public {
        registry.authorizeAdapter(adapter);

        vm.prank(adapter);
        uint256 agentId = registry.registerFor(user1, "ipfs://agent1-uri");

        assertEq(agentId, 1);
        assertEq(registry.ownerOf(agentId), user1);
        assertEq(registry.tokenURI(agentId), "ipfs://agent1-uri");
    }

    function test_RegisterFor_UnauthorizedReverts() public {
        vm.prank(randomUser);
        vm.expectRevert(ERC8004IdentityRegistry.NotAuthorized.selector);
        registry.registerFor(user1, "ipfs://agent1-uri");
    }

    /*//////////////////////////////////////////////////////////////
                        SET AGENT URI TESTS
    //////////////////////////////////////////////////////////////*/

    function test_SetAgentURI_OwnerCanUpdate() public {
        vm.prank(user1);
        uint256 agentId = registry.register("ipfs://original-uri");

        vm.prank(user1);
        registry.setAgentURI(agentId, "ipfs://updated-uri");

        assertEq(registry.getAgentURI(agentId), "ipfs://updated-uri");
    }

    function test_SetAgentURI_NonOwnerReverts() public {
        vm.prank(user1);
        uint256 agentId = registry.register("ipfs://original-uri");

        vm.prank(user2);
        vm.expectRevert(ERC8004IdentityRegistry.NotAgentOwner.selector);
        registry.setAgentURI(agentId, "ipfs://hacked-uri");
    }

    function test_SetAgentURIFor_WalletCanUpdate() public {
        vm.prank(user1);
        registry.register("ipfs://original-uri");

        // user1 is auto-linked as wallet, so user1 can call setAgentURIFor
        vm.prank(user1);
        registry.setAgentURIFor(user1, "ipfs://updated-uri");

        uint256 agentId = registry.getAgentIdByWallet(user1);
        assertEq(registry.getAgentURI(agentId), "ipfs://updated-uri");
    }

    function test_SetAgentURIFor_AuthorizedAdapterCanUpdate() public {
        registry.authorizeAdapter(adapter);

        vm.prank(user1);
        registry.register("ipfs://original-uri");

        vm.prank(adapter);
        registry.setAgentURIFor(user1, "ipfs://adapter-updated-uri");

        uint256 agentId = registry.getAgentIdByWallet(user1);
        assertEq(registry.getAgentURI(agentId), "ipfs://adapter-updated-uri");
    }

    function test_SetAgentURIFor_UnauthorizedReverts() public {
        vm.prank(user1);
        registry.register("ipfs://original-uri");

        vm.prank(randomUser);
        vm.expectRevert(ERC8004IdentityRegistry.NotAgentOwner.selector);
        registry.setAgentURIFor(user1, "ipfs://hacked-uri");
    }

    /*//////////////////////////////////////////////////////////////
                      SET AGENT WALLET TESTS
    //////////////////////////////////////////////////////////////*/

    function test_SetAgentWallet_ValidSignature() public {
        vm.prank(user1);
        uint256 agentId = registry.register("ipfs://agent1-uri");

        // Create a new wallet with known private key
        uint256 newWalletPk = 0xBEEF;
        address newWallet = vm.addr(newWalletPk);

        // First unset auto-linked wallet so newWallet isn't "already linked" to user1
        vm.prank(user1);
        registry.unsetAgentWallet(agentId);

        uint256 deadline = block.timestamp + 1 hours;
        bytes32 message =
            keccak256(abi.encodePacked("Link wallet to agent:", agentId, deadline, address(registry)));
        bytes32 ethSignedMessage = _toEthSignedMessageHash(message);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(newWalletPk, ethSignedMessage);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(user1);
        vm.expectEmit(true, true, false, false);
        emit IERC8004IdentityRegistry.AgentWalletSet(agentId, newWallet);
        registry.setAgentWallet(agentId, newWallet, deadline, signature);

        assertEq(registry.getAgentWallet(agentId), newWallet);
        assertEq(registry.getAgentIdByWallet(newWallet), agentId);
    }

    function test_SetAgentWallet_InvalidSignatureReverts() public {
        vm.prank(user1);
        uint256 agentId = registry.register("ipfs://agent1-uri");

        vm.prank(user1);
        registry.unsetAgentWallet(agentId);

        address newWallet = address(0xDEAD);
        uint256 deadline = block.timestamp + 1 hours;

        // Use wrong private key to sign
        uint256 wrongPk = 0xCAFE;
        bytes32 message =
            keccak256(abi.encodePacked("Link wallet to agent:", agentId, deadline, address(registry)));
        bytes32 ethSignedMessage = _toEthSignedMessageHash(message);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongPk, ethSignedMessage);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(user1);
        vm.expectRevert(ERC8004IdentityRegistry.InvalidSignature.selector);
        registry.setAgentWallet(agentId, newWallet, deadline, signature);
    }

    function test_SetAgentWallet_ExpiredDeadlineReverts() public {
        vm.prank(user1);
        uint256 agentId = registry.register("ipfs://agent1-uri");

        vm.prank(user1);
        registry.unsetAgentWallet(agentId);

        uint256 newWalletPk = 0xBEEF;
        address newWallet = vm.addr(newWalletPk);

        // Deadline already passed
        uint256 deadline = block.timestamp - 1;
        bytes32 message =
            keccak256(abi.encodePacked("Link wallet to agent:", agentId, deadline, address(registry)));
        bytes32 ethSignedMessage = _toEthSignedMessageHash(message);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(newWalletPk, ethSignedMessage);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(user1);
        vm.expectRevert(ERC8004IdentityRegistry.SignatureExpired.selector);
        registry.setAgentWallet(agentId, newWallet, deadline, signature);
    }

    function test_SetAgentWallet_DeadlineTooFarReverts() public {
        vm.prank(user1);
        uint256 agentId = registry.register("ipfs://agent1-uri");

        vm.prank(user1);
        registry.unsetAgentWallet(agentId);

        uint256 newWalletPk = 0xBEEF;
        address newWallet = vm.addr(newWalletPk);

        // Deadline > 7 days from now
        uint256 deadline = block.timestamp + 8 days;
        bytes32 message =
            keccak256(abi.encodePacked("Link wallet to agent:", agentId, deadline, address(registry)));
        bytes32 ethSignedMessage = _toEthSignedMessageHash(message);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(newWalletPk, ethSignedMessage);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(user1);
        vm.expectRevert(ERC8004IdentityRegistry.SignatureExpired.selector);
        registry.setAgentWallet(agentId, newWallet, deadline, signature);
    }

    function test_SetAgentWallet_AlreadyLinkedReverts() public {
        // Register two agents
        vm.prank(user1);
        uint256 agent1Id = registry.register("ipfs://agent1-uri");

        vm.prank(user2);
        registry.register("ipfs://agent2-uri");

        vm.prank(user1);
        registry.unsetAgentWallet(agent1Id);

        // user2's wallet is already linked to agent2
        uint256 deadline = block.timestamp + 1 hours;

        // We need user2 to sign. Use a known key for user2.
        // Since user2 is address(0x2), we can't use vm.sign with it directly.
        // Instead, create a scenario where newWallet is already linked
        uint256 newWalletPk = 0xBEEF;
        address newWallet = vm.addr(newWalletPk);

        // Register another agent and link newWallet to it first
        vm.prank(newWallet);
        registry.register("ipfs://agent3-uri");
        // newWallet is now auto-linked to agent3

        // Now try to link newWallet to agent1 — should fail
        bytes32 message =
            keccak256(abi.encodePacked("Link wallet to agent:", agent1Id, deadline, address(registry)));
        bytes32 ethSignedMessage = _toEthSignedMessageHash(message);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(newWalletPk, ethSignedMessage);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(user1);
        vm.expectRevert(ERC8004IdentityRegistry.WalletAlreadyLinked.selector);
        registry.setAgentWallet(agent1Id, newWallet, deadline, signature);
    }

    function test_SetAgentWallet_PreviousWalletUnlinked() public {
        vm.prank(user1);
        uint256 agentId = registry.register("ipfs://agent1-uri");

        // user1 is auto-linked. Now link a new wallet.
        uint256 newWalletPk = 0xBEEF;
        address newWallet = vm.addr(newWalletPk);

        uint256 deadline = block.timestamp + 1 hours;
        bytes32 message =
            keccak256(abi.encodePacked("Link wallet to agent:", agentId, deadline, address(registry)));
        bytes32 ethSignedMessage = _toEthSignedMessageHash(message);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(newWalletPk, ethSignedMessage);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(user1);
        registry.setAgentWallet(agentId, newWallet, deadline, signature);

        // Previous wallet (user1) should be unlinked
        assertEq(registry.getAgentIdByWallet(user1), 0);
        // New wallet should be linked
        assertEq(registry.getAgentIdByWallet(newWallet), agentId);
    }

    /*//////////////////////////////////////////////////////////////
                      UNSET AGENT WALLET TESTS
    //////////////////////////////////////////////////////////////*/

    function test_UnsetAgentWallet() public {
        vm.prank(user1);
        uint256 agentId = registry.register("ipfs://agent1-uri");

        vm.prank(user1);
        vm.expectEmit(true, true, false, false);
        emit IERC8004IdentityRegistry.AgentWalletUnset(agentId, user1);
        registry.unsetAgentWallet(agentId);

        assertEq(registry.getAgentIdByWallet(user1), 0);
    }

    function test_UnsetAgentWallet_RevertIfNoWalletLinked() public {
        vm.prank(user1);
        uint256 agentId = registry.register("ipfs://agent1-uri");

        // Unset once
        vm.prank(user1);
        registry.unsetAgentWallet(agentId);

        // Try to unset again — no wallet linked
        vm.prank(user1);
        vm.expectRevert(ERC8004IdentityRegistry.NoWalletLinked.selector);
        registry.unsetAgentWallet(agentId);
    }

    /*//////////////////////////////////////////////////////////////
                      NFT TRANSFER TESTS
    //////////////////////////////////////////////////////////////*/

    function test_NFTTransfer_WalletLinkPersists() public {
        vm.prank(user1);
        uint256 agentId = registry.register("ipfs://agent1-uri");

        // Transfer NFT from user1 to user2
        vm.prank(user1);
        registry.transferFrom(user1, user2, agentId);

        // Wallet link should persist even after transfer
        assertEq(registry.getAgentIdByWallet(user1), agentId);
        assertEq(registry.getAgentWallet(agentId), user1);
        // NFT ownership changed
        assertEq(registry.ownerOf(agentId), user2);
    }

    /*//////////////////////////////////////////////////////////////
                      METADATA TESTS
    //////////////////////////////////////////////////////////////*/

    function test_SetAndGetMetadata() public {
        vm.prank(user1);
        uint256 agentId = registry.register("ipfs://agent1-uri");

        vm.prank(user1);
        registry.setMetadata(agentId, "description", abi.encode("An AI agent"));

        bytes memory value = registry.getMetadata(agentId, "description");
        assertEq(abi.decode(value, (string)), "An AI agent");
    }

    /*//////////////////////////////////////////////////////////////
                      TOTAL AGENTS TESTS
    //////////////////////////////////////////////////////////////*/

    function test_TotalAgents_Increments() public {
        assertEq(registry.totalAgents(), 0);

        vm.prank(user1);
        registry.register("ipfs://agent1-uri");
        assertEq(registry.totalAgents(), 1);

        vm.prank(user2);
        registry.register("ipfs://agent2-uri");
        assertEq(registry.totalAgents(), 2);
    }

    /*//////////////////////////////////////////////////////////////
                    ADAPTER AUTHORIZATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_AuthorizeAndRevokeAdapter() public {
        vm.expectEmit(true, false, false, false);
        emit ERC8004IdentityRegistry.AdapterAuthorized(adapter);
        registry.authorizeAdapter(adapter);

        assertTrue(registry.authorizedAdapters(adapter));

        vm.expectEmit(true, false, false, false);
        emit ERC8004IdentityRegistry.AdapterRevoked(adapter);
        registry.revokeAdapter(adapter);

        assertFalse(registry.authorizedAdapters(adapter));
    }

    /*//////////////////////////////////////////////////////////////
                      OWNERSHIP TESTS
    //////////////////////////////////////////////////////////////*/

    function test_TransferOwnership() public {
        assertEq(registry.owner(), deployer);

        vm.expectEmit(true, true, false, false);
        emit ERC8004IdentityRegistry.OwnershipTransferred(deployer, user1);
        registry.transferOwnership(user1);

        assertEq(registry.owner(), user1);
    }

    /*//////////////////////////////////////////////////////////////
                      HELPERS
    //////////////////////////////////////////////////////////////*/

    function _toEthSignedMessageHash(bytes32 hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }
}
