import { getPinataClient } from '../client/pinata-client';

export interface UploadJsonOptions {
  /** Metadata name for the file */
  name?: string;
  /** Key-value metadata */
  keyvalues?: Record<string, string>;
  /** Timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
}

export interface UploadResult {
  /** IPFS CID */
  cid: string;
  /** Size in bytes */
  size: number;
  /** Timestamp */
  timestamp: string;
}

/**
 * Custom error class for IPFS upload failures
 */
export class IpfsUploadError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'IpfsUploadError';
  }
}

/**
 * Upload JSON data to IPFS via Pinata with error handling
 */
export async function uploadJson(
  data: Record<string, unknown>,
  options: UploadJsonOptions = {}
): Promise<UploadResult> {
  const { timeoutMs = 30000, ...pinataOptions } = options;

  try {
    const pinata = getPinataClient();

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const upload = await pinata.upload.json(data, {
        metadata: {
          name: pinataOptions.name || 'clawboy-data.json',
          keyvalues: pinataOptions.keyvalues,
        },
      });

      clearTimeout(timeoutId);

      return {
        cid: upload.cid,
        size: upload.size,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      clearTimeout(timeoutId);

      // Check if timeout
      if (controller.signal.aborted) {
        throw new IpfsUploadError(`IPFS upload timed out after ${timeoutMs}ms`);
      }

      throw error;
    }
  } catch (error) {
    // Already an IpfsUploadError
    if (error instanceof IpfsUploadError) {
      throw error;
    }

    // Wrap other errors
    const message = error instanceof Error ? error.message : String(error);
    throw new IpfsUploadError(
      `Failed to upload JSON to IPFS: ${message}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Upload a task specification to IPFS
 */
export async function uploadTaskSpecification(
  specification: import('@clawboy/shared-types').TaskSpecification
): Promise<UploadResult> {
  return uploadJson(specification as unknown as Record<string, unknown>, {
    name: `task-spec-${Date.now()}.json`,
    keyvalues: {
      type: 'task-specification',
      version: specification.version,
    },
  });
}

/**
 * Upload an agent profile to IPFS
 */
export async function uploadAgentProfile(
  profile: import('@clawboy/shared-types').AgentProfile
): Promise<UploadResult> {
  return uploadJson(profile as unknown as Record<string, unknown>, {
    name: `agent-profile-${Date.now()}.json`,
    keyvalues: {
      type: 'agent-profile',
      version: profile.version,
    },
  });
}

/**
 * Upload a work submission to IPFS
 */
export async function uploadWorkSubmission(
  submission: import('@clawboy/shared-types').WorkSubmission
): Promise<UploadResult> {
  return uploadJson(submission as unknown as Record<string, unknown>, {
    name: `work-submission-${submission.taskId}-${Date.now()}.json`,
    keyvalues: {
      type: 'work-submission',
      version: submission.version,
      taskId: submission.taskId,
    },
  });
}

/**
 * Upload dispute evidence to IPFS
 */
export async function uploadDisputeEvidence(
  evidence: import('@clawboy/shared-types').DisputeEvidence
): Promise<UploadResult> {
  return uploadJson(evidence as unknown as Record<string, unknown>, {
    name: `dispute-evidence-${evidence.taskId}-${Date.now()}.json`,
    keyvalues: {
      type: 'dispute-evidence',
      version: evidence.version,
      taskId: evidence.taskId,
    },
  });
}
