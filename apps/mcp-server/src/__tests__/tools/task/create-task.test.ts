import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { createContractsMock, createWeb3UtilsMock } from '../../helpers/mock-deps';

const contractsMock = createContractsMock();
const web3Mock = createWeb3UtilsMock();

mock.module('@clawboy/contracts', () => contractsMock);
mock.module('@clawboy/web3-utils', () => web3Mock);

const mockCreateTaskHandler = mock(() =>
  Promise.resolve({
    specificationCid: 'QmTestCid123',
    specification: { title: 'Test', description: 'desc', deliverables: [] },
  })
);

mock.module('../../../services/task-service', () => ({
  createTaskHandler: mockCreateTaskHandler,
}));

mock.module('../../../config/chain', () => ({
  getChainId: () => 84532,
}));

import { createTaskTool, createTaskSchema } from '../../../tools/task/create-task';

const validInput = {
  title: 'Build a widget',
  description: 'Create a widget that does things',
  deliverables: [{ type: 'code', description: 'Source code for the widget' }],
  bountyAmount: '100',
  bountyToken: 'USDC',
};

const context = {
  callerAddress: '0xaabbccddaabbccddaabbccddaabbccddaabbccdd' as `0x${string}`,
};

describe('create_task tool', () => {
  beforeEach(() => {
    contractsMock.resolveToken.mockReset();
    contractsMock.resolveToken.mockReturnValue({
      symbol: 'USDC',
      address: '0xUSDC' as `0x${string}`,
      decimals: 6,
    });
    contractsMock.getSupportedTokens.mockReset();
    contractsMock.getSupportedTokens.mockReturnValue([
      { symbol: 'ETH', address: '0xETH', decimals: 18 },
      { symbol: 'USDC', address: '0xUSDC', decimals: 6 },
    ]);
    contractsMock.isNativeToken.mockReset();
    contractsMock.isNativeToken.mockReturnValue(false);
    web3Mock.hasEnoughAllowance.mockReset();
    web3Mock.hasEnoughAllowance.mockReturnValue(true);
    mockCreateTaskHandler.mockReset();
    mockCreateTaskHandler.mockResolvedValue({
      specificationCid: 'QmTestCid123',
      specification: { title: 'Test', description: 'desc', deliverables: [] },
    });
    web3Mock.parseTokenAmount.mockReset();
    web3Mock.parseTokenAmount.mockReturnValue(100000000n);
  });

  test('should have correct tool metadata', () => {
    expect(createTaskTool.name).toBe('create_task');
    expect(createTaskTool.inputSchema.required).toContain('title');
    expect(createTaskTool.inputSchema.required).toContain('bountyAmount');
  });

  // Schema validation tests
  test('should reject empty title', () => {
    expect(() => createTaskSchema.parse({ ...validInput, title: '' })).toThrow();
  });

  test('should reject title exceeding 200 characters', () => {
    expect(() => createTaskSchema.parse({ ...validInput, title: 'x'.repeat(201) })).toThrow();
  });

  test('should reject bounty amount of 0', () => {
    expect(() => createTaskSchema.parse({ ...validInput, bountyAmount: '0' })).toThrow();
  });

  test('should reject bounty amount exceeding 1,000,000', () => {
    expect(() => createTaskSchema.parse({ ...validInput, bountyAmount: '1000001' })).toThrow();
  });

  test('should reject non-numeric bounty amount', () => {
    expect(() => createTaskSchema.parse({ ...validInput, bountyAmount: 'abc' })).toThrow();
  });

  test('should reject empty deliverables array', () => {
    expect(() => createTaskSchema.parse({ ...validInput, deliverables: [] })).toThrow();
  });

  // Handler tests
  test('should resolve token and upload to IPFS on success', async () => {
    const result = await createTaskTool.handler(validInput, context);

    expect(contractsMock.resolveToken).toHaveBeenCalledWith(84532, 'USDC');
    expect(mockCreateTaskHandler).toHaveBeenCalled();
    expect(result.specificationCid).toBe('QmTestCid123');
    expect(result.bountyToken).toEqual({
      symbol: 'USDC',
      address: '0xUSDC',
      decimals: 6,
    });
    expect(result.bountyAmount).toBe('100');
  });

  test('should throw on unsupported token', async () => {
    contractsMock.resolveToken.mockReturnValue(null as any);

    await expect(createTaskTool.handler(validInput, context)).rejects.toThrow('Unsupported token');
  });

  test('should indicate approval required when allowance insufficient', async () => {
    web3Mock.hasEnoughAllowance.mockReturnValue(false);

    const result = await createTaskTool.handler(validInput, context);

    expect(result.approvalRequired).toBe(true);
    expect(result.approvalStep).toBeDefined();
    expect(result.message).toContain('approval required');
  });

  test('should skip allowance check for native token', async () => {
    contractsMock.isNativeToken.mockReturnValue(true);

    const result = await createTaskTool.handler(validInput, context);

    expect(web3Mock.hasEnoughAllowance).not.toHaveBeenCalled();
    expect(result.approvalRequired).toBeUndefined();
  });

  test('should include contract call details in response', async () => {
    const result = await createTaskTool.handler(validInput, context);

    expect((result as any).contractCall).toBeDefined();
    expect((result as any).contractCall.contract).toBe('0xTaskManager');
    expect((result as any).contractCall.args.specCid).toBe('QmTestCid123');
  });
});
