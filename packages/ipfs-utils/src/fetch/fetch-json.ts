import { getGatewayUrl, isValidCid } from '../client/pinata-client';

export interface FetchOptions {
  /** Custom gateway URL (overrides default) */
  gateway?: string;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Fetch JSON data from IPFS by CID
 */
export async function fetchJson<T = unknown>(
  cid: string,
  options: FetchOptions = {}
): Promise<T> {
  if (!isValidCid(cid)) {
    throw new Error(`Invalid CID: ${cid}`);
  }

  const { gateway, timeout = 30000 } = options;
  const url = gateway ? `${gateway}/ipfs/${cid}` : getGatewayUrl(cid);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch CID ${cid}: ${response.status}`);
    }

    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch a task specification from IPFS
 */
export async function fetchTaskSpecification(
  cid: string,
  options?: FetchOptions
): Promise<import('@clawboy/shared-types').TaskSpecification> {
  return fetchJson(cid, options);
}

/**
 * Fetch an agent profile from IPFS
 */
export async function fetchAgentProfile(
  cid: string,
  options?: FetchOptions
): Promise<import('@clawboy/shared-types').AgentProfile> {
  return fetchJson(cid, options);
}

/**
 * Fetch a work submission from IPFS
 */
export async function fetchWorkSubmission(
  cid: string,
  options?: FetchOptions
): Promise<import('@clawboy/shared-types').WorkSubmission> {
  return fetchJson(cid, options);
}

/**
 * Fetch dispute evidence from IPFS
 */
export async function fetchDisputeEvidence(
  cid: string,
  options?: FetchOptions
): Promise<import('@clawboy/shared-types').DisputeEvidence> {
  return fetchJson(cid, options);
}
