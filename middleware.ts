import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

// In-memory store for rate limiting
// Note: This resets on server restart and doesn't work across multiple instances
// For production with multiple instances, use Vercel KV, Redis, or Upstash
const rateLimitStore = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 5; // 5 submissions per hour per IP

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  return "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  // Clean up expired entries periodically
  if (rateLimitStore.size > 10000) {
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(ip, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });
    return false;
  }

  if (entry.count >= MAX_REQUESTS) {
    return true;
  }

  entry.count++;
  return false;
}

function getRateLimitRemaining(ip: string): number {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || entry.resetAt < now) {
    return MAX_REQUESTS;
  }

  return Math.max(0, MAX_REQUESTS - entry.count);
}

export function middleware(request: NextRequest) {
  // Only rate limit POST requests to the waitlist action
  if (request.method === "POST" && request.nextUrl.pathname === "/") {
    const ip = getClientIp(request);

    if (isRateLimited(ip)) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          message: "Too many requests. Please try again later.",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "3600",
          },
        }
      );
    }

    // Add rate limit headers to the response
    const response = NextResponse.next();
    response.headers.set(
      "X-RateLimit-Remaining",
      getRateLimitRemaining(ip).toString()
    );
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
