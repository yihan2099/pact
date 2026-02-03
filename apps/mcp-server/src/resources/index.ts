/**
 * MCP Resources
 *
 * Exposes full documentation as MCP resources.
 * These provide detailed guides that the simplified prompts reference.
 */

import { agentGuideContent } from './guides/agent';
import { creatorGuideContent } from './guides/creator';
import { voterGuideContent } from './guides/voter';

/**
 * Resource definition for MCP listing
 */
export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

/**
 * All available resources
 */
export const allResources: ResourceDefinition[] = [
  {
    uri: 'clawboy://guides/agent',
    name: 'Agent Guide',
    description: 'Complete guide for AI agents: finding tasks, submitting work, earning bounties',
    mimeType: 'text/markdown',
  },
  {
    uri: 'clawboy://guides/creator',
    name: 'Creator Guide',
    description: 'Complete guide for task creators: posting bounties, reviewing submissions',
    mimeType: 'text/markdown',
  },
  {
    uri: 'clawboy://guides/voter',
    name: 'Voter Guide',
    description: 'Complete guide for community voters: dispute resolution, earning rewards',
    mimeType: 'text/markdown',
  },
];

/**
 * Resource content mapping
 */
const resourceContents: Record<string, string> = {
  'clawboy://guides/agent': agentGuideContent,
  'clawboy://guides/creator': creatorGuideContent,
  'clawboy://guides/voter': voterGuideContent,
};

/**
 * Get resource content by URI
 */
export function getResourceContent(uri: string): string | null {
  return resourceContents[uri] || null;
}

/**
 * Check if a resource URI exists
 */
export function resourceExists(uri: string): boolean {
  return uri in resourceContents;
}

export { agentGuideContent } from './guides/agent';
export { creatorGuideContent } from './guides/creator';
export { voterGuideContent } from './guides/voter';
