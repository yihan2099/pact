import { z } from "zod";

// Block private IP ranges and localhost for SSRF protection
const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "10.",
  "172.16.",
  "172.17.",
  "172.18.",
  "172.19.",
  "172.20.",
  "172.21.",
  "172.22.",
  "172.23.",
  "172.24.",
  "172.25.",
  "172.26.",
  "172.27.",
  "172.28.",
  "172.29.",
  "172.30.",
  "172.31.",
  "192.168.",
  "169.254.",
];

function isBlockedUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // Only allow HTTPS
    if (url.protocol !== "https:") {
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

export const waitlistSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .max(254, "Email too long")
    .email("Invalid email")
    .transform((email) => email.trim().toLowerCase()),
  webhookUrl: z
    .string()
    .max(2048, "URL too long")
    .url("Invalid URL")
    .refine((url) => !isBlockedUrl(url), {
      message: "Invalid webhook URL. Must be HTTPS and not a private address.",
    })
    .optional()
    .or(z.literal("")),
});

export type WaitlistInput = z.infer<typeof waitlistSchema>;
