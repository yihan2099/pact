import { describe, test, expect } from 'bun:test';
import { getCapabilitiesHandler } from '../tools/discovery/get-capabilities';
import { getWorkflowGuideHandler } from '../tools/discovery/get-workflow-guide';
import type { ServerContext } from '../server';

describe('Discovery Tools', () => {
  // Context factories
  const createUnauthenticatedContext = (): ServerContext => ({
    callerAddress: '0x0000000000000000000000000000000000000000',
    isAuthenticated: false,
    isRegistered: false,
    sessionId: null,
  });

  const createAuthenticatedContext = (): ServerContext => ({
    callerAddress: '0x1234567890123456789012345678901234567890',
    isAuthenticated: true,
    isRegistered: false,
    sessionId: 'test-session-id',
  });

  const createRegisteredContext = (): ServerContext => ({
    callerAddress: '0x1234567890123456789012345678901234567890',
    isAuthenticated: true,
    isRegistered: true,
    sessionId: 'test-session-id',
  });

  describe('get_capabilities', () => {
    test('should return public access level for unauthenticated users', async () => {
      const context = createUnauthenticatedContext();
      const result = await getCapabilitiesHandler({}, context);

      expect(result.currentAccess.level).toBe('public');
      expect(result.currentAccess.isRegistered).toBe(false);
      expect(result.currentAccess.walletAddress).toBeUndefined();
    });

    test('should return authenticated access level for authenticated users', async () => {
      const context = createAuthenticatedContext();
      const result = await getCapabilitiesHandler({}, context);

      expect(result.currentAccess.level).toBe('authenticated');
      expect(result.currentAccess.isRegistered).toBe(false);
      expect(result.currentAccess.walletAddress).toBe(context.callerAddress);
    });

    test('should return registered access level for registered users', async () => {
      const context = createRegisteredContext();
      const result = await getCapabilitiesHandler({}, context);

      expect(result.currentAccess.level).toBe('registered');
      expect(result.currentAccess.isRegistered).toBe(true);
      expect(result.currentAccess.walletAddress).toBe(context.callerAddress);
    });

    test('should show public tools as available for unauthenticated users', async () => {
      const context = createUnauthenticatedContext();
      const result = await getCapabilitiesHandler({}, context);

      const listTasksTool = result.tools.find((t) => t.name === 'list_tasks');
      const getCapabilitiesTool = result.tools.find((t) => t.name === 'get_capabilities');

      expect(listTasksTool).toBeDefined();
      expect(listTasksTool?.available).toBe(true);
      expect(getCapabilitiesTool).toBeDefined();
      expect(getCapabilitiesTool?.available).toBe(true);
    });

    test('should show authenticated tools as unavailable for unauthenticated users', async () => {
      const context = createUnauthenticatedContext();
      const result = await getCapabilitiesHandler({}, context);

      const getMySubmissionsTool = result.tools.find((t) => t.name === 'get_my_submissions');
      expect(getMySubmissionsTool).toBeDefined();
      expect(getMySubmissionsTool?.available).toBe(false);
      expect(getMySubmissionsTool?.reason).toContain('authentication');
    });

    test('should show registered tools as unavailable for authenticated non-registered users', async () => {
      const context = createAuthenticatedContext();
      const result = await getCapabilitiesHandler({}, context);

      const submitWorkTool = result.tools.find((t) => t.name === 'submit_work');
      expect(submitWorkTool).toBeDefined();
      expect(submitWorkTool?.available).toBe(false);
      expect(submitWorkTool?.reason).toContain('registration');
    });

    test('should show all tools as available for registered users', async () => {
      const context = createRegisteredContext();
      const result = await getCapabilitiesHandler({}, context);

      const submitWorkTool = result.tools.find((t) => t.name === 'submit_work');
      const getMySubmissionsTool = result.tools.find((t) => t.name === 'get_my_submissions');
      const listTasksTool = result.tools.find((t) => t.name === 'list_tasks');

      expect(submitWorkTool?.available).toBe(true);
      expect(getMySubmissionsTool?.available).toBe(true);
      expect(listTasksTool?.available).toBe(true);
    });

    test('should filter tools by category', async () => {
      const context = createUnauthenticatedContext();
      const result = await getCapabilitiesHandler({ category: 'auth' }, context);

      expect(result.tools.every((t) => t.category === 'auth')).toBe(true);
      expect(result.tools.length).toBeGreaterThan(0);
    });

    test('should return all tools when category is "all"', async () => {
      const context = createUnauthenticatedContext();
      const resultAll = await getCapabilitiesHandler({ category: 'all' }, context);
      const resultDefault = await getCapabilitiesHandler({}, context);

      expect(resultAll.tools.length).toBe(resultDefault.tools.length);
    });

    test('should provide helpful next steps', async () => {
      const unauthContext = createUnauthenticatedContext();
      const authContext = createAuthenticatedContext();
      const registeredContext = createRegisteredContext();

      const unauthResult = await getCapabilitiesHandler({}, unauthContext);
      const authResult = await getCapabilitiesHandler({}, authContext);
      const registeredResult = await getCapabilitiesHandler({}, registeredContext);

      expect(unauthResult.nextSteps.length).toBeGreaterThan(0);
      expect(unauthResult.nextSteps.some((s) => s.includes('auth_get_challenge'))).toBe(true);

      expect(authResult.nextSteps.length).toBeGreaterThan(0);
      expect(authResult.nextSteps.some((s) => s.includes('register_agent'))).toBe(true);

      expect(registeredResult.nextSteps.length).toBeGreaterThan(0);
      expect(registeredResult.nextSteps.some((s) => s.includes('list_tasks'))).toBe(true);
    });

    test('should include discovery tools in the list', async () => {
      const context = createUnauthenticatedContext();
      const result = await getCapabilitiesHandler({}, context);

      const discoveryTools = result.tools.filter((t) => t.category === 'discovery');
      expect(discoveryTools.length).toBe(3);
      expect(discoveryTools.some((t) => t.name === 'get_capabilities')).toBe(true);
      expect(discoveryTools.some((t) => t.name === 'get_workflow_guide')).toBe(true);
      expect(discoveryTools.some((t) => t.name === 'get_supported_tokens')).toBe(true);
    });
  });

  describe('get_workflow_guide', () => {
    test('should return agent workflows', async () => {
      const result = await getWorkflowGuideHandler({ role: 'agent' });

      expect(result.role).toBe('agent');
      expect(result.overview).toContain('Agent');
      expect(result.workflows.length).toBeGreaterThan(0);
      expect(result.tips.length).toBeGreaterThan(0);
    });

    test('should return creator workflows', async () => {
      const result = await getWorkflowGuideHandler({ role: 'creator' });

      expect(result.role).toBe('creator');
      expect(result.overview).toContain('Creator');
      expect(result.workflows.length).toBeGreaterThan(0);
      expect(result.tips.length).toBeGreaterThan(0);
    });

    test('should return voter workflows', async () => {
      const result = await getWorkflowGuideHandler({ role: 'voter' });

      expect(result.role).toBe('voter');
      expect(result.overview).toContain('Voter');
      expect(result.workflows.length).toBeGreaterThan(0);
      expect(result.tips.length).toBeGreaterThan(0);
    });

    test('should include authenticate workflow for all roles', async () => {
      const agentResult = await getWorkflowGuideHandler({ role: 'agent' });
      const creatorResult = await getWorkflowGuideHandler({ role: 'creator' });
      const voterResult = await getWorkflowGuideHandler({ role: 'voter' });

      expect(agentResult.workflows.some((w) => w.name === 'authenticate')).toBe(true);
      expect(creatorResult.workflows.some((w) => w.name === 'authenticate')).toBe(true);
      expect(voterResult.workflows.some((w) => w.name === 'authenticate')).toBe(true);
    });

    test('should filter to specific workflow when provided', async () => {
      const result = await getWorkflowGuideHandler({ role: 'agent', workflow: 'submit_work' });

      expect(result.workflows.length).toBe(1);
      expect(result.workflows[0].name).toBe('submit_work');
    });

    test('should throw error for invalid role', async () => {
      await expect(getWorkflowGuideHandler({ role: 'invalid' as 'agent' })).rejects.toThrow();
    });

    test('should throw error for unknown workflow', async () => {
      await expect(
        getWorkflowGuideHandler({ role: 'agent', workflow: 'unknown_workflow' })
      ).rejects.toThrow('Unknown workflow');
    });

    test('should include step numbers in workflows', async () => {
      const result = await getWorkflowGuideHandler({ role: 'agent' });

      for (const workflow of result.workflows) {
        expect(workflow.steps.length).toBeGreaterThan(0);
        workflow.steps.forEach((step, index) => {
          expect(step.step).toBe(index + 1);
        });
      }
    });

    test('should include tool names in steps where applicable', async () => {
      const result = await getWorkflowGuideHandler({ role: 'agent', workflow: 'authenticate' });

      const authWorkflow = result.workflows[0];
      expect(authWorkflow.steps.some((s) => s.tool === 'auth_get_challenge')).toBe(true);
      expect(authWorkflow.steps.some((s) => s.tool === 'auth_verify')).toBe(true);
    });
  });
});
