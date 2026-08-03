"use client";

import { useActionState } from "react";
import { testPaynowGatewayAction } from "@/lib/actions/admin";
import { FormMessage } from "@/components/ui/action-form";
import type { ActionState } from "@/lib/actions/auth";

type TestState = ActionState & {
  testKind?: string;
  redirectUrl?: string;
  reference?: string;
};

export function GatewayTestPanel() {
  const [state, action, pending] = useActionState<TestState, FormData>(
    testPaynowGatewayAction,
    {},
  );

  return (
    <div className="panel space-y-4">
      <div>
        <h2 className="font-display text-2xl">Tests</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Check local crypto, readiness, or ask Paynow to accept a $1 test initiate
          (do not complete the payment).
        </p>
      </div>

      <FormMessage state={state} />

      {state.reference ? (
        <p className="text-xs text-ink-soft">Reference: {state.reference}</p>
      ) : null}

      {state.redirectUrl ? (
        <a
          href={state.redirectUrl}
          target="_blank"
          rel="noreferrer"
          className="btn btn-secondary inline-flex"
        >
          Open test checkout
        </a>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <form action={action}>
          <input type="hidden" name="kind" value="status" />
          <button className="btn btn-ghost" type="submit" disabled={pending}>
            Check status
          </button>
        </form>
        <form action={action}>
          <input type="hidden" name="kind" value="hash" />
          <button className="btn btn-secondary" type="submit" disabled={pending}>
            Test hash
          </button>
        </form>
        <form action={action}>
          <input type="hidden" name="kind" value="live" />
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Contacting Paynow…" : "Live initiate test"}
          </button>
        </form>
      </div>
    </div>
  );
}
