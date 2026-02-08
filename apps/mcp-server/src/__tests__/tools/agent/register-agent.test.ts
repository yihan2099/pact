import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { z } from 'zod';
import { createIpfsUtilsMock } from '../../helpers/mock-deps';

const ipfsMock = createIpfsUtilsMock();

mock.module('@clawboy/ipfs-utils', () => ipfsMock);

mock.module('../../../utils/webhook-validation', () => ({
  webhookUrlSchema: z.string().url(),
}));

import { registerAgentTool, registerAgentSchema } from '../../../tools/agent/register-agent';

const context = {
  callerAddress: '0xaabbccddaabbccddaabbccddaabbccddaabbccdd' as `0x${string}`,
};

describe('register_agent tool', () => {
  beforeEach(() => {
    ipfsMock.uploadJson.mockReset();
    ipfsMock.uploadJson.mockResolvedValue({ cid: 'QmAgentProfileCid123' });
  });

  test('should have correct tool metadata', () => {
    expect(registerAgentTool.name).toBe('register_agent');
    expect(registerAgentTool.inputSchema.required).toContain('name');
    expect(registerAgentTool.inputSchema.required).toContain('skills');
  });

  test('should upload ERC-8004 profile to IPFS on success', async () => {
    const result = await registerAgentTool.handler(
      { name: 'TestAgent', skills: ['solidity', 'typescript'] },
      context
    );

    expect(ipfsMock.uploadJson).toHaveBeenCalled();
    const uploadedData = (ipfsMock.uploadJson.mock.calls[0] as any[])[0];
    expect(uploadedData.type).toContain('eip-8004');
    expect(uploadedData.name).toBe('TestAgent');
    expect(uploadedData.skills).toEqual(['solidity', 'typescript']);
    expect(uploadedData.active).toBe(true);

    expect(result.agentURI).toBe('ipfs://QmAgentProfileCid123');
    expect(result.profileCid).toBe('QmAgentProfileCid123');
    expect(result.callerAddress).toBe(context.callerAddress);
  });

  test('should include optional fields in profile', async () => {
    const result = await registerAgentTool.handler(
      {
        name: 'TestAgent',
        skills: ['solidity'],
        description: 'A test agent',
        preferredTaskTypes: ['smart-contract-audit'],
        links: { github: 'https://github.com/test' },
      },
      context
    );

    const uploadedData = (ipfsMock.uploadJson.mock.calls[0] as any[])[0];
    expect(uploadedData.description).toBe('A test agent');
    expect(uploadedData.preferredTaskTypes).toEqual(['smart-contract-audit']);
    expect(uploadedData.links.github).toBe('https://github.com/test');
    expect(result.agentURI).toBeDefined();
  });

  test('should include contract function in response', async () => {
    const result = await registerAgentTool.handler({ name: 'TestAgent', skills: ['dev'] }, context);

    expect(result.contractFunction).toBe('register(string agentURI)');
    expect(result.contractArgs.agentURI).toBe('ipfs://QmAgentProfileCid123');
  });

  test('should reject empty name', () => {
    expect(() => registerAgentSchema.parse({ name: '', skills: ['dev'] })).toThrow();
  });

  test('should reject name exceeding 100 characters', () => {
    expect(() => registerAgentSchema.parse({ name: 'x'.repeat(101), skills: ['dev'] })).toThrow();
  });

  test('should reject empty skills array', () => {
    expect(() => registerAgentSchema.parse({ name: 'Agent', skills: [] })).toThrow();
  });

  test('should reject skills array exceeding 20 items', () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => `skill-${i}`);
    expect(() => registerAgentSchema.parse({ name: 'Agent', skills: tooMany })).toThrow();
  });

  test('should propagate IPFS upload error', async () => {
    ipfsMock.uploadJson.mockRejectedValue(new Error('IPFS upload failed'));

    await expect(
      registerAgentTool.handler({ name: 'Agent', skills: ['dev'] }, context)
    ).rejects.toThrow('IPFS upload failed');
  });
});
