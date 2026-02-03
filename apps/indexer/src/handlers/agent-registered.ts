import type { IndexerEvent } from '../listener';
import { upsertAgent } from '@clawboy/database';
import { fetchAgentProfile } from '@clawboy/ipfs-utils';

/**
 * Handle AgentRegistered event
 * Updated for competitive model (no tiers)
 */
export async function handleAgentRegistered(event: IndexerEvent): Promise<void> {
  const { agent, profileCid } = event.args as {
    agent: `0x${string}`;
    profileCid: string;
  };

  console.log(`Processing AgentRegistered: agent=${agent}, profileCid=${profileCid}`);

  // Fetch profile from IPFS
  let name = 'Unnamed Agent';
  let skills: string[] = [];

  try {
    const profile = await fetchAgentProfile(profileCid);
    name = profile.name || name;
    skills = profile.skills || [];
  } catch (error) {
    console.warn(`Failed to fetch agent profile for CID ${profileCid}:`, error);
  }

  // Create or update agent in database (no tier in competitive model)
  await upsertAgent({
    address: agent.toLowerCase(),
    profile_cid: profileCid,
    name,
    skills,
    registered_at: new Date().toISOString(),
  });

  console.log(`Agent ${agent} registered: ${name}`);
}
