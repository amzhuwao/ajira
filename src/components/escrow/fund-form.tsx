"use client";

import { useActionState, useState } from "react";
import {
  fundEscrowAction,
  pollEscrowPaymentAction,
} from "@/lib/actions/payments";
import { FormMessage } from "@/components/ui/action-form";
import type { ActionState } from "@/lib/actions/auth";

type FundState = ActionState & { instructions?: string; paymentId?: string };

function PollButton({ paymentId }: { paymentId: string }) {
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
          const result = await pollEscrowPaymentAction(paymentId);
          setMessage(result.success ?? result.error ?? null);
          setPending(false);
          if (result.success) {
            window.location.reload();
          }
        }}
      >
        {pending ? "Checking…" : "I've paid — check status"}
      </button>
      {message ? <p className="mt-2 text-sm text-ink-soft">{message}</p> : null}
    </div>
  );
}

export function FundEscrowForm({ escrowId }: { escrowId: string }) {
  const [state, action, pending] = useActionState<FundState, FormData>(
    fundEscrowAction,
    {},
  );

  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-col gap-4">
        <FormMessage state={state} />
        <input type="hidden" name="escrowId" value={escrowId} />
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
          {pending ? "Starting payment…" : "Fund escrow"}
        </button>
      </form>

      {state.instructions ? (
        <div className="panel border-forest/30 bg-[color-mix(in_srgb,var(--forest)_8%,white)]">
          <h3 className="font-display text-xl">Complete on your phone</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm">{state.instructions}</p>
          {state.paymentId ? <PollButton paymentId={state.paymentId} /> : null}
        </div>
      ) : null}
    </div>
  );
}
