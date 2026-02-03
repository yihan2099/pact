import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createWaitlistLimiter } from "@clawboy/rate-limit";

// Get the cached rate limiter from the shared package
const ratelimit = createWaitlistLimiter();

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

export async function middleware(request: NextRequest) {
  // Only rate limit POST requests to the waitlist action
  if (request.method === "POST" && request.nextUrl.pathname === "/") {
    const ip = getClientIp(request);

    // If rate limiter is not configured, allow the request (fail open)
    if (!ratelimit) {
      return NextResponse.next();
    }

    try {
      const result = await ratelimit.limit(`ip:${ip}`);

      if (!result.success) {
        const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
        return new NextResponse(
          JSON.stringify({
            success: false,
            message: "Too many requests. Please try again later.",
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": retryAfter.toString(),
              "X-RateLimit-Limit": result.limit.toString(),
              "X-RateLimit-Remaining": result.remaining.toString(),
              "X-RateLimit-Reset": result.reset.toString(),
            },
          }
        );
      }

      // Add rate limit headers to the response
      const response = NextResponse.next();
      response.headers.set("X-RateLimit-Limit", result.limit.toString());
      response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
      response.headers.set("X-RateLimit-Reset", result.reset.toString());
      return response;
    } catch (error) {
      // Fail open if rate limiter is unavailable
      console.error("Rate limiter error, allowing request:", error);
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
