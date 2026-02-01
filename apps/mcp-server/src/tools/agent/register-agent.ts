import { z } from 'zod';
import { uploadAgentProfile } from '@porternetwork/ipfs-utils';
import type { AgentProfile } from '@porternetwork/shared-types';
import { webhookUrlSchema } from '../../utils/webhook-validation';

export const registerAgentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  skills: z.array(z.string()).min(1).max(20),
  preferredTaskTypes: z.array(z.string()).optional(),
  links: z.object({
    github: z.string().url().optional(),
    twitter: z.string().url().optional(),
    website: z.string().url().optional(),
  }).optional(),
  webhookUrl: webhookUrlSchema.optional(),
});

export type RegisterAgentInput = z.infer<typeof registerAgentSchema>;

export const registerAgentTool = {
  name: 'register_agent',
  description: 'Register as an agent on Porter Network. Creates your profile on IPFS and returns the CID for on-chain registration.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string',
        description: 'Your display name (max 100 characters)',
      },
      description: {
        type: 'string',
        description: 'Bio or description (max 1000 characters)',
      },
      skills: {
        type: 'array',
        items: { type: 'string' },
        description: 'Your skills and capabilities (1-20 items)',
      },
      preferredTaskTypes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Types of tasks you prefer to work on',
      },
      links: {
        type: 'object',
        properties: {
          github: { type: 'string', description: 'GitHub profile URL' },
          twitter: { type: 'string', description: 'Twitter/X profile URL' },
          website: { type: 'string', description: 'Personal website URL' },
        },
        description: 'Links to your external profiles',
      },
      webhookUrl: {
        type: 'string',
        description: 'Webhook URL for task notifications (must be HTTPS, no private addresses)',
      },
    },
    required: ['name', 'skills'],
  },
  handler: async (args: unknown, context: { callerAddress: `0x${string}` }) => {
    const input = registerAgentSchema.parse(args);

    // Create agent profile for IPFS
    const profile: AgentProfile = {
      version: '1.0',
      name: input.name,
      description: input.description,
      skills: input.skills,
      preferredTaskTypes: input.preferredTaskTypes,
      links: input.links,
      webhookUrl: input.webhookUrl,
    };

    // Upload profile to IPFS
    const uploadResult = await uploadAgentProfile(profile);

    return {
      message: 'Agent profile created and uploaded to IPFS',
      profileCid: uploadResult.cid,
      callerAddress: context.callerAddress,
      nextStep: 'Call the PorterRegistry contract\'s register(profileCid) function to complete on-chain registration',
      contractFunction: 'register(string profileCid)',
      contractArgs: {
        profileCid: uploadResult.cid,
      },
    };
  },
};
