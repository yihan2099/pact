import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { z } from 'zod';
import { createIpfsUtilsMock, createWeb3UtilsMock } from '../../helpers/mock-deps';

const ipfsMock = createIpfsUtilsMock();
const web3Mock = createWeb3UtilsMock();

mock.module('@clawboy/ipfs-utils', () => ipfsMock);
mock.module('@clawboy/web3-utils', () => web3Mock);

mock.module('../../../config/chain', () => ({
  getChainId: () => 84532,
}));

mock.module('../../../utils/webhook-validation', () => ({
  webhookUrlSchema: z.string().url(),
}));

import { updateProfileTool } from '../../../tools/agent/update-profile';

const context = {
  callerAddress: '0xaabbccddaabbccddaabbccddaabbccddaabbccdd' as `0x${string}`,
};

describe('update_profile tool', () => {
  beforeEach(() => {
    ipfsMock.uploadJson.mockReset();
    ipfsMock.uploadJson.mockResolvedValue({ cid: 'QmNewProfileCid' });
    ipfsMock.fetchJson.mockReset();
    ipfsMock.fetchJson.mockResolvedValue({
      type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
      name: 'OldAgent',
      description: 'Old description',
      skills: ['solidity'],
      services: [{ name: 'pact-task-agent', version: '1.0' }],
      active: true,
      registrations: [],
    });
    web3Mock.getAgentURI.mockReset();
    web3Mock.getAgentURI.mockResolvedValue('ipfs://QmOldProfileCid' as any);
  });

  test('should merge updated fields into existing profile', async () => {
    const result = await updateProfileTool.handler(
      { name: 'NewAgent', skills: ['typescript', 'react'] },
      context
    );

    const uploaded = (ipfsMock.uploadJson.mock.calls[0] as any[])[0];
    expect(uploaded.name).toBe('NewAgent');
    expect(uploaded.skills).toEqual(['typescript', 'react']);
    expect(uploaded.description).toBe('Old description'); // preserved
    expect(result.newAgentURI).toBe('ipfs://QmNewProfileCid');
    expect(result.previousURI).toBe('ipfs://QmOldProfileCid');
    expect(result.updatedFields).toContain('name');
    expect(result.updatedFields).toContain('skills');
  });

  test('should throw when no fields provided', async () => {
    await expect(updateProfileTool.handler({}, context)).rejects.toThrow(
      'At least one field must be provided'
    );
  });

  test('should throw when no existing profile found', async () => {
    web3Mock.getAgentURI.mockResolvedValue(null as any);

    await expect(updateProfileTool.handler({ name: 'New' }, context)).rejects.toThrow(
      'No existing profile found'
    );
  });

  test('should throw when IPFS fetch fails', async () => {
    ipfsMock.fetchJson.mockRejectedValue(new Error('IPFS timeout'));

    await expect(updateProfileTool.handler({ name: 'New' }, context)).rejects.toThrow(
      'Failed to fetch current profile'
    );
  });

  test('should merge links preserving existing', async () => {
    ipfsMock.fetchJson.mockResolvedValue({
      type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
      name: 'Agent',
      skills: ['dev'],
      services: [],
      active: true,
      registrations: [],
      links: { github: 'https://github.com/old', website: 'https://old.com' },
    });

    await updateProfileTool.handler({ links: { github: 'https://github.com/new' } }, context);

    const uploaded = (ipfsMock.uploadJson.mock.calls[0] as any[])[0];
    expect(uploaded.links.github).toBe('https://github.com/new');
    expect(uploaded.links.website).toBe('https://old.com');
  });

  test('should include contract function in response', async () => {
    const result = await updateProfileTool.handler({ name: 'Updated' }, context);

    expect(result.contractFunction).toBe('updateProfile(string newURI)');
    expect(result.contractArgs.newURI).toBe('ipfs://QmNewProfileCid');
  });

  test('should set webhookUrl to undefined when null', async () => {
    await updateProfileTool.handler({ webhookUrl: null }, context);

    const uploaded = (ipfsMock.uploadJson.mock.calls[0] as any[])[0];
    expect(uploaded.webhookUrl).toBeUndefined();
  });
});
