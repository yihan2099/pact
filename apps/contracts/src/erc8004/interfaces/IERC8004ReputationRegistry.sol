// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/**
 * @title IERC8004ReputationRegistry
 * @notice Interface for ERC-8004 Trustless Agents Reputation Registry
 * @dev Feedback-based reputation with tags for categorization
 */
interface IERC8004ReputationRegistry {
    /// @notice Emitted when new feedback is given
    event NewFeedback(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 feedbackIndex,
        int128 value,
        uint8 valueDecimals,
        string indexed indexedTag1,
        string tag1,
        string tag2,
        string endpoint,
        string feedbackURI,
        bytes32 feedbackHash
    );

    /// @notice Emitted when feedback is revoked
    event FeedbackRevoked(
        uint256 indexed agentId, address indexed clientAddress, uint64 indexed feedbackIndex
    );

    /// @notice Emitted when a response is appended to feedback
    event ResponseAppended(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 feedbackIndex,
        address indexed responder,
        string responseURI,
        bytes32 responseHash
    );

    /**
     * @notice Get the identity registry address (immutable, set at construction)
     * @return The identity registry address
     */
    function identityRegistry() external view returns (address);

    /**
     * @notice Give feedback to an agent
     * @param agentId The agent ID receiving feedback
     * @param value The feedback value (positive or negative)
     * @param valueDecimals Decimal places for the value
     * @param tag1 Primary categorization tag (e.g., "task", "dispute")
     * @param tag2 Secondary categorization tag (e.g., "win", "loss")
     * @param endpoint The service endpoint used (optional)
     * @param feedbackURI URI to detailed feedback (optional)
     * @param feedbackHash Hash of the feedback content for verification
     */
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    )
        external;

    /**
     * @notice Revoke previously given feedback
     * @param agentId The agent ID
     * @param feedbackIndex The index of the feedback to revoke
     */
    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external;

    /**
     * @notice Append a response to feedback
     * @param agentId The agent ID
     * @param clientAddress The original feedback giver
     * @param feedbackIndex The feedback index
     * @param responseURI URI to the response content
     * @param responseHash Hash of the response content
     */
    function appendResponse(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex,
        string calldata responseURI,
        bytes32 responseHash
    )
        external;

    /**
     * @notice Get a summary of an agent's reputation
     * @param agentId The agent ID
     * @param clientAddresses Filter by specific clients (empty for all)
     * @param tag1 Filter by primary tag (empty for all)
     * @param tag2 Filter by secondary tag (empty for all)
     * @return count Number of matching feedback entries
     * @return summaryValue Sum of feedback values
     * @return summaryValueDecimals Decimal places for the summary value
     */
    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2
    )
        external
        view
        returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals);

    /**
     * @notice Read a specific feedback entry
     * @param agentId The agent ID
     * @param clientAddress The feedback giver
     * @param feedbackIndex The feedback index
     * @return value The feedback value
     * @return valueDecimals Decimal places
     * @return tag1 Primary tag
     * @return tag2 Secondary tag
     * @return isRevoked Whether the feedback was revoked
     */
    function readFeedback(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex
    )
        external
        view
        returns (
            int128 value,
            uint8 valueDecimals,
            string memory tag1,
            string memory tag2,
            bool isRevoked
        );

    /**
     * @notice Get all clients who have given feedback to an agent
     * @param agentId The agent ID
     * @return Array of client addresses
     */
    function getClients(uint256 agentId) external view returns (address[] memory);

    /**
     * @notice Get the last feedback index for a client-agent pair
     * @param agentId The agent ID
     * @param clientAddress The client address
     * @return The last feedback index
     */
    function getLastIndex(uint256 agentId, address clientAddress) external view returns (uint64);

    /**
     * @notice Get feedback count by tags
     * @param agentId The agent ID
     * @param tag1 Primary tag filter
     * @param tag2 Secondary tag filter
     * @return count Number of matching entries
     */
    function getFeedbackCount(
        uint256 agentId,
        string calldata tag1,
        string calldata tag2
    )
        external
        view
        returns (uint64 count);

    /**
     * @notice Get a paginated summary of an agent's reputation
     * @param agentId The agent ID
     * @param tag1 Filter by primary tag (empty for all)
     * @param tag2 Filter by secondary tag (empty for all)
     * @param startClientIndex Index of the first client to process
     * @param maxClients Maximum number of clients to process in this call
     * @return count Number of matching feedback entries
     * @return summaryValue Sum of feedback values
     * @return summaryValueDecimals Decimal places for the summary value
     * @return processedClients Number of clients actually processed
     * @return hasMore True if more clients remain to be processed
     */
    function getPaginatedSummary(
        uint256 agentId,
        string calldata tag1,
        string calldata tag2,
        uint256 startClientIndex,
        uint256 maxClients
    )
        external
        view
        returns (
            uint64 count,
            int128 summaryValue,
            uint8 summaryValueDecimals,
            uint256 processedClients,
            bool hasMore
        );
}
