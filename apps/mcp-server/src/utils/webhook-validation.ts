import { z } from 'zod';

// Block private IP ranges and localhost for SSRF protection
const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
  '10.',
  '172.16.',
  '172.17.',
  '172.18.',
  '172.19.',
  '172.20.',
  '172.21.',
  '172.22.',
  '172.23.',
  '172.24.',
  '172.25.',
  '172.26.',
  '172.27.',
  '172.28.',
  '172.29.',
  '172.30.',
  '172.31.',
  '192.168.',
  '169.254.',
];

/**
 * Check if a URL points to a blocked/private address
 */
export function isBlockedUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // Only allow HTTPS
    if (url.protocol !== 'https:') {
      return true;
    }

    // Check for blocked hosts
    const hostname = url.hostname.toLowerCase();
    for (const blocked of BLOCKED_HOSTS) {
      if (hostname === blocked || hostname.startsWith(blocked)) {
        return true;
      }
    }

    return false;
  } catch {
    return true;
  }
}

/**
 * Zod schema for validating webhook URLs with SSRF protection
 */
export const webhookUrlSchema = z
  .string()
  .max(2048, 'Webhook URL too long')
  .url('Invalid webhook URL')
  .refine((url) => !isBlockedUrl(url), {
    message: 'Webhook URL must be HTTPS and not a private address',
  });
