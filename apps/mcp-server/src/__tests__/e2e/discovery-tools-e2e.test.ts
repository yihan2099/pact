/**
 * End-to-End Discovery Tools Test
 *
 * Tests the discovery tools (get_capabilities, get_workflow_guide) and MCP resources:
 * 1. get_capabilities at various auth levels (public, authenticated, registered)
 * 2. get_workflow_guide for all roles (agent, creator, voter)
 * 3. MCP resource listing and reading
 *
 * Prerequisites:
 * - Two funded wallets on Base Sepolia
 * - MCP server running (bun run dev:mcp)
 * - Indexer running (bun run dev:indexer)
 *
 * Environment Variables:
 * - E2E_CREATOR_PRIVATE_KEY: Private key for task creator wallet
 * - E2E_AGENT_PRIVATE_KEY: Private key for agent wallet
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import {
  createTestWallet,
  authenticateWallet,
  checkAgentRegistered,
  registerAgentOnChain,
  resetClients,
  type TestWallet,
} from './test-utils';

// MCP Tool handlers
import { registerAgentTool } from '../../tools/agent/register-agent';
import { getCapabilitiesHandler } from '../../tools/discovery/get-capabilities';
import { getWorkflowGuideHandler } from '../../tools/discovery/get-workflow-guide';
import { allResources, getResourceContent, resourceExists } from '../../resources';
import type { ServerContext } from '../../server';

// Test configuration
const TEST_TIMEOUT = 60000;

// Environment variables
const CREATOR_PRIVATE_KEY = process.env.E2E_CREATOR_PRIVATE_KEY as `0x${string}` | undefined;
const AGENT_PRIVATE_KEY = process.env.E2E_AGENT_PRIVATE_KEY as `0x${string}` | undefined;

const shouldSkipTests =
  !CREATOR_PRIVATE_KEY ||
  !AGENT_PRIVATE_KEY ||
  !CREATOR_PRIVATE_KEY.startsWith('0x') ||
  !AGENT_PRIVATE_KEY.startsWith('0x');

/**
 * Create a public (unauthenticated) context
 */
function createPublicContext(): ServerContext {
  return {
    callerAddress: '0x0000000000000000000000000000000000000000',
    isAuthenticated: false,
    isRegistered: false,
    sessionId: null,
  };
}

/**
 * Create an authenticated (but not registered) context
 */
function createAuthenticatedContext(address: `0x${string}`, sessionId: string): ServerContext {
  return {
    callerAddress: address,
    isAuthenticated: true,
    isRegistered: false,
    sessionId,
  };
}

/**
 * Create a fully registered context
 */
function createRegisteredContext(address: `0x${string}`, sessionId: string): ServerContext {
  return {
    callerAddress: address,
    isAuthenticated: true,
    isRegistered: true,
    sessionId,
  };
}

