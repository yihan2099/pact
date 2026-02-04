/**
 * Skill Bridge
 *
 * Bridges MCP tools to A2A skills, handling tool execution with access control.
 * Reuses existing tool handlers and access control logic.
 */

import type { ServerContext } from '../server';
import { checkAccessWithRegistrationRefresh } from '../auth/access-control';
import { getSkillById, skillExists } from './agent-card';
import { listTasksTool } from '../tools/task/list-tasks';
import { getTaskTool } from '../tools/task/get-task';
import { createTaskTool } from '../tools/task/create-task';
import { cancelTaskTool } from '../tools/task/cancel-task';
import { submitWorkTool } from '../tools/agent/submit-work';
import { getMySubmissionsTool } from '../tools/agent/get-my-submissions';
import { registerAgentTool } from '../tools/agent/register-agent';
import { updateProfileTool } from '../tools/agent/update-profile';
import { getReputationTool } from '../tools/agent/get-reputation';
import { getFeedbackHistoryTool } from '../tools/agent/get-feedback-history';
import {
  getDisputeTool,
  listDisputesTool,
  startDisputeTool,
  submitVoteTool,
  resolveDisputeTool,
} from '../tools/dispute';
import { getChallengeHandler, verifySignatureHandler, getSessionHandler } from '../tools/auth';
import {
  getCapabilitiesHandler,
  getWorkflowGuideHandler,
  getSupportedTokensHandler,
} from '../tools/discovery';
import type { A2ASkill } from './types';
import { A2A_ERROR_CODES } from './types';

/**
 * Skill execution result
 */
export interface SkillExecutionResult {
  success: boolean;
  data?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  registrationUpdated?: boolean;
}

/**
 * Execute a skill (MCP tool) with the given input and context
 */
export async function executeSkill(
  skillId: string,
  input: Record<string, unknown>,
  context: ServerContext
): Promise<SkillExecutionResult> {
  // Check if skill exists
  if (!skillExists(skillId)) {
    return {
      success: false,
      error: {
        code: A2A_ERROR_CODES.SKILL_NOT_FOUND,
        message: `Skill not found: ${skillId}`,
      },
    };
  }

  // Check access control
  const accessCheck = await checkAccessWithRegistrationRefresh(skillId, context);
  if (!accessCheck.allowed) {
    return {
      success: false,
      error: {
        code: A2A_ERROR_CODES.ACCESS_DENIED,
        message: accessCheck.reason || 'Access denied',
      },
    };
  }

  // If registration was just detected, update the context
  let updatedContext = context;
  if (accessCheck.registrationUpdated) {
    updatedContext = { ...context, isRegistered: true };
  }

  try {
    const result = await executeTool(skillId, input, updatedContext);

    return {
      success: true,
      data: result,
      registrationUpdated: accessCheck.registrationUpdated,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: A2A_ERROR_CODES.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Execute a tool by name with given arguments and context
 * This is the core execution logic shared between HTTP server and A2A
 */
async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  context: ServerContext
): Promise<unknown> {
  switch (toolName) {
    // Discovery tools
    case 'get_capabilities':
      return await getCapabilitiesHandler(args, context);
    case 'get_workflow_guide':
      return await getWorkflowGuideHandler(args);
    case 'get_supported_tokens':
      return await getSupportedTokensHandler();

    // Auth tools
    case 'auth_get_challenge':
      return await getChallengeHandler(args);
    case 'auth_verify':
      return await verifySignatureHandler(args);
    case 'auth_session':
      return await getSessionHandler(args);

    // Task tools
    case 'list_tasks':
      return await listTasksTool.handler(args);
    case 'get_task':
      return await getTaskTool.handler(args);
    case 'create_task':
      return await createTaskTool.handler(args, context);
    case 'cancel_task':
      return await cancelTaskTool.handler(args, context);
    case 'submit_work':
      return await submitWorkTool.handler(args, context);
    case 'get_my_submissions':
      return await getMySubmissionsTool.handler(args, context);
    case 'register_agent':
      return await registerAgentTool.handler(args, context);
    case 'update_profile':
      return await updateProfileTool.handler(args, context);
    case 'get_reputation':
      return await getReputationTool.handler(args, context);
    case 'get_feedback_history':
      return await getFeedbackHistoryTool.handler(args, context);

    // Dispute tools
    case 'get_dispute':
      return await getDisputeTool.handler(args);
    case 'list_disputes':
      return await listDisputesTool.handler(args);
    case 'start_dispute':
      return await startDisputeTool.handler(args, context);
    case 'submit_vote':
      return await submitVoteTool.handler(args, context);
    case 'resolve_dispute':
      return await resolveDisputeTool.handler(args);

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * Get skill metadata by ID
 */
export function getSkillMetadata(skillId: string): A2ASkill | undefined {
  return getSkillById(skillId);
}

/**
 * Check if a skill requires authentication
 */
export function skillRequiresAuth(skillId: string): boolean {
  const skill = getSkillById(skillId);
  if (!skill) return true; // Default to requiring auth for unknown skills
  return skill.accessLevel !== 'public';
}

/**
 * Check if a skill requires registration
 */
export function skillRequiresRegistration(skillId: string): boolean {
  const skill = getSkillById(skillId);
  if (!skill) return true; // Default to requiring registration for unknown skills
  return skill.accessLevel === 'registered';
}
