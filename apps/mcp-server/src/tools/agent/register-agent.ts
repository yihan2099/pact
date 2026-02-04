import { z } from 'zod';
import { uploadJson } from '@clawboy/ipfs-utils';
import { webhookUrlSchema } from '../../utils/webhook-validation';

/**
 * ERC-8004 compliant agent URI structure
 * @see https://eips.ethereum.org/EIPS/eip-8004#registration-v1
 */
interface ERC8004AgentURI {
  type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1';
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

export const registerAgentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  skills: z.array(z.string()).min(1).max(20),
  preferredTaskTypes: z.array(z.string()).optional(),
  links: z
    .object({
      github: z.string().url().optional(),
      twitter: z.string().url().optional(),
      website: z.string().url().optional(),
    })
    .optional(),
  webhookUrl: webhookUrlSchema.optional(),
});

export type RegisterAgentInput = z.infer<typeof registerAgentSchema>;

export const registerAgentTool = {
  name: 'register_agent',
  description:
    'Register as an agent on Clawboy using ERC-8004 Trustless Agents standard. Creates your agent profile on IPFS and returns the URI for on-chain registration.',
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

    // Create ERC-8004 compliant agent URI structure
    const agentURI: ERC8004AgentURI = {
      type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
      name: input.name,
      description: input.description,
      services: [
        {
          name: 'clawboy-task-agent',
          version: '1.0',
        },
      ],
      active: true,
      registrations: [],
      // Clawboy-specific extensions
      skills: input.skills,
      preferredTaskTypes: input.preferredTaskTypes,
      links: input.links,
      webhookUrl: input.webhookUrl,
    };

    // Upload ERC-8004 agent URI to IPFS
    const uploadResult = await uploadJson(agentURI as unknown as Record<string, unknown>, {
      name: `agent-${context.callerAddress}.json`,
    });

    // Construct the IPFS URI (ipfs://CID format)
    const ipfsURI = `ipfs://${uploadResult.cid}`;

    return {
      message: 'ERC-8004 agent profile created and uploaded to IPFS',
      agentURI: ipfsURI,
      profileCid: uploadResult.cid,
      callerAddress: context.callerAddress,
      nextStep:
        "Call the ClawboyAgentAdapter contract's register(agentURI) function to complete on-chain registration. This will mint an ERC-721 NFT representing your agent identity.",
      contractFunction: 'register(string agentURI)',
      contractArgs: {
        agentURI: ipfsURI,
      },
      note: 'Your agent identity will be an ERC-721 NFT on the ERC-8004 Identity Registry. Reputation is tracked via the ERC-8004 Reputation Registry using feedback tags.',
    };
  },
};
