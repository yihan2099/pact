/**
 * Webhook Notification Service
 *
 * Delivers signed webhook payloads to agents after indexer events.
 * - Fire-and-forget with 5-second timeout
 * - HMAC-SHA256 payload signing per agent
 * - Logs delivery attempts to webhook_deliveries table
 * - Retries failed deliveries up to 3 times with exponential backoff
 */

import {
  getAgentsWithWebhooks,
  getAgentsWebhookInfoByAddresses,
  getAgentWebhookInfo,
  createWebhookDelivery,
  updateWebhookDelivery,
  getRetryableWebhookDeliveries,
  getSubmissionsByTaskId,
  type AgentWebhookInfo,
} from '@clawboy/database';

const WEBHOOK_TIMEOUT_MS = 5000;
const MAX_ATTEMPTS = 3;

export interface WebhookPayload {
  event: string;
  taskId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

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
 * Send a webhook to a single agent (fire-and-forget)
 */
async function deliverWebhook(agent: AgentWebhookInfo, payload: WebhookPayload): Promise<void> {
  const payloadJson = JSON.stringify(payload);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Clawboy-Webhook/1.0',
    'X-Clawboy-Event': payload.event,
  };

  // Sign payload if agent has a webhook secret
  if (agent.webhook_secret) {
    const signature = await signPayload(payloadJson, agent.webhook_secret);
    headers['X-Clawboy-Signature'] = `sha256=${signature}`;
  }

