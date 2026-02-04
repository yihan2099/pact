import { z } from 'zod';
import { createTaskHandler } from '../../services/task-service';
import {
  getContractAddresses,
  resolveToken,
  getSupportedTokens,
  isNativeToken,
} from '@clawboy/contracts';
import { getPublicClient, parseTokenAmount, hasEnoughAllowance } from '@clawboy/web3-utils';

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(50000), // SECURITY: Limit description length
  deliverables: z
    .array(
      z.object({
        type: z.enum(['code', 'document', 'data', 'file', 'other']),
        description: z.string().min(1).max(2000), // SECURITY: Limit deliverable description
        format: z.string().max(100).optional(),
      })
    )
    .min(1)
    .max(20), // SECURITY: Limit number of deliverables
  // SECURITY: Validate bounty is a positive number (greater than 0)
  bountyAmount: z
    .string()
    .regex(/^\d+\.?\d*$/, 'Bounty must be a valid number')
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }, 'Bounty amount must be greater than 0'),
  bountyToken: z.string().optional().default('ETH'),
  deadline: z.string().datetime().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(), // SECURITY: Limit tags
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const createTaskTool = {
  name: 'create_task',
  description:
    'Create a new task with a bounty. Supports ETH and stablecoins (USDC, USDT, DAI). Returns specification CID for on-chain creation.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      title: {
        type: 'string',
        description: 'Task title (max 200 characters)',
      },
      description: {
        type: 'string',
        description: 'Detailed task description',
      },
      deliverables: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['code', 'document', 'data', 'file', 'other'],
            },
            description: { type: 'string' },
            format: { type: 'string' },
          },
          required: ['type', 'description'],
        },
        description: 'Expected deliverables',
      },
      bountyAmount: {
        type: 'string',
        description: 'Bounty amount in token units (e.g., "100" for 100 USDC, "0.1" for 0.1 ETH)',
      },
      bountyToken: {
        type: 'string',
        description:
          'Token for bounty. Use symbol ("USDC", "ETH", "DAI", "USDT") or address. Defaults to "ETH"',
      },
      deadline: {
        type: 'string',
        description: 'Optional deadline (ISO 8601 format)',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags for categorization',
      },
    },
    required: ['title', 'description', 'deliverables', 'bountyAmount'],
  },
  handler: async (args: unknown, context: { callerAddress: `0x${string}` }) => {
    const input = createTaskSchema.parse(args);
    const chainId = parseInt(process.env.CHAIN_ID || '84532', 10);

    // Resolve token
    const tokenConfig = resolveToken(chainId, input.bountyToken);
    if (!tokenConfig) {
      const supportedTokens = getSupportedTokens(chainId);
      const symbolList = supportedTokens.map((t) => t.symbol).join(', ');
      throw new Error(
        `Unsupported token: "${input.bountyToken}". Supported tokens on this chain: ${symbolList}`
      );
    }

    // Parse amount using token's decimals
    const bountyAmountWei = parseTokenAmount(input.bountyAmount, tokenConfig.decimals);

    // Get contract addresses
    const addresses = getContractAddresses(chainId);

    // For ERC20 tokens, check allowance
    let requiresApproval = false;
    let currentAllowance: bigint | undefined;
    if (!isNativeToken(tokenConfig.address)) {
      const publicClient = getPublicClient(chainId);
      const hasAllowance = await hasEnoughAllowance(
        publicClient,
        tokenConfig.address,
        context.callerAddress,
        addresses.escrowVault,
        bountyAmountWei
      );
      requiresApproval = !hasAllowance;

      if (requiresApproval) {
        // Import here to avoid circular deps
        const { getTokenAllowance } = await import('@clawboy/web3-utils');
        currentAllowance = await getTokenAllowance(
          publicClient,
          tokenConfig.address,
          context.callerAddress,
          addresses.escrowVault
        );
      }
    }

    // Create task specification and upload to IPFS
    const result = await createTaskHandler(input, context.callerAddress);

    // Build response
    const response: Record<string, unknown> = {
      message: requiresApproval
        ? 'Task specification created. Token approval required before creating task on-chain.'
        : 'Task specification created and uploaded to IPFS',
      specificationCid: result.specificationCid,
      bountyToken: {
        symbol: tokenConfig.symbol,
        address: tokenConfig.address,
        decimals: tokenConfig.decimals,
      },
      bountyAmount: input.bountyAmount,
      bountyAmountWei: bountyAmountWei.toString(),
    };

    if (requiresApproval) {
      response.approvalRequired = true;
      response.currentAllowance = currentAllowance?.toString() ?? '0';
      response.approvalStep = {
        description: `Approve EscrowVault to spend ${input.bountyAmount} ${tokenConfig.symbol}`,
        contract: tokenConfig.address,
        function: 'approve(address spender, uint256 amount)',
        args: {
          spender: addresses.escrowVault,
          amount: bountyAmountWei.toString(),
        },
      };
      response.nextStep =
        'First approve the token, then call TaskManager.createTask with the CID and bounty details';
    } else {
      response.nextStep = 'Call the TaskManager contract to create the task on-chain with this CID';
    }

    // Add contract call details
    response.contractCall = {
      contract: addresses.taskManager,
      function: 'createTask(string specCid, uint256 bountyAmount, address bountyToken)',
      args: {
        specCid: result.specificationCid,
        bountyAmount: bountyAmountWei.toString(),
        bountyToken: tokenConfig.address,
      },
      value: isNativeToken(tokenConfig.address) ? bountyAmountWei.toString() : '0',
    };

    return response;
  },
};
