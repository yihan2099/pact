import { getPinataClient } from '../client/pinata-client';

export interface UploadJsonOptions {
  /** Metadata name for the file */
  name?: string;
  /** Key-value metadata */
  keyvalues?: Record<string, string>;
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
 * Upload JSON data to IPFS via Pinata
 */
export async function uploadJson(
  data: Record<string, unknown>,
  options: UploadJsonOptions = {}
): Promise<UploadResult> {
  const pinata = getPinataClient();

  const upload = await pinata.upload.json(data, {
    metadata: {
      name: options.name || 'clawboy-data.json',
      keyvalues: options.keyvalues,
    },
  });

  return {
    cid: upload.cid,
    size: upload.size,
    timestamp: new Date().toISOString(),
  };
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
