"use client";

import { useActionState, useState } from "react";
import {
  pollWalletTopUpAction,
  topUpWalletAction,
} from "@/lib/actions/payments";
import { FormMessage } from "@/components/ui/action-form";
import type { ActionState } from "@/lib/actions/auth";

type TopUpState = ActionState & { instructions?: string; topUpId?: string };

function PollTopUpButton({ topUpId }: { topUpId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="mt-4">
      <button
        type="button"
        className="btn btn-secondary"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          const result = await pollWalletTopUpAction(topUpId);
          setMessage(result.success ?? result.error ?? null);
          setPending(false);
          if (result.success) window.location.reload();
        }}
      >
        {pending ? "Checking…" : "I've paid — check status"}
      </button>
      {message ? <p className="mt-2 text-sm text-ink-soft">{message}</p> : null}
    </div>
  );
}

export function WalletTopUpForm() {
  const [state, action, pending] = useActionState<TopUpState, FormData>(
    topUpWalletAction,
    {},
  );

  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-col gap-3">
        <FormMessage state={state} />
        <div>
          <label className="label" htmlFor="amount">
            Amount (USD)
          </label>
          <input
            className="input"
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="1"
            required
            placeholder="50"
          />
        </div>
        <div>
          <label className="label" htmlFor="channel">
            Payment method
          </label>
          <select className="select" id="channel" name="channel" defaultValue="WEB">
            <option value="WEB">Paynow web checkout</option>
            <option value="ECOCASH">Ecocash</option>
            <option value="ONEMONEY">OneMoney</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="phone">
            Phone (required for mobile money)
          </label>
          <input className="input" id="phone" name="phone" placeholder="0777…" />
        </div>
        <button className="btn btn-primary self-start" type="submit" disabled={pending}>
          {pending ? "Starting…" : "Add funds"}
        </button>
      </form>

      {state.instructions ? (
        <div className="panel border-forest/30 bg-[color-mix(in_srgb,var(--forest)_8%,white)]">
          <h3 className="font-display text-xl">Complete on your phone</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm">{state.instructions}</p>
          {state.topUpId ? <PollTopUpButton topUpId={state.topUpId} /> : null}
        </div>
      ) : null}
    </div>
  );
}
