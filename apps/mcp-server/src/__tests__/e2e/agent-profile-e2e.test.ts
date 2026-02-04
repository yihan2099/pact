/**
 * End-to-End Agent Profile Tests
 *
 * Tests agent profile updates via the update_profile MCP tool:
 * 1. Update profile name after registration
 * 2. Update skills (replaces array)
 * 3. Add webhook URL with HTTPS validation
 * 4. Reject non-HTTPS webhook URL
 * 5. Remove webhook URL with null
 * 6. Empty update rejected
 * 7. Unregistered agent cannot update
 *
 * Prerequisites:
 * - Funded wallet on Base Sepolia
 * - MCP server running (bun run dev:mcp)
 * - Indexer running (bun run dev:indexer)
 *
 * Environment Variables:
 * - E2E_AGENT_PRIVATE_KEY: Private key for agent wallet
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { generatePrivateKey } from 'viem/accounts';
import {
  createTestWallet,
  authenticateWallet,
  checkAgentRegistered,
  registerAgentOnChain,
  updateProfileOnChain,
  getAgentProfileCid,
  resetClients,
  sleep,
  type TestWallet,
} from './test-utils';
import { fetchAgentProfile } from '@clawboy/ipfs-utils';

// MCP Tool handlers
import { registerAgentTool } from '../../tools/agent/register-agent';
import { updateProfileTool } from '../../tools/agent/update-profile';

// Test configuration
const TEST_TIMEOUT = 60000;

// Environment variables
const AGENT_PRIVATE_KEY = process.env.E2E_AGENT_PRIVATE_KEY as `0x${string}` | undefined;

const shouldSkipTests = !AGENT_PRIVATE_KEY || !AGENT_PRIVATE_KEY.startsWith('0x');

describe.skipIf(shouldSkipTests)('E2E: Agent Profile on Base Sepolia', () => {
  let agentWallet: TestWallet;
  let agentSessionId: string;
  let originalProfileCid: string;

  beforeAll(async () => {
    console.log('\n========================================');
    console.log('E2E Agent Profile Test - Base Sepolia');
    console.log('========================================\n');

    resetClients();

    agentWallet = createTestWallet(AGENT_PRIVATE_KEY!);
    console.log(`Agent wallet: ${agentWallet.address}`);

    // Authenticate
    const auth = await authenticateWallet(agentWallet);
    agentSessionId = auth.sessionId;
    console.log(`Agent session: ${agentSessionId.substring(0, 8)}...`);

    // Ensure agent is registered
    const isRegistered = await checkAgentRegistered(agentWallet.address);
    console.log(`Agent registered: ${isRegistered}`);

    if (!isRegistered) {
      console.log('Registering agent for profile tests...');
      const profileResult = await registerAgentTool.handler(
        {
          name: 'E2E Profile Test Agent',
          description: 'Test agent for profile update tests',
          skills: ['python', 'javascript'],
          preferredTaskTypes: ['code', 'document'],
        },
        { callerAddress: agentWallet.address }
      );
      await registerAgentOnChain(agentWallet, profileResult.agentURI);
      originalProfileCid = profileResult.agentURI;
      await sleep(3000);
    } else {
      // Get existing profile CID and check if it's accessible
      const cid = await getAgentProfileCid(agentWallet.address);
      console.log(`Existing profile CID: ${cid}`);

      // Re-upload profile to current Pinata account to ensure it's accessible
      // Add timestamp to ensure unique CID (IPFS is content-addressed)
      console.log('Re-uploading profile to ensure accessibility...');
      const { uploadAgentProfile } = await import('@clawboy/ipfs-utils');
      const newProfile = {
        version: '1.0' as const,
        name: 'E2E Profile Test Agent',
        description: `Test agent for profile update tests (setup: ${Date.now()})`,
        skills: ['python', 'javascript'],
        preferredTaskTypes: ['code', 'document'],
      };
      const uploadResult = await uploadAgentProfile(newProfile);
      const newProfileURI = `ipfs://${uploadResult.cid}`;
      originalProfileCid = newProfileURI;
      console.log(`New profile URI: ${originalProfileCid}`);

      // Update on-chain to point to new URI
      console.log('Updating on-chain profile reference...');
      await updateProfileOnChain(agentWallet, newProfileURI);
      await sleep(3000);
    }

    console.log(`Original profile CID: ${originalProfileCid}`);
    console.log('');
  }, TEST_TIMEOUT);

  test(
    'Test 1: Update profile name after registration',
    async () => {
      console.log('\n--- Test 1: Update profile name after registration ---\n');

      const newName = `Updated Agent ${Date.now()}`;

      const result = await updateProfileTool.handler(
        { name: newName },
        { callerAddress: agentWallet.address }
      );

      console.log(`Previous URI: ${result.previousURI}`);
      console.log(`New profile CID: ${result.newProfileCid}`);
      console.log(`Updated fields: ${result.updatedFields.join(', ')}`);

      // URIs should be different
      expect(result.previousURI).toBeDefined();
      expect(result.newProfileCid).toBeDefined();
      expect(result.previousURI).not.toBe(result.newAgentURI);

      // Updated fields should include name
      expect(result.updatedFields).toContain('name');

      // Update on-chain
      console.log('Updating profile on-chain...');
      const txHash = await updateProfileOnChain(agentWallet, result.newAgentURI);
      console.log(`Update tx: ${txHash}`);

      await sleep(3000);

      // Verify new profile from IPFS
      const newProfile = await fetchAgentProfile(result.newProfileCid);
      console.log(`New profile name: ${newProfile.name}`);

      expect(newProfile.name).toBe(newName);

      // Other fields should be unchanged (skills, description)
      expect(newProfile.skills).toBeDefined();

      console.log('Profile name updated successfully');
    },
    TEST_TIMEOUT
  );

  test(
    'Test 2: Update skills replaces array',
    async () => {
      console.log('\n--- Test 2: Update skills replaces array ---\n');

      const newSkills = ['rust', 'solidity', 'typescript'];

      const result = await updateProfileTool.handler(
        { skills: newSkills },
        { callerAddress: agentWallet.address }
      );

      console.log(`New profile CID: ${result.newProfileCid}`);
      console.log(`Updated fields: ${result.updatedFields.join(', ')}`);

      expect(result.updatedFields).toContain('skills');

      // Update on-chain
      const txHash = await updateProfileOnChain(agentWallet, result.newAgentURI);
      console.log(`Update tx: ${txHash}`);

      await sleep(3000);

      // Verify new profile from IPFS
      const newProfile = await fetchAgentProfile(result.newProfileCid);
      console.log(`New skills: ${newProfile.skills?.join(', ')}`);

      // Skills should be completely replaced, not merged
      expect(newProfile.skills).toEqual(newSkills);

      console.log('Skills array replaced successfully');
    },
    TEST_TIMEOUT
  );

  test(
    'Test 3: Add webhook URL with HTTPS validation',
    async () => {
      console.log('\n--- Test 3: Add webhook URL with HTTPS validation ---\n');

      const webhookUrl = 'https://myagent.example.com/webhook';

      const result = await updateProfileTool.handler(
        { webhookUrl },
        { callerAddress: agentWallet.address }
      );

      console.log(`New profile CID: ${result.newProfileCid}`);
      console.log(`Updated fields: ${result.updatedFields.join(', ')}`);

      expect(result.updatedFields).toContain('webhookUrl');

      // Update on-chain
      const txHash = await updateProfileOnChain(agentWallet, result.newAgentURI);
      console.log(`Update tx: ${txHash}`);

      await sleep(3000);

      // Verify new profile from IPFS
      const newProfile = await fetchAgentProfile(result.newProfileCid);
      console.log(`Webhook URL: ${newProfile.webhookUrl}`);

      expect(newProfile.webhookUrl).toBe(webhookUrl);

      console.log('Webhook URL added successfully');
    },
    TEST_TIMEOUT
  );

  test('Test 4: Reject non-HTTPS webhook URL', async () => {
    console.log('\n--- Test 4: Reject non-HTTPS webhook URL ---\n');

    try {
      await updateProfileTool.handler(
        { webhookUrl: 'http://insecure.example.com/webhook' },
        { callerAddress: agentWallet.address }
      );
      expect(true).toBe(false); // Should not reach here
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`Expected error: ${errorMessage}`);
      expect(
        errorMessage.toLowerCase().includes('https') ||
          errorMessage.toLowerCase().includes('secure') ||
          errorMessage.toLowerCase().includes('private')
      ).toBe(true);
    }

    console.log('Non-HTTPS webhook URL correctly rejected');
  });

  test(
    'Test 5: Remove webhook URL with null',
    async () => {
      console.log('\n--- Test 5: Remove webhook URL with null ---\n');

      // First ensure there's a webhook URL
      const addResult = await updateProfileTool.handler(
        { webhookUrl: 'https://temp.example.com/webhook' },
        { callerAddress: agentWallet.address }
      );
      await updateProfileOnChain(agentWallet, addResult.newAgentURI);
      await sleep(3000);

      // Now remove it
      const result = await updateProfileTool.handler(
        { webhookUrl: null },
        { callerAddress: agentWallet.address }
      );

      console.log(`New profile CID: ${result.newProfileCid}`);
      console.log(`Updated fields: ${result.updatedFields.join(', ')}`);

      expect(result.updatedFields).toContain('webhookUrl');

      // Update on-chain
      const txHash = await updateProfileOnChain(agentWallet, result.newAgentURI);
      console.log(`Update tx: ${txHash}`);

      await sleep(3000);

      // Verify new profile from IPFS
      const newProfile = await fetchAgentProfile(result.newProfileCid);
      console.log(`Webhook URL: ${newProfile.webhookUrl ?? 'undefined'}`);

      expect(newProfile.webhookUrl).toBeUndefined();

      console.log('Webhook URL removed successfully');
    },
    TEST_TIMEOUT
  );

  test('Test 6: Empty update rejected', async () => {
    console.log('\n--- Test 6: Empty update rejected ---\n');

    try {
      await updateProfileTool.handler({}, { callerAddress: agentWallet.address });
      expect(true).toBe(false); // Should not reach here
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`Expected error: ${errorMessage}`);
      expect(errorMessage).toContain('At least one field must be provided');
    }

    console.log('Empty update correctly rejected');
  });

  test('Test 7: Unregistered agent cannot update', async () => {
    console.log('\n--- Test 7: Unregistered agent cannot update ---\n');

    // Create a new wallet that's not registered
    const newPrivateKey = generatePrivateKey();
    const unregisteredWallet = createTestWallet(newPrivateKey);
    console.log(`Unregistered wallet: ${unregisteredWallet.address}`);

    try {
      await updateProfileTool.handler(
        { name: 'Test Name' },
        { callerAddress: unregisteredWallet.address }
      );
      expect(true).toBe(false); // Should not reach here
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`Expected error: ${errorMessage}`);
      expect(
        errorMessage.includes('No existing profile found') ||
          errorMessage.includes('not found') ||
          errorMessage.includes('not registered')
      ).toBe(true);
    }

    console.log('Unregistered agent correctly denied update');
  });

  test('Final summary', async () => {
    console.log('\n========================================');
    console.log('Agent Profile Tests Complete!');
    console.log('========================================\n');
  });
});

// Export for manual testing
export async function runAgentProfileTest(): Promise<void> {
  console.log('Run this test with:');
  console.log('E2E_AGENT_PRIVATE_KEY="0x..." \\');
  console.log('bun test src/__tests__/e2e/agent-profile-e2e.test.ts');
}
