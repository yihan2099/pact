'use client';

import { useActionState } from 'react';
import { subscribeNewsletter, type NewsletterState } from '@/app/actions/newsletter';

export function NewsletterForm() {
  const [state, formAction, isPending] = useActionState<NewsletterState, FormData>(
    subscribeNewsletter,
    null
  );

  if (state?.success) {
    return (
      <div className="inline-flex items-center px-6 py-3 rounded-full bg-card backdrop-blur-sm border border-border">
        <p className="text-lg font-medium text-foreground">{state.message}</p>
      </div>
    );
  }

  const emailErrorId = 'email-error';

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
            className="h-12 px-5 rounded-full bg-card backdrop-blur-sm border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 w-full sm:min-w-[280px]"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="h-12 px-8 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isPending ? 'Subscribing...' : 'Subscribe'}
        </button>
      </div>
      {state?.message && !state.success && (
        <p id={emailErrorId} className="mt-3 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}
