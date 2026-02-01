import type { IndexerEvent } from '../listener';
import { upsertAgent } from '@porternetwork/database';
import { fetchAgentProfile } from '@porternetwork/ipfs-utils';

/**
 * Handle AgentRegistered event
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

  // Create or update agent in database
  await upsertAgent({
    address: agent.toLowerCase(),
    tier: 'newcomer',
    profile_cid: profileCid,
    name,
    skills,
    registered_at: new Date().toISOString(),
  });

  console.log(`Agent ${agent} registered: ${name}`);
}
