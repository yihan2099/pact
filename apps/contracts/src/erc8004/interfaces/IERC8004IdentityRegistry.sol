// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/**
 * @title IERC8004IdentityRegistry
 * @notice Interface for ERC-8004 Trustless Agents Identity Registry
 * @dev ERC-721 based agent identity with metadata support
 *      Implementation should also implement IERC721
 */
interface IERC8004IdentityRegistry {
    /// @notice Metadata entry for agent registration
    struct MetadataEntry {
        string metadataKey;
        bytes metadataValue;
    }

    /// @notice Emitted when a new agent is registered
    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);

    /// @notice Emitted when an agent's URI is updated
    event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);

    /// @notice Emitted when agent metadata is set
    event MetadataSet(
        uint256 indexed agentId,
        string indexed indexedMetadataKey,
        string metadataKey,
        bytes metadataValue
    );

    /// @notice Emitted when an agent wallet is set
    event AgentWalletSet(uint256 indexed agentId, address indexed newWallet);

    /// @notice Emitted when an agent wallet is unset
    event AgentWalletUnset(uint256 indexed agentId, address indexed previousWallet);

    /**
     * @notice Register a new agent with no URI
     * @return agentId The ID of the newly registered agent
     */
    function register() external returns (uint256 agentId);

    /**
     * @notice Register a new agent with a URI
     * @param agentURI The URI pointing to agent metadata (IPFS CID or URL)
     * @return agentId The ID of the newly registered agent
     */
    function register(string calldata agentURI) external returns (uint256 agentId);

    /**
     * @notice Register a new agent with URI and metadata
     * @param agentURI The URI pointing to agent metadata
     * @param metadata Array of metadata entries to set
     * @return agentId The ID of the newly registered agent
     */
    function register(
        string calldata agentURI,
        MetadataEntry[] calldata metadata
    )
        external
        returns (uint256 agentId);

    /**
     * @notice Register a new agent on behalf of another address
     * @param owner The address that will own the agent NFT
     * @param agentURI The URI pointing to agent metadata
     * @return agentId The ID of the newly registered agent
     */
    function registerFor(address owner, string calldata agentURI) external returns (uint256 agentId);

    /**
     * @notice Update an agent's URI
     * @param agentId The agent ID
     * @param newURI The new URI
     */
    function setAgentURI(uint256 agentId, string calldata newURI) external;

    /**
     * @notice Update an agent's URI on behalf of the owner
     * @dev Useful for adapters/wrappers that need to update URIs for their users
     * @param wallet The wallet address linked to the agent
     * @param newURI The new URI for the agent
     */
    function setAgentURIFor(address wallet, string calldata newURI) external;

    /**
     * @notice Get an agent's URI
     * @param agentId The agent ID
     * @return The agent URI
     */
    function getAgentURI(uint256 agentId) external view returns (string memory);

    /**
     * @notice Set metadata for an agent
     * @param agentId The agent ID
     * @param metadataKey The metadata key
     * @param metadataValue The metadata value
     */
    function setMetadata(
        uint256 agentId,
        string calldata metadataKey,
        bytes calldata metadataValue
    )
        external;

    /**
     * @notice Get metadata for an agent
     * @param agentId The agent ID
     * @param metadataKey The metadata key
     * @return The metadata value
     */
    function getMetadata(
        uint256 agentId,
        string calldata metadataKey
    )
        external
        view
        returns (bytes memory);

    /**
     * @notice Set an agent's wallet address with signature verification
     * @param agentId The agent ID
     * @param newWallet The new wallet address
     * @param deadline Signature expiration timestamp
     * @param signature The signature from the new wallet
     */
    function setAgentWallet(
        uint256 agentId,
        address newWallet,
        uint256 deadline,
        bytes calldata signature
    )
        external;

    /**
     * @notice Get an agent's associated wallet
     * @param agentId The agent ID
     * @return The wallet address
     */
    function getAgentWallet(uint256 agentId) external view returns (address);

    /**
     * @notice Unset an agent's wallet
     * @param agentId The agent ID
     */
    function unsetAgentWallet(uint256 agentId) external;

    /**
     * @notice Get the agent ID for a wallet address
     * @param wallet The wallet address
     * @return The agent ID (0 if not linked)
     */
    function getAgentIdByWallet(address wallet) external view returns (uint256);

    /**
     * @notice Get the total number of registered agents
     * @return The agent count
     */
    function totalAgents() external view returns (uint256);
}
