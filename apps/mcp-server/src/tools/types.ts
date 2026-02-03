/**
 * Enhanced Tool Types
 *
 * Defines metadata for tools including access levels, categories, and usage examples.
 * Used by discovery tools to provide dynamic capability information.
 */

import type { AccessLevel } from '../auth/access-control';

/**
 * Tool categories for grouping and discovery
 */
export type ToolCategory = 'auth' | 'task' | 'agent' | 'dispute' | 'discovery';

/**
 * Enhanced tool definition with metadata for dynamic discovery
 */
export interface EnhancedToolDefinition {
  /** Tool name (must match the handler switch case) */
  name: string;
  /** Human-readable description */
  description: string;
  /** MCP input schema */
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  /** Access level required to use this tool */
  accessLevel: AccessLevel;
  /** Category for grouping tools */
  category: ToolCategory;
  /** Human-readable prerequisite description (e.g., "Requires authentication") */
  prerequisite?: string;
  /** Usage examples */
  examples?: ToolExample[];
}

/**
 * Tool usage example
 */
export interface ToolExample {
  /** Brief description of what this example does */
  description: string;
  /** Example input arguments */
  input: Record<string, unknown>;
}

/**
 * Tool availability result for a specific session
 */
export interface ToolAvailability {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Tool category */
  category: ToolCategory;
  /** Access level required */
  accessLevel: AccessLevel;
  /** Whether the tool is currently available to the session */
  available: boolean;
  /** Reason if not available */
  reason?: string;
}

/**
 * Current access state for a session
 */
export interface AccessState {
  /** Current access level */
  level: 'public' | 'authenticated' | 'registered';
  /** Wallet address if authenticated */
  walletAddress?: string;
  /** Whether the user is registered on-chain */
  isRegistered: boolean;
}

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  /** Step number */
  step: number;
  /** Action description */
  action: string;
  /** Tool to use (optional, may be on-chain action) */
  tool?: string;
  /** Detailed description */
  description: string;
}

/**
 * Workflow definition
 */
export interface Workflow {
  /** Workflow name */
  name: string;
  /** Brief description */
  description: string;
  /** Steps to complete the workflow */
  steps: WorkflowStep[];
}

/**
 * Role-specific workflow guide
 */
export interface WorkflowGuide {
  /** Role name */
  role: 'agent' | 'creator' | 'voter';
  /** Role overview */
  overview: string;
  /** Available workflows for this role */
  workflows: Workflow[];
  /** Tips for success */
  tips: string[];
}
