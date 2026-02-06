import type { IndexerEvent } from '../listener';
import { upsertAgent } from '@clawboy/database';
import { fetchJson } from '@clawboy/ipfs-utils';
import { withRetryResult } from '../utils/retry';
import { invalidateAgentCaches } from '@clawboy/cache';

/**
 * ERC-8004 agent URI structure
 */
interface ERC8004AgentURI {
  type?: string;
  name?: string;
  description?: string;
  services?: Array<{
    name: string;
    endpoint?: string;
    version: string;
  }>;
  active?: boolean;
  registrations?: string[];
  // Clawboy-specific extensions
  skills?: string[];
  preferredTaskTypes?: string[];
  links?: {
    github?: string;
    twitter?: string;
    website?: string;
  };
  webhookUrl?: string;
}

/**
 * Extract CID from an IPFS URI (ipfs://CID format)
 */
function extractCidFromURI(uri: string): string | null {
  if (uri.startsWith('ipfs://')) {
    return uri.slice(7);
  }
  // Also handle direct CID
  if (uri.startsWith('Qm') || uri.startsWith('bafy')) {
    return uri;
  }
  return null;
}

/**
 * Handle AgentRegistered event from ERC-8004 ClawboyAgentAdapter
 * Event: AgentRegistered(address indexed wallet, uint256 indexed agentId, string agentURI)
 */
export async function handleAgentRegistered(event: IndexerEvent): Promise<void> {
  const { wallet, agentId, agentURI } = event.args as {
    wallet: `0x${string}`;
    agentId: bigint;
    agentURI: string;
  };

  console.log(
    `Processing AgentRegistered (ERC-8004): wallet=${wallet}, agentId=${agentId}, agentURI=${agentURI}`
  );

  // Extract CID from IPFS URI
  const profileCid = extractCidFromURI(agentURI) || agentURI;

  // Fetch profile from IPFS with retry
  let name = 'Unnamed Agent';
  let skills: string[] = [];
  let webhookUrl: string | undefined;
  let ipfsFetchFailed = false;

  const fetchResult = await withRetryResult(() => fetchJson<ERC8004AgentURI>(profileCid), {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    onRetry: (attempt, error, delayMs) => {
      console.warn(
        `IPFS fetch attempt ${attempt} failed for agent URI ${agentURI}: ${error.message}. Retrying in ${delayMs}ms...`
      );
    },
  });

  if (fetchResult.success && fetchResult.data) {
    name = fetchResult.data.name || name;
    skills = fetchResult.data.skills || [];
    webhookUrl = fetchResult.data.webhookUrl;
    console.log(
      `Successfully fetched ERC-8004 agent profile after ${fetchResult.attempts} attempt(s)`
    );
  } else {
    ipfsFetchFailed = true;
    console.error(
      `Failed to fetch ERC-8004 agent profile for URI ${agentURI} after ${fetchResult.attempts} attempts: ${fetchResult.error}`
    );
    console.warn('Agent will be created with default values; IPFS fetch will be retried later');
  }

  // Generate a webhook secret if agent has a webhook URL
  let webhookSecret: string | undefined;
  if (webhookUrl) {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    webhookSecret = Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Create or update agent in database with ERC-8004 fields
  await upsertAgent({
    address: wallet.toLowerCase(),
    agent_id: agentId.toString(),
    agent_uri: agentURI,
    profile_cid: profileCid,
    name,
    skills,
    registered_at: new Date().toISOString(),
    ipfs_fetch_failed: ipfsFetchFailed,
    ...(webhookUrl !== undefined && { webhook_url: webhookUrl }),
    ...(webhookSecret !== undefined && { webhook_secret: webhookSecret }),
  });

  // Invalidate agent caches
  await invalidateAgentCaches(wallet.toLowerCase());

  console.log(
    `Agent ${wallet} registered with ERC-8004 ID ${agentId}: ${name} (IPFS fetch ${ipfsFetchFailed ? 'failed' : 'succeeded'})`
  );
}
