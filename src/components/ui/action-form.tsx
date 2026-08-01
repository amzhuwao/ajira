"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/auth";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
};

export function FormMessage({ state }: { state: ActionState }) {
  if (!state?.error && !state?.success) return null;
  return (
    <p
      className={`rounded-xl px-3 py-2 text-sm ${
        state.error
          ? "bg-[color-mix(in_srgb,var(--danger)_12%,white)] text-danger"
          : "bg-[color-mix(in_srgb,var(--success)_12%,white)] text-success"
      }`}
    >
      {state.error ?? state.success}
    </p>
  );
}

export function ActionForm({ action, children, className }: Props) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className={className}>
      <FormMessage state={state} />
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {pending ? (
        <p className="text-sm text-ink-soft">Working…</p>
      ) : null}
    </form>
  );
}