  // Record delivery attempt
  let deliveryId: string | null = null;
  try {
    const delivery = await createWebhookDelivery({
      agent_address: agent.address,
      event_name: payload.event,
      payload: payload as unknown as Record<string, unknown>,
      status: 'pending',
      attempt: 1,
      max_attempts: MAX_ATTEMPTS,
    });
    deliveryId = delivery.id;
  } catch (err) {
    console.warn(`Failed to record webhook delivery for ${agent.address}:`, err);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    const response = await fetch(agent.webhook_url, {
      method: 'POST',
      headers,
      body: payloadJson,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (deliveryId) {
      if (response.ok) {
        await updateWebhookDelivery(deliveryId, {
          status: 'delivered',
          status_code: response.status,
          delivered_at: new Date().toISOString(),
        }).catch(() => {});
      } else {
        // Schedule retry with exponential backoff
        const nextRetryAt = new Date(Date.now() + 30_000).toISOString(); // 30s for first retry
        await updateWebhookDelivery(deliveryId, {
          status: 'pending',
          status_code: response.status,
          error_message: `HTTP ${response.status}`,
          next_retry_at: nextRetryAt,
        }).catch(() => {});
      }
    }

    if (!response.ok) {
      console.warn(`Webhook delivery to ${agent.address} returned ${response.status}`);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.warn(`Webhook delivery to ${agent.address} failed: ${errorMessage}`);

    if (deliveryId) {
      const nextRetryAt = new Date(Date.now() + 30_000).toISOString();
      await updateWebhookDelivery(deliveryId, {
        status: 'pending',
        error_message: errorMessage,
        next_retry_at: nextRetryAt,
      }).catch(() => {});
    }
  }
}

/**
 * Send webhooks to multiple agents (fire-and-forget, non-blocking)
 */
function notifyAgents(agents: AgentWebhookInfo[], payload: WebhookPayload): void {
  if (agents.length === 0) return;

  // Fire-and-forget: don't await, just log errors
  Promise.allSettled(agents.map((agent) => deliverWebhook(agent, payload))).then((results) => {
    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      console.warn(
        `${failures.length}/${agents.length} webhook deliveries failed for ${payload.event}`
      );
    }
  });
}

// ============ Event-specific notification functions ============

/**
 * Notify all agents with webhooks about a new task
 */
export async function notifyTaskCreated(
  taskId: string,
  creator: string,
  title: string,
  bountyAmount: string,
  tags: string[]
): Promise<void> {
  try {
    const agents = await getAgentsWithWebhooks();
    // Exclude the creator from notifications
    const recipients = agents.filter((a) => a.address !== creator.toLowerCase());

    notifyAgents(recipients, {
      event: 'TaskCreated',
      taskId,
      timestamp: new Date().toISOString(),
      data: { creator, title, bountyAmount, tags },
    });
  } catch (err) {
    console.warn('Failed to send TaskCreated webhooks:', err);
  }
}

/**
 * Notify task creator about a new submission
 */
export async function notifyWorkSubmitted(
  taskId: string,
  creatorAddress: string,
  agent: string
): Promise<void> {
  try {
    const webhookInfo = await getAgentWebhookInfo(creatorAddress);
    if (!webhookInfo) return;

    notifyAgents([webhookInfo], {
      event: 'WorkSubmitted',
      taskId,
      timestamp: new Date().toISOString(),
      data: { agent },
    });
  } catch (err) {
    console.warn('Failed to send WorkSubmitted webhook:', err);
  }
}

/**
 * Notify winner and all submitters about winner selection
 */
export async function notifyWinnerSelected(
  taskId: string,
  dbTaskId: string,
  winner: string
): Promise<void> {
  try {
    // Get all submitters for this task
    const { submissions } = await getSubmissionsByTaskId(dbTaskId);
    const submitterAddresses = submissions.map((s) => s.agent_address);

    const agents = await getAgentsWebhookInfoByAddresses(submitterAddresses);
    if (agents.length === 0) return;

    notifyAgents(agents, {
      event: 'WinnerSelected',
      taskId,
      timestamp: new Date().toISOString(),
      data: { winner },
    });
  } catch (err) {
    console.warn('Failed to send WinnerSelected webhooks:', err);
  }
}

/**
 * Notify winner about task completion
 */
export async function notifyTaskCompleted(
  taskId: string,
  winner: string,
  bountyAmount: string
): Promise<void> {
  try {
    const webhookInfo = await getAgentWebhookInfo(winner);
    if (!webhookInfo) return;

    notifyAgents([webhookInfo], {
      event: 'TaskCompleted',
      taskId,
      timestamp: new Date().toISOString(),
      data: { winner, bountyAmount },
    });
  } catch (err) {
    console.warn('Failed to send TaskCompleted webhook:', err);
  }
}

/**
 * Notify all submitters about a dispute being created
 */
export async function notifyDisputeCreated(
  taskId: string,
  dbTaskId: string,
  disputeId: string,
  disputer: string
): Promise<void> {
  try {
    const { submissions } = await getSubmissionsByTaskId(dbTaskId);
    const submitterAddresses = submissions.map((s) => s.agent_address);

    const agents = await getAgentsWebhookInfoByAddresses(submitterAddresses);
    if (agents.length === 0) return;

    notifyAgents(agents, {
      event: 'DisputeCreated',
      taskId,
      timestamp: new Date().toISOString(),
      data: { disputeId, disputer },
    });
  } catch (err) {
    console.warn('Failed to send DisputeCreated webhooks:', err);
  }
}

/**
 * Notify disputer and selected winner about dispute resolution
 */
export async function notifyDisputeResolved(
  taskId: string,
  disputeId: string,
  disputerAddress: string,
  disputerWon: boolean
): Promise<void> {
  try {
    const agents = await getAgentsWebhookInfoByAddresses([disputerAddress]);
    if (agents.length === 0) return;

    notifyAgents(agents, {
      event: 'DisputeResolved',
      taskId,
      timestamp: new Date().toISOString(),
      data: { disputeId, disputerWon },
    });
  } catch (err) {
    console.warn('Failed to send DisputeResolved webhooks:', err);
  }
}

/**
 * Notify disputer about a new vote on their dispute
 */
export async function notifyVoteSubmitted(
  taskId: string,
  disputeId: string,
  disputerAddress: string,
  voter: string,
  supportsDisputer: boolean
): Promise<void> {
  try {
    const webhookInfo = await getAgentWebhookInfo(disputerAddress);
    if (!webhookInfo) return;

    notifyAgents([webhookInfo], {
      event: 'VoteSubmitted',
      taskId,
      timestamp: new Date().toISOString(),
      data: { disputeId, voter, supportsDisputer },
    });
  } catch (err) {
    console.warn('Failed to send VoteSubmitted webhook:', err);
  }
}

/**
 * Process retryable webhook deliveries (called periodically)
 */
export async function processWebhookRetries(): Promise<void> {
  const deliveries = await getRetryableWebhookDeliveries(50);
  if (deliveries.length === 0) return;

  console.log(`Processing ${deliveries.length} webhook retries`);

  for (const delivery of deliveries) {
    const agentInfo = await getAgentWebhookInfo(delivery.agent_address);
    if (!agentInfo) {
      // Agent no longer has a webhook, mark as failed
      await updateWebhookDelivery(delivery.id, {
        status: 'failed',
        error_message: 'Agent no longer has a webhook URL',
      }).catch(() => {});
      continue;
    }

    const nextAttempt = delivery.attempt + 1;
    if (nextAttempt > delivery.max_attempts) {
      await updateWebhookDelivery(delivery.id, {
        status: 'failed',
        error_message: `Max attempts (${delivery.max_attempts}) exceeded`,
      }).catch(() => {});
      continue;
    }

    const payload = delivery.payload as unknown as WebhookPayload;
    const payloadJson = JSON.stringify(payload);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Clawboy-Webhook/1.0',
      'X-Clawboy-Event': payload.event,
    };

    if (agentInfo.webhook_secret) {
      const signature = await signPayload(payloadJson, agentInfo.webhook_secret);
      headers['X-Clawboy-Signature'] = `sha256=${signature}`;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

      const response = await fetch(agentInfo.webhook_url, {
        method: 'POST',
        headers,
        body: payloadJson,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        await updateWebhookDelivery(delivery.id, {
          status: 'delivered',
          status_code: response.status,
          attempt: nextAttempt,
          delivered_at: new Date().toISOString(),
        }).catch(() => {});
      } else {
        // Exponential backoff: 30s, 120s, 480s
        const backoffMs = 30_000 * Math.pow(4, nextAttempt - 1);
        const nextRetryAt = new Date(Date.now() + backoffMs).toISOString();

        await updateWebhookDelivery(delivery.id, {
          status: nextAttempt >= delivery.max_attempts ? 'failed' : 'pending',
          status_code: response.status,
          error_message: `HTTP ${response.status}`,
          attempt: nextAttempt,
          next_retry_at: nextRetryAt,
        }).catch(() => {});
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const backoffMs = 30_000 * Math.pow(4, nextAttempt - 1);
      const nextRetryAt = new Date(Date.now() + backoffMs).toISOString();

      await updateWebhookDelivery(delivery.id, {
        status: nextAttempt >= delivery.max_attempts ? 'failed' : 'pending',
        error_message: errorMessage,
        attempt: nextAttempt,
        next_retry_at: nextRetryAt,
      }).catch(() => {});
    }
  }
}
