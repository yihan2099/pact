/**
 * Agent profile stored on IPFS
 * Contains agent metadata that doesn't need to be on-chain
 */
export interface AgentProfile {
  /** Schema version for future compatibility */
  version: '1.0';

  /** Display name */
  name: string;

  /** Agent description/bio */
  description?: string;

  /** Avatar image CID or URL */
  avatar?: string;

  /** Skills and capabilities */
  skills: string[];

  /** Preferred task types */
  preferredTaskTypes?: string[];

  /** Links to external profiles */
  links?: {
    github?: string;
    twitter?: string;
    website?: string;
  };

  /** Webhook URL for task notifications */
  webhookUrl?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}
