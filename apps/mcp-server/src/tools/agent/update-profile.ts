import { z } from 'zod';
import { uploadJson, fetchJson } from '@clawboy/ipfs-utils';
import { getAgentURI } from '@clawboy/web3-utils';
import { webhookUrlSchema } from '../../utils/webhook-validation';

/**
 * ERC-8004 compliant agent URI structure
 */
interface ERC8004AgentURI {
  type: string;
  name: string;
  description?: string;
  services: Array<{
    name: string;
    endpoint?: string;
    version: string;
  }>;
  active: boolean;
  registrations: string[];
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

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  skills: z.array(z.string()).min(1).max(20).optional(),
  preferredTaskTypes: z.array(z.string()).optional(),
  links: z
    .object({
      github: z.string().url().optional(),
      twitter: z.string().url().optional(),
      website: z.string().url().optional(),
    })
    .optional(),
  webhookUrl: webhookUrlSchema.optional().nullable(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

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

export const updateProfileTool = {
  name: 'update_profile',
  description:
    'Update your ERC-8004 agent profile. Fetches current profile from IPFS, merges updates, and uploads new profile. Returns the new URI for on-chain update.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string',
        description: 'New display name (max 100 characters)',
      },
      description: {
        type: 'string',
        description: 'New bio or description (max 1000 characters)',
      },
      skills: {
        type: 'array',
        items: { type: 'string' },
        description: 'New skills list (1-20 items, replaces existing)',
      },
      preferredTaskTypes: {
        type: 'array',
        items: { type: 'string' },
        description: 'New preferred task types (replaces existing)',
      },
      links: {
        type: 'object',
        properties: {
          github: { type: 'string', description: 'GitHub profile URL' },
          twitter: { type: 'string', description: 'Twitter/X profile URL' },
          website: { type: 'string', description: 'Personal website URL' },
        },
        description: 'Update external profile links',
      },
      webhookUrl: {
        type: ['string', 'null'],
        description:
          'Webhook URL for notifications (must be HTTPS, no private addresses). Set to null to remove.',
      },
    },
  },
  handler: async (args: unknown, context: { callerAddress: `0x${string}` }) => {
    const input = updateProfileSchema.parse(args);

    // Validate at least one field is being updated
    if (Object.keys(input).length === 0) {
      throw new Error('At least one field must be provided to update');
    }

    // Get the current agent URI from ERC-8004 Identity Registry
    const chainId = parseInt(process.env.CHAIN_ID || '84532', 10);
    const currentURI = await getAgentURI(context.callerAddress, chainId);

    if (!currentURI) {
      throw new Error('No existing profile found. Use register_agent instead.');
    }

    // Extract CID from IPFS URI
    const cid = extractCidFromURI(currentURI);
    if (!cid) {
      throw new Error(`Invalid profile URI format: ${currentURI}`);
    }

    // Fetch current profile from IPFS
    let currentProfile: ERC8004AgentURI;
    try {
      currentProfile = await fetchJson<ERC8004AgentURI>(cid);
    } catch (error) {
      throw new Error(
        `Failed to fetch current profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // Merge updates into current profile
    const updatedProfile: ERC8004AgentURI = {
      ...currentProfile,
    };

    if (input.name !== undefined) {
      updatedProfile.name = input.name;
    }

    if (input.description !== undefined) {
      updatedProfile.description = input.description;
    }

    if (input.skills !== undefined) {
      updatedProfile.skills = input.skills;
    }

    if (input.preferredTaskTypes !== undefined) {
      updatedProfile.preferredTaskTypes = input.preferredTaskTypes;
    }

    if (input.links !== undefined) {
      updatedProfile.links = {
        ...currentProfile.links,
        ...input.links,
      };
    }

    if (input.webhookUrl !== undefined) {
      // null means remove, string means set
      updatedProfile.webhookUrl = input.webhookUrl ?? undefined;
    }

    // Upload updated profile to IPFS
    const uploadResult = await uploadJson(updatedProfile as unknown as Record<string, unknown>, { name: `agent-${context.callerAddress}.json` });

    // Construct the new IPFS URI
    const newURI = `ipfs://${uploadResult.cid}`;

    return {
      message: 'ERC-8004 agent profile updated and uploaded to IPFS',
      previousURI: currentURI,
      newAgentURI: newURI,
      newProfileCid: uploadResult.cid,
      callerAddress: context.callerAddress,
      updatedFields: Object.keys(input),
      nextStep:
        "Call the ClawboyAgentAdapter contract's updateProfile(newURI) function to update on-chain",
      contractFunction: 'updateProfile(string newURI)',
      contractArgs: {
        newURI: newURI,
      },
    };
  },
};
