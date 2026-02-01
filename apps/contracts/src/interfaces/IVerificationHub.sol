// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IVerificationHub
 * @notice Interface for the VerificationHub contract
 */
interface IVerificationHub {
    enum VerdictOutcome {
        Approved,
        Rejected,
        RevisionRequested,
        Escalated
    }

    struct Verdict {
        address verifier;
        VerdictOutcome outcome;
        uint8 score;
        string feedbackCid;
        uint256 timestamp;
    }

    event VerificationRequested(uint256 indexed taskId, string submissionCid);

    event VerdictSubmitted(
        uint256 indexed taskId,
        address indexed verifier,
        VerdictOutcome outcome,
        uint8 score,
        string feedbackCid
    );

    event DisputeRaised(uint256 indexed taskId, address indexed disputer, string reason);

    event DisputeResolved(uint256 indexed taskId, VerdictOutcome outcome);

    function submitVerdict(
        uint256 taskId,
        VerdictOutcome outcome,
        uint8 score,
        string calldata feedbackCid
    ) external;

    function raiseDispute(uint256 taskId, string calldata reason) external;

    function getVerdict(uint256 taskId) external view returns (Verdict memory);

    function isVerifier(address account) external view returns (bool);

    function pendingVerifications() external view returns (uint256[] memory);

    function addPending(uint256 taskId) external;
}