describe.skipIf(shouldSkipTests)('E2E: Discovery Tools on Base Sepolia', () => {
  let agentWallet: TestWallet;
  let agentSessionId: string;
  let agentIsRegistered: boolean;

  beforeAll(async () => {
    console.log('\n========================================');
    console.log('E2E Discovery Tools Test - Base Sepolia');
    console.log('========================================\n');

    resetClients();

    // Create wallet
    agentWallet = createTestWallet(AGENT_PRIVATE_KEY!);
    console.log(`Agent wallet: ${agentWallet.address}`);

    // Authenticate
    const auth = await authenticateWallet(agentWallet);
    agentSessionId = auth.sessionId;
    agentIsRegistered = auth.isRegistered;
    console.log(`Agent session: ${agentSessionId.substring(0, 8)}...`);
    console.log(`Agent registered: ${agentIsRegistered}`);
    console.log('');
  });

  describe('get_capabilities', () => {
    test('Test 1: Unauthenticated capabilities check', async () => {
      console.log('\n--- Test 1: Unauthenticated capabilities check ---\n');

      const context = createPublicContext();
      const result = await getCapabilitiesHandler({}, context);

      console.log(`Access level: ${result.currentAccess.level}`);
      console.log(`Tools count: ${result.tools.length}`);

      // Check access level
      expect(result.currentAccess.level).toBe('public');

      // Check public tools are available
      const listTasks = result.tools.find((t) => t.name === 'list_tasks');
      const getTask = result.tools.find((t) => t.name === 'get_task');
      const authChallenge = result.tools.find((t) => t.name === 'auth_get_challenge');

      expect(listTasks?.available).toBe(true);
      expect(getTask?.available).toBe(true);
      expect(authChallenge?.available).toBe(true);

      // Check protected tools are NOT available
      const submitWork = result.tools.find((t) => t.name === 'submit_work');
      const createTask = result.tools.find((t) => t.name === 'create_task');

      expect(submitWork?.available).toBe(false);
      expect(createTask?.available).toBe(false);

      // Check nextSteps mentions authentication
      const hasAuthStep = result.nextSteps.some((step) =>
        step.toLowerCase().includes('auth_get_challenge')
      );
      expect(hasAuthStep).toBe(true);

      console.log('Public tools available, protected tools unavailable');
    });

    test('Test 2: Authenticated (not registered) capabilities check', async () => {
      console.log('\n--- Test 2: Authenticated (not registered) capabilities check ---\n');

      // Use authenticated but not registered context
      const context = createAuthenticatedContext(agentWallet.address, agentSessionId);
      const result = await getCapabilitiesHandler({}, context);

      console.log(`Access level: ${result.currentAccess.level}`);
      console.log(`Wallet address: ${result.currentAccess.walletAddress}`);

      // Check access level
      expect(result.currentAccess.level).toBe('authenticated');
      expect(result.currentAccess.walletAddress?.toLowerCase()).toBe(
        agentWallet.address.toLowerCase()
      );

      // Check register_agent is available
      const registerAgent = result.tools.find((t) => t.name === 'register_agent');
      expect(registerAgent?.available).toBe(true);

      // Check submit_work is NOT available (requires registration)
      const submitWork = result.tools.find((t) => t.name === 'submit_work');
      expect(submitWork?.available).toBe(false);
      expect(submitWork?.reason).toContain('registration');

      // Check nextSteps mentions registration
      const hasRegisterStep = result.nextSteps.some((step) =>
        step.toLowerCase().includes('register_agent')
      );
      expect(hasRegisterStep).toBe(true);

      console.log('Authenticated: register_agent available, submit_work requires registration');
    });

    test(
      'Test 3: Fully registered capabilities check',
      async () => {
        console.log('\n--- Test 3: Fully registered capabilities check ---\n');

        // Ensure agent is registered
        const isRegistered = await checkAgentRegistered(agentWallet.address);
        if (!isRegistered) {
          console.log('Registering agent first...');
          const profileResult = await registerAgentTool.handler(
            {
              name: `E2E Discovery Test Agent ${Date.now()}`,
              description: 'Test agent for discovery tools',
              skills: ['testing'],
              preferredTaskTypes: ['code'],
            },
            { callerAddress: agentWallet.address }
          );
          await registerAgentOnChain(agentWallet, profileResult.agentURI);
        }

        const context = createRegisteredContext(agentWallet.address, agentSessionId);
        const result = await getCapabilitiesHandler({}, context);

        console.log(`Access level: ${result.currentAccess.level}`);
        console.log(`Is registered: ${result.currentAccess.isRegistered}`);

        // Check access level
        expect(result.currentAccess.level).toBe('registered');
        expect(result.currentAccess.isRegistered).toBe(true);

        // Check all tools are available
        const unavailableTools = result.tools.filter((t) => !t.available);
        console.log(`Unavailable tools: ${unavailableTools.length}`);

        // All tools should be available for registered users
        for (const tool of result.tools) {
          expect(tool.available).toBe(true);
        }

        // Check nextSteps mentions browsing tasks
        const hasBrowseStep = result.nextSteps.some(
          (step) =>
            step.toLowerCase().includes('list_tasks') || step.toLowerCase().includes('browse')
        );
        expect(hasBrowseStep).toBe(true);

        console.log('All tools available for registered user');
      },
      TEST_TIMEOUT
    );

    test('Test 4: Category filter works', async () => {
      console.log('\n--- Test 4: Category filter works ---\n');

      const context = createPublicContext();
      const result = await getCapabilitiesHandler({ category: 'task' }, context);

      console.log(`Filtered tools count: ${result.tools.length}`);

      // Should only have task-related tools
      const taskTools = ['list_tasks', 'get_task', 'create_task', 'cancel_task'];
      for (const tool of result.tools) {
        expect(taskTools).toContain(tool.name);
      }

      // Should not have auth or agent tools
      const hasAuthTool = result.tools.some((t) => t.name.startsWith('auth_'));
      const hasAgentTool = result.tools.some((t) =>
        ['register_agent', 'submit_work', 'get_my_submissions', 'update_profile'].includes(t.name)
      );

      expect(hasAuthTool).toBe(false);
      expect(hasAgentTool).toBe(false);

      console.log(`Task category filter returns ${result.tools.length} task-related tools`);
    });
  });

  describe('get_workflow_guide', () => {
    test('Test 5: Agent workflow guide', async () => {
      console.log('\n--- Test 5: Agent workflow guide ---\n');

      const result = await getWorkflowGuideHandler({ role: 'agent' });

      console.log(`Role: ${result.role}`);
      console.log(`Workflows: ${result.workflows.map((w) => w.name).join(', ')}`);

      // Check role
      expect(result.role).toBe('agent');

      // Check workflows exist
      const workflowNames = result.workflows.map((w) => w.name);
      expect(workflowNames).toContain('authenticate');
      expect(workflowNames).toContain('register');
      expect(workflowNames).toContain('find_work');
      expect(workflowNames).toContain('submit_work');

      // Check submit_work workflow has steps with tools
      const submitWorkflow = result.workflows.find((w) => w.name === 'submit_work');
      expect(submitWorkflow).toBeDefined();
      expect(submitWorkflow!.steps.length).toBeGreaterThan(0);

      // Should reference submit_work tool
      const hasSubmitTool = submitWorkflow!.steps.some(
        (s) => s.tool === 'submit_work' || s.description?.includes('submitWork')
      );
      expect(hasSubmitTool).toBe(true);

      console.log('Agent workflow guide contains expected workflows');
    });

    test('Test 6: Creator workflow guide', async () => {
      console.log('\n--- Test 6: Creator workflow guide ---\n');

      const result = await getWorkflowGuideHandler({ role: 'creator' });

      console.log(`Role: ${result.role}`);
      console.log(`Workflows: ${result.workflows.map((w) => w.name).join(', ')}`);

      // Check role
      expect(result.role).toBe('creator');

      // Check workflows exist
      const workflowNames = result.workflows.map((w) => w.name);
      expect(workflowNames).toContain('create_task');
      expect(workflowNames).toContain('select_winner');
      expect(workflowNames).toContain('cancel_task');

      // Check create_task workflow references the tool and bounty deposit
      const createWorkflow = result.workflows.find((w) => w.name === 'create_task');
      expect(createWorkflow).toBeDefined();

      const hasCreateTool = createWorkflow!.steps.some(
        (s) => s.tool === 'create_task' || s.description?.includes('createTask')
      );
      const mentionsBounty = createWorkflow!.steps.some((s) =>
        s.description?.toLowerCase().includes('bounty')
      );

      expect(hasCreateTool).toBe(true);
      expect(mentionsBounty).toBe(true);

      console.log('Creator workflow guide contains expected workflows');
    });

    test('Test 7: Voter workflow guide', async () => {
      console.log('\n--- Test 7: Voter workflow guide ---\n');

      const result = await getWorkflowGuideHandler({ role: 'voter' });

      console.log(`Role: ${result.role}`);
      console.log(`Workflows: ${result.workflows.map((w) => w.name).join(', ')}`);

      // Check role
      expect(result.role).toBe('voter');

      // Check workflows exist
      const workflowNames = result.workflows.map((w) => w.name);
      expect(workflowNames).toContain('find_disputes');
      expect(workflowNames).toContain('vote_on_dispute');
      expect(workflowNames).toContain('resolve_dispute');

      // Check vote_on_dispute workflow mentions staking or voting period
      const voteWorkflow = result.workflows.find((w) => w.name === 'vote_on_dispute');
      expect(voteWorkflow).toBeDefined();

      const allDescriptions = voteWorkflow!.steps.map((s) => s.description || '').join(' ');
      const mentionsVoting = allDescriptions.toLowerCase().includes('vote');

      expect(mentionsVoting).toBe(true);

      console.log('Voter workflow guide contains expected workflows');
    });

    test('Test 8: Specific workflow filter', async () => {
      console.log('\n--- Test 8: Specific workflow filter ---\n');

      const result = await getWorkflowGuideHandler({
        role: 'agent',
        workflow: 'submit_work',
      });

      console.log(`Role: ${result.role}`);
      console.log(`Workflows returned: ${result.workflows.length}`);

      // Should return only 1 workflow
      expect(result.workflows.length).toBe(1);
      expect(result.workflows[0].name).toBe('submit_work');

      // Has detailed steps
      expect(result.workflows[0].steps.length).toBeGreaterThan(0);

      console.log('Specific workflow filter returns single workflow');
    });
  });

  describe('MCP Resources', () => {
    test('Test 9: List MCP resources', async () => {
      console.log('\n--- Test 9: List MCP resources ---\n');

      console.log(`Resources count: ${allResources.length}`);

      // Should have 3 resources
      expect(allResources.length).toBe(3);

      // Check URIs
      const uris = allResources.map((r) => r.uri);
      expect(uris).toContain('pact://guides/agent');
      expect(uris).toContain('pact://guides/creator');
      expect(uris).toContain('pact://guides/voter');

      // Each should have name, description, mimeType
      for (const resource of allResources) {
        expect(resource.name).toBeDefined();
        expect(resource.description).toBeDefined();
        expect(resource.mimeType).toBe('text/markdown');
      }

      console.log('3 MCP resources available with expected URIs');
    });

    test('Test 10: Read agent guide resource', async () => {
      console.log('\n--- Test 10: Read agent guide resource ---\n');

      const uri = 'pact://guides/agent';
      const exists = resourceExists(uri);
      expect(exists).toBe(true);

      const content = getResourceContent(uri);

      // Content should be markdown
      expect(content).toBeDefined();
      expect(content!.length).toBeGreaterThan(500);

      // Check for expected content
      const hasHeading = content!.includes('# ') || content!.includes('Agent');
      const mentionsSubmitWork =
        content!.includes('submit_work') || content!.includes('submitWork');
      const mentionsRegister = content!.includes('register_agent') || content!.includes('Register');

      expect(hasHeading).toBe(true);
      expect(mentionsSubmitWork).toBe(true);
      expect(mentionsRegister).toBe(true);

      console.log(`Agent guide content length: ${content!.length} characters`);
    });

    test('Test 11: Unknown resource returns error', async () => {
      console.log('\n--- Test 11: Unknown resource returns error ---\n');

      const uri = 'pact://invalid';
      const exists = resourceExists(uri);
      const content = getResourceContent(uri);

      expect(exists).toBe(false);
      expect(content).toBeNull();

      console.log('Unknown resource correctly returns null/false');
    });
  });

  test('Final summary', async () => {
    console.log('\n========================================');
    console.log('Discovery Tools Test Complete!');
    console.log('========================================');
    console.log('\nAll discovery tools and resources work correctly.');
    console.log('========================================\n');
  });
});

// Export for manual testing
export async function runDiscoveryToolsTest(): Promise<void> {
  console.log('Run this test with:');
  console.log('E2E_CREATOR_PRIVATE_KEY="0x..." \\');
  console.log('E2E_AGENT_PRIVATE_KEY="0x..." \\');
  console.log('bun test src/__tests__/e2e/discovery-tools-e2e.test.ts');
}
