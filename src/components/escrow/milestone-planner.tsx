"use client";

import { useMemo, useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { setMilestonesAction } from "@/lib/actions/commerce";

type Row = { title: string; amount: string; description: string };

export function MilestonePlanner({
  escrowId,
  totalAmount,
}: {
  escrowId: string;
  totalAmount: number;
}) {
  const [rows, setRows] = useState<Row[]>([
    { title: "Kickoff / discovery", amount: "", description: "" },
    { title: "Final delivery", amount: "", description: "" },
  ]);

  const json = useMemo(
    () =>
      JSON.stringify(
        rows
          .filter((r) => r.title.trim() && Number(r.amount) > 0)
          .map((r) => ({
            title: r.title.trim(),
            amount: Number(r.amount),
            description: r.description.trim() || undefined,
          })),
      ),
    [rows],
  );

  const sum = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return (
    <section className="panel mt-8">
      <h2 className="font-display text-2xl">Milestone plan</h2>
      <p className="mt-2 text-sm text-ink-soft">
        Split the escrow into phases. Amounts must total{" "}
        <strong>${totalAmount.toFixed(2)}</strong> (currently ${sum.toFixed(2)}).
      </p>
      <div className="mt-4 space-y-3">
        {rows.map((row, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-3">
            <input
              className="input"
              placeholder="Title"
              value={row.title}
              onChange={(e) => {
                const next = [...rows];
                next[index] = { ...row, title: e.target.value };
                setRows(next);
              }}
            />
            <input
              className="input"
              placeholder="Amount"
              type="number"
              step="0.01"
              value={row.amount}
              onChange={(e) => {
                const next = [...rows];
                next[index] = { ...row, amount: e.target.value };
                setRows(next);
              }}
            />
            <input
              className="input"
              placeholder="Description (optional)"
              value={row.description}
              onChange={(e) => {
                const next = [...rows];
                next[index] = { ...row, description: e.target.value };
                setRows(next);
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() =>
            setRows([...rows, { title: "", amount: "", description: "" }])
          }
        >
          Add phase
        </button>
      </div>
      <ActionForm action={setMilestonesAction} className="mt-4">
        <input type="hidden" name="escrowId" value={escrowId} />
        <input type="hidden" name="milestonesJson" value={json} />
        <button className="btn btn-secondary" type="submit">
          Save milestones
        </button>
      </ActionForm>
    </section>
  );
}
