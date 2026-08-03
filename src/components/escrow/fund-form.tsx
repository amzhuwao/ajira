"use client";

import { useActionState, useState, useTransition } from "react";
import {
  fundEscrowAction,
  fundEscrowFromWalletAction,
  pollEscrowPaymentAction,
} from "@/lib/actions/payments";
import { FormMessage } from "@/components/ui/action-form";
import type { ActionState } from "@/lib/actions/auth";
import { formatMoney } from "@/lib/utils";

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
          if (result.success) window.location.reload();
        }}
      >
        {pending ? "Checking…" : "I've paid — check status"}
      </button>
      {message ? <p className="mt-2 text-sm text-ink-soft">{message}</p> : null}
    </div>
  );
}

export function FundEscrowForm({
  escrowId,
  amount,
  walletBalance,
}: {
  escrowId: string;
  amount: number;
  walletBalance: number;
}) {
  const [state, action, pending] = useActionState<FundState, FormData>(
    fundEscrowAction,
    {},
  );
  const [walletMsg, setWalletMsg] = useState<string | null>(null);
  const [walletPending, startWallet] = useTransition();
  const canUseWallet = walletBalance >= amount;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--line)] bg-[color-mix(in_srgb,var(--sand)_40%,white)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-ink-soft">Wallet balance</p>
            <p className="font-display text-2xl">{formatMoney(walletBalance)}</p>
            {!canUseWallet ? (
              <p className="mt-1 text-sm text-ink-soft">
                Need {formatMoney(amount)}.{" "}
                <a href="/dashboard/wallet" className="text-forest">
                  Top up wallet
                </a>
              </p>
            ) : (
              <p className="mt-1 text-sm text-ink-soft">
                Pay {formatMoney(amount)} from prepaid balance.
              </p>
            )}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canUseWallet || walletPending}
            onClick={() => {
              startWallet(async () => {
                const result = await fundEscrowFromWalletAction(escrowId);
                setWalletMsg(result.success ?? result.error ?? null);
                if (result.success) window.location.reload();
              });
            }}
          >
            {walletPending ? "Funding…" : "Fund from wallet"}
          </button>
        </div>
        {walletMsg ? <p className="mt-2 text-sm text-ink-soft">{walletMsg}</p> : null}
      </div>

      <div>
        <h3 className="font-display text-xl">Or pay with Paynow</h3>
        <p className="mt-1 text-sm text-ink-soft">
          Direct checkout — does not use your prepaid balance.
        </p>
        <form action={action} className="mt-4 flex flex-col gap-4">
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
          <button className="btn btn-secondary self-start" type="submit" disabled={pending}>
            {pending ? "Starting payment…" : "Fund via Paynow"}
          </button>
        </form>

        {state.instructions ? (
          <div className="panel mt-4 border-forest/30 bg-[color-mix(in_srgb,var(--forest)_8%,white)]">
            <h3 className="font-display text-xl">Complete on your phone</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm">{state.instructions}</p>
            {state.paymentId ? <PollButton paymentId={state.paymentId} /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
