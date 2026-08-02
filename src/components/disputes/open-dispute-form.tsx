"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { openDisputeAction } from "@/lib/actions/disputes";
import type { ActionState } from "@/lib/actions/auth";

const TEMPLATES = [
  {
    label: "Work incomplete",
    text: "The delivered work is incomplete against the agreed brief. Specifically: ",
  },
  {
    label: "Quality issues",
    text: "The quality of the delivered work does not meet the agreed standards. Details: ",
  },
  {
    label: "Missed deadline",
    text: "The seller missed the agreed delivery timeline without an acceptable update. Details: ",
  },
  {
    label: "Scope disagreement",
    text: "There is a disagreement about the project scope and what was included in the bid. Details: ",
  },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary self-start" type="submit" disabled={pending}>
      {pending ? "Submitting…" : "Submit dispute"}
    </button>
  );
}

export function OpenDisputeForm({ escrowId }: { escrowId: string }) {
  const [reason, setReason] = useState("");
  const [state, formAction] = useActionState(openDisputeAction, {} as ActionState);
  const remaining = useMemo(() => Math.max(0, 20 - reason.trim().length), [reason]);

  return (
    <form
      action={formAction}
      className="panel mt-8 flex flex-col gap-4"
      onSubmit={(e) => {
        if (reason.trim().length < 20) {
          e.preventDefault();
          return;
        }
        if (!window.confirm("Submit this dispute? An admin will review the case.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="escrowId" value={escrowId} />
      <div>
        <p className="label">Quick templates</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              className="btn btn-ghost"
              onClick={() => setReason(t.text)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="reason">
          What went wrong?
        </label>
        <textarea
          className="textarea"
          id="reason"
          name="reason"
          required
          minLength={20}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <p className="mt-1 text-xs text-ink-soft">
          {reason.trim().length < 20
            ? `${remaining} more characters needed`
            : `${reason.trim().length} characters`}
        </p>
      </div>
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <SubmitButton />
    </form>
  );
}
