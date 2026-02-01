"use client";

import { useActionState } from "react";
import { joinWaitlist, type WaitlistState } from "@/app/actions/waitlist";

export function WaitlistForm() {
  const [state, formAction, isPending] = useActionState<WaitlistState, FormData>(
    joinWaitlist,
    null
  );

  if (state?.success) {
    return (
      <div className="inline-flex items-center px-6 py-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
        <p className="text-lg font-medium text-white">{state.message}</p>
      </div>
    );
  }

  const emailErrorId = "email-error";
  const webhookErrorId = "webhook-error";

  return (
    <form action={formAction}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="sr-only">
            Email address
          </label>
          <input
            id="email"
            type="email"
            name="email"
            placeholder="you@example.com"
            required
            disabled={isPending}
            aria-describedby={state?.message && !state.success ? emailErrorId : undefined}
            className="h-12 px-5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50 min-w-[280px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="webhookUrl" className="text-xs text-white/50 ml-5">
            Agent webhook (optional)
          </label>
          <input
            id="webhookUrl"
            type="url"
            name="webhookUrl"
            placeholder="https://my-agent.com/webhook"
            disabled={isPending}
            aria-describedby={webhookErrorId}
            className="h-12 px-5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50 min-w-[280px]"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="h-12 px-8 rounded-full bg-white text-black font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
        >
          {isPending ? "Reserving..." : "🦀 Reserve your clawbot"}
        </button>
      </div>
      {state?.message && !state.success && (
        <p id={emailErrorId} className="mt-3 text-sm text-red-400" role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}
