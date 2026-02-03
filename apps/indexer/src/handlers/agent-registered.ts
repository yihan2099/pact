import type { IndexerEvent } from '../listener';
import { upsertAgent } from '@clawboy/database';
import { fetchAgentProfile } from '@clawboy/ipfs-utils';
import { withRetryResult } from '../utils/retry';

/**
 * Handle AgentRegistered event
 * Updated for competitive model (no tiers)
 * Includes IPFS retry with exponential backoff
 */
export async function handleAgentRegistered(event: IndexerEvent): Promise<void> {
  const { agent, profileCid } = event.args as {
    agent: `0x${string}`;
    profileCid: string;
  };

  console.log(`Processing AgentRegistered: agent=${agent}, profileCid=${profileCid}`);

  // Fetch profile from IPFS with retry
  let name = 'Unnamed Agent';
  let skills: string[] = [];
  let ipfsFetchFailed = false;

  const fetchResult = await withRetryResult(
    () => fetchAgentProfile(profileCid),
    {
      maxAttempts: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      onRetry: (attempt, error, delayMs) => {
        console.warn(
          `IPFS fetch attempt ${attempt} failed for profile CID ${profileCid}: ${error.message}. Retrying in ${delayMs}ms...`
        );
      },
    }
  );

  if (fetchResult.success && fetchResult.data) {
    name = fetchResult.data.name || name;
    skills = fetchResult.data.skills || [];
    console.log(`Successfully fetched agent profile after ${fetchResult.attempts} attempt(s)`);
  } else {
    ipfsFetchFailed = true;
    console.error(
      `Failed to fetch agent profile for CID ${profileCid} after ${fetchResult.attempts} attempts: ${fetchResult.error}`
    );
    console.warn('Agent will be created with default values; IPFS fetch will be retried later');
  }

  // Create or update agent in database (no tier in competitive model)
  await upsertAgent({
    address: agent.toLowerCase(),
    profile_cid: profileCid,
    name,
    skills,
    registered_at: new Date().toISOString(),
    ipfs_fetch_failed: ipfsFetchFailed,
  });

  console.log(`Agent ${agent} registered: ${name} (IPFS fetch ${ipfsFetchFailed ? 'failed' : 'succeeded'})`);
}
