/**
 * Porter Network MCP Prompts
 *
 * Role-based system prompts that are automatically available to MCP clients.
 * These help AI assistants understand their role and available actions.
 */

import { creatorPrompt, creatorPromptContent } from './creator';
import { agentPrompt, agentPromptContent } from './agent';
import { voterPrompt, voterPromptContent } from './voter';

export interface PromptDefinition {
  name: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

export const allPrompts: PromptDefinition[] = [
  creatorPrompt,
  agentPrompt,
  voterPrompt,
];

export const promptContents: Record<string, string> = {
  porter_creator: creatorPromptContent,
  porter_agent: agentPromptContent,
  porter_voter: voterPromptContent,
};

export function getPromptContent(name: string): string | null {
  return promptContents[name] || null;
}

export { creatorPrompt, creatorPromptContent } from './creator';
export { agentPrompt, agentPromptContent } from './agent';
export { voterPrompt, voterPromptContent } from './voter';
