// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import { IERC8004IdentityRegistry } from "./interfaces/IERC8004IdentityRegistry.sol";

/**
 * @title ERC8004IdentityRegistry
 * @notice ERC-8004 compliant agent identity registry based on ERC-721
 * @dev Agents are represented as NFTs with associated metadata and wallets
 */
contract ERC8004IdentityRegistry is ERC721, IERC8004IdentityRegistry {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // State
    uint256 private _agentCounter;

    // Agent URIs (agentId => URI)
    mapping(uint256 => string) private _agentURIs;

    // Agent metadata (agentId => key => value)
    mapping(uint256 => mapping(bytes32 => bytes)) private _metadata;

    // Agent wallets (agentId => wallet, wallet => agentId)
    mapping(uint256 => address) private _agentToWallet;
    mapping(address => uint256) private _walletToAgent;

    // Errors
    error NotAgentOwner();
    error AgentNotFound();
    error InvalidSignature();
    error SignatureExpired();
    error WalletAlreadyLinked();
    error NoWalletLinked();

    constructor() ERC721("ERC8004 Agent Identity", "AGENT") { }

    /**
     * @notice Register a new agent with no URI
     */
    function register() external returns (uint256 agentId) {
        return _register(msg.sender, "");
    }

    /**
     * @notice Register a new agent with a URI
     */
    function register(string calldata agentURI) external returns (uint256 agentId) {
        return _register(msg.sender, agentURI);
    }

    /**
     * @notice Register a new agent with URI and metadata
     */
    function register(
        string calldata agentURI,
        MetadataEntry[] calldata metadata
    )
        external
        returns (uint256 agentId)
    {
        agentId = _register(msg.sender, agentURI);

        for (uint256 i = 0; i < metadata.length; i++) {
            bytes32 keyHash = keccak256(bytes(metadata[i].metadataKey));
            _metadata[agentId][keyHash] = metadata[i].metadataValue;

            emit MetadataSet(
                agentId, metadata[i].metadataKey, metadata[i].metadataKey, metadata[i].metadataValue
            );
        }
    }

    /**
     * @notice Register a new agent on behalf of another address
     * @dev Useful for adapters/wrappers that need to register users
     * @param owner The address that will own the agent NFT
     * @param agentURI The URI pointing to agent metadata
     * @return agentId The ID of the newly registered agent
     */
    function registerFor(
        address owner,
        string calldata agentURI
    )
        external
        returns (uint256 agentId)
    {
        return _register(owner, agentURI);
    }

    /**
     * @dev Internal registration logic
     */
    function _register(address owner, string memory agentURI) private returns (uint256 agentId) {
        agentId = ++_agentCounter;

        _mint(owner, agentId);
        _agentURIs[agentId] = agentURI;

        // Auto-link the registering wallet to the agent
        _agentToWallet[agentId] = owner;
        _walletToAgent[owner] = agentId;

        emit Registered(agentId, agentURI, owner);
        emit AgentWalletSet(agentId, owner);
    }

    /**
     * @notice Update an agent's URI (only owner can call)
     */
    function setAgentURI(uint256 agentId, string calldata newURI) external {
        if (!_exists(agentId)) revert AgentNotFound();
        if (ownerOf(agentId) != msg.sender) revert NotAgentOwner();

        _agentURIs[agentId] = newURI;

        emit URIUpdated(agentId, newURI, msg.sender);
    }

    /**
     * @notice Update an agent's URI on behalf of the owner
     * @dev Useful for adapters/wrappers that need to update URIs for their users
     *      The caller must be the linked wallet for the agent
     * @param wallet The wallet address linked to the agent
     * @param newURI The new URI for the agent
     */
    function setAgentURIFor(address wallet, string calldata newURI) external {
        uint256 agentId = _walletToAgent[wallet];
        if (agentId == 0) revert AgentNotFound();

        _agentURIs[agentId] = newURI;

        emit URIUpdated(agentId, newURI, wallet);
    }

    /**
     * @notice Get an agent's URI
     */
    function getAgentURI(uint256 agentId) external view returns (string memory) {
        if (!_exists(agentId)) revert AgentNotFound();
        return _agentURIs[agentId];
    }

    /**
     * @notice Override tokenURI to return agent URI
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (!_exists(tokenId)) revert AgentNotFound();
        return _agentURIs[tokenId];
    }

    /**
     * @notice Set metadata for an agent
     */
    function setMetadata(
        uint256 agentId,
        string calldata metadataKey,
        bytes calldata metadataValue
    )
        external
    {
        if (!_exists(agentId)) revert AgentNotFound();
        if (ownerOf(agentId) != msg.sender) revert NotAgentOwner();

        bytes32 keyHash = keccak256(bytes(metadataKey));
        _metadata[agentId][keyHash] = metadataValue;

        emit MetadataSet(agentId, metadataKey, metadataKey, metadataValue);
    }

    /**
     * @notice Get metadata for an agent
     */
    function getMetadata(
        uint256 agentId,
        string calldata metadataKey
    )
        external
        view
        returns (bytes memory)
    {
        if (!_exists(agentId)) revert AgentNotFound();

        bytes32 keyHash = keccak256(bytes(metadataKey));
        return _metadata[agentId][keyHash];
    }

    /**
     * @notice Set an agent's wallet with signature verification
     * @dev The new wallet must sign a message authorizing the link
     */
    function setAgentWallet(
        uint256 agentId,
        address newWallet,
        uint256 deadline,
        bytes calldata signature
    )
        external
    {
        if (!_exists(agentId)) revert AgentNotFound();
        if (ownerOf(agentId) != msg.sender) revert NotAgentOwner();
        if (block.timestamp > deadline) revert SignatureExpired();
        if (_walletToAgent[newWallet] != 0) revert WalletAlreadyLinked();

        // Verify signature from new wallet
        bytes32 message =
            keccak256(abi.encodePacked("Link wallet to agent:", agentId, deadline, address(this)));
        bytes32 ethSignedMessage = message.toEthSignedMessageHash();
        address signer = ethSignedMessage.recover(signature);

        if (signer != newWallet) revert InvalidSignature();

        // Unlink previous wallet if exists
        address previousWallet = _agentToWallet[agentId];
        if (previousWallet != address(0)) {
            delete _walletToAgent[previousWallet];
        }

        // Link new wallet
        _agentToWallet[agentId] = newWallet;
        _walletToAgent[newWallet] = agentId;

        emit AgentWalletSet(agentId, newWallet);
    }

    /**
     * @notice Get an agent's associated wallet
     */
    function getAgentWallet(uint256 agentId) external view returns (address) {
        if (!_exists(agentId)) revert AgentNotFound();
        return _agentToWallet[agentId];
    }

    /**
     * @notice Unset an agent's wallet
     */
    function unsetAgentWallet(uint256 agentId) external {
        if (!_exists(agentId)) revert AgentNotFound();
        if (ownerOf(agentId) != msg.sender) revert NotAgentOwner();

        address previousWallet = _agentToWallet[agentId];
        if (previousWallet == address(0)) revert NoWalletLinked();

        delete _walletToAgent[previousWallet];
        delete _agentToWallet[agentId];

        emit AgentWalletUnset(agentId, previousWallet);
    }

    /**
     * @notice Get the agent ID for a wallet address
     */
    function getAgentIdByWallet(address wallet) external view returns (uint256) {
        return _walletToAgent[wallet];
    }

    /**
     * @notice Get the total number of registered agents
     */
    function totalAgents() external view returns (uint256) {
        return _agentCounter;
    }

    /**
     * @dev Check if an agent exists
     */
    function _exists(uint256 agentId) internal view returns (bool) {
        return agentId > 0 && agentId <= _agentCounter;
    }

    /**
     * @dev Override _update to handle wallet unlinking on transfer
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = super._update(to, tokenId, auth);

        // When transferring, unlink the wallet from the agent
        if (from != address(0) && to != address(0) && from != to) {
            address linkedWallet = _agentToWallet[tokenId];
            if (linkedWallet != address(0)) {
                delete _walletToAgent[linkedWallet];
                delete _agentToWallet[tokenId];
                emit AgentWalletUnset(tokenId, linkedWallet);
            }
        }

        return from;
    }
}
