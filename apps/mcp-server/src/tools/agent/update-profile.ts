import { z } from 'zod';
import { uploadAgentProfile, fetchAgentProfile } from '@porternetwork/ipfs-utils';
import { getAgentData } from '@porternetwork/web3-utils';
import type { AgentProfile } from '@porternetwork/shared-types';
import { webhookUrlSchema } from '../../utils/webhook-validation';

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  skills: z.array(z.string()).min(1).max(20).optional(),
  preferredTaskTypes: z.array(z.string()).optional(),
  links: z.object({
    github: z.string().url().optional(),
    twitter: z.string().url().optional(),
    website: z.string().url().optional(),
  }).optional(),
  webhookUrl: webhookUrlSchema.optional().nullable(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updateProfileTool = {
  name: 'update_profile',
  description: 'Update your agent profile. Fetches current profile from IPFS, merges updates, and uploads new profile. Returns the new CID for on-chain update.',
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
        description: 'Webhook URL for notifications (must be HTTPS, no private addresses). Set to null to remove.',
      },
    },
  },
  handler: async (args: unknown, context: { callerAddress: `0x${string}` }) => {
    const input = updateProfileSchema.parse(args);

    // Validate at least one field is being updated
    if (Object.keys(input).length === 0) {
      throw new Error('At least one field must be provided to update');
    }

    // Fetch current profile from IPFS via on-chain CID
    const chainId = parseInt(process.env.CHAIN_ID || '84532', 10);
    const agentData = await getAgentData(context.callerAddress, chainId);

    if (!agentData.profileCid) {
      throw new Error('No existing profile found. Use register_agent instead.');
    }

    // Fetch current profile from IPFS
    let currentProfile: AgentProfile;
    try {
      currentProfile = await fetchAgentProfile(agentData.profileCid);
    } catch (error) {
      throw new Error(`Failed to fetch current profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Merge updates into current profile
    const updatedProfile: AgentProfile = {
      ...currentProfile,
      version: '1.0',
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
    const uploadResult = await uploadAgentProfile(updatedProfile);

    return {
      message: 'Profile updated and uploaded to IPFS',
      previousCid: agentData.profileCid,
      newProfileCid: uploadResult.cid,
      callerAddress: context.callerAddress,
      updatedFields: Object.keys(input),
      nextStep: 'Call the PorterRegistry contract\'s updateProfile(profileCid) function to update on-chain',
      contractFunction: 'updateProfile(string profileCid)',
      contractArgs: {
        profileCid: uploadResult.cid,
      },
    };
  },
};
