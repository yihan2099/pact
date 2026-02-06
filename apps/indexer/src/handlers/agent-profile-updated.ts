import type { IndexerEvent } from '../listener';
import { updateAgent, getAgentByAddress } from '@clawboy/database';
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
 * Handle AgentProfileUpdated event from ERC-8004 ClawboyAgentAdapter
 * Event: AgentProfileUpdated(address indexed wallet, uint256 indexed agentId, string newURI)
 */
export async function handleAgentProfileUpdated(event: IndexerEvent): Promise<void> {
  const { wallet, agentId, newURI } = event.args as {
    wallet: `0x${string}`;
    agentId: bigint;
    newURI: string;
  };

  console.log(
    `Processing AgentProfileUpdated (ERC-8004): wallet=${wallet}, agentId=${agentId}, newURI=${newURI}`
  );

  // Extract CID from IPFS URI
  const profileCid = extractCidFromURI(newURI) || newURI;

  // Fetch updated profile from IPFS with retry
  let name: string | undefined;
  let skills: string[] | undefined;
  let webhookUrl: string | null | undefined;
  let ipfsFetchFailed = false;

  const fetchResult = await withRetryResult(() => fetchJson<ERC8004AgentURI>(profileCid), {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    onRetry: (attempt, error, delayMs) => {
      console.warn(
        `IPFS fetch attempt ${attempt} failed for agent URI ${newURI}: ${error.message}. Retrying in ${delayMs}ms...`
      );
    },
  });

  if (fetchResult.success && fetchResult.data) {
    name = fetchResult.data.name;
    skills = fetchResult.data.skills;
    // Track webhook URL changes: undefined means no change, null means removed, string means set
    webhookUrl = fetchResult.data.webhookUrl ?? null;
    console.log(
      `Successfully fetched updated ERC-8004 agent profile after ${fetchResult.attempts} attempt(s)`
    );
  } else {
    ipfsFetchFailed = true;
    console.error(
      `Failed to fetch updated ERC-8004 agent profile for URI ${newURI} after ${fetchResult.attempts} attempts: ${fetchResult.error}`
    );
    console.warn('Agent will be updated with new URI; IPFS fetch will be retried later');
  }

  // Build webhook update fields
  const webhookUpdates: Record<string, string | null> = {};
  if (webhookUrl !== undefined) {
    webhookUpdates.webhook_url = webhookUrl;
    if (webhookUrl) {
      // Generate new webhook secret when URL is set/changed
      const existingAgent = await getAgentByAddress(wallet.toLowerCase());
      if (!existingAgent?.webhook_secret) {
        const randomBytes = new Uint8Array(32);
        crypto.getRandomValues(randomBytes);
        webhookUpdates.webhook_secret = Array.from(randomBytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      }
    } else {
      // Clear secret when URL is removed
      webhookUpdates.webhook_secret = null;
    }
  }

  // Update agent in database with new ERC-8004 fields
  await updateAgent(wallet.toLowerCase(), {
    agent_uri: newURI,
    profile_cid: profileCid,
    ...(name && { name }),
    ...(skills && { skills }),
    ipfs_fetch_failed: ipfsFetchFailed,
    ...webhookUpdates,
  });

  // Invalidate agent caches
  await invalidateAgentCaches(wallet.toLowerCase());

  console.log(
    `Agent ${wallet} profile updated to ${newURI} (IPFS fetch ${ipfsFetchFailed ? 'failed' : 'succeeded'})`
  );
}
