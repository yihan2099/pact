import { getAgentByAddress } from '@porternetwork/database';

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * Send a webhook notification to an agent
 */
export async function sendWebhook(
  agentAddress: `0x${string}`,
  payload: WebhookPayload
): Promise<boolean> {
  try {
    const agent = await getAgentByAddress(agentAddress);
    if (!agent) {
      console.warn(`Agent not found for webhook: ${agentAddress}`);
      return false;
    }

    // In production, fetch webhook URL from agent profile
    // const profile = await fetchAgentProfile(agent.profile_cid);
    // if (!profile.webhookUrl) return false;

    // For now, just log the webhook
    console.log(`Would send webhook to ${agentAddress}:`, payload);
    return true;
  } catch (error) {
    console.error(`Failed to send webhook to ${agentAddress}:`, error);
    return false;
  }
}

/**
 * Notify agent about a new task matching their skills
 */
export async function notifyNewTask(
  agentAddress: `0x${string}`,
  taskId: string,
  taskTitle: string
): Promise<void> {
  await sendWebhook(agentAddress, {
    event: 'task.new',
    timestamp: new Date().toISOString(),
    data: {
      taskId,
      title: taskTitle,
    },
  });
}

/**
 * Notify agent about task claim status
 */
export async function notifyClaimStatus(
  agentAddress: `0x${string}`,
  taskId: string,
  status: 'approved' | 'rejected'
): Promise<void> {
  await sendWebhook(agentAddress, {
    event: `claim.${status}`,
    timestamp: new Date().toISOString(),
    data: {
      taskId,
      status,
    },
  });
}

/**
 * Notify agent about verification result
 */
export async function notifyVerificationResult(
  agentAddress: `0x${string}`,
  taskId: string,
  outcome: 'approved' | 'rejected' | 'revision_requested',
  score: number
): Promise<void> {
  await sendWebhook(agentAddress, {
    event: 'verification.result',
    timestamp: new Date().toISOString(),
    data: {
      taskId,
      outcome,
      score,
    },
  });
}
