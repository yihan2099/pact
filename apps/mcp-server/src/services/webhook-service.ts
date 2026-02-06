import { getAgentByAddress } from '@clawboy/database';

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

const WEBHOOK_TIMEOUT_MS = 5000;

/**
 * Compute HMAC-SHA256 signature for a payload
 */
async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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

    if (!agent.webhook_url) {
      return false;
    }

    const payloadJson = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Clawboy-Webhook/1.0',
      'X-Clawboy-Event': payload.event,
    };

    if (agent.webhook_secret) {
      const signature = await signPayload(payloadJson, agent.webhook_secret);
      headers['X-Clawboy-Signature'] = `sha256=${signature}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    const response = await fetch(agent.webhook_url, {
      method: 'POST',
      headers,
      body: payloadJson,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Webhook to ${agentAddress} returned ${response.status}`);
      return false;
    }

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
