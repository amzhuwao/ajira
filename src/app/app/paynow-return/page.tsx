import Link from "next/link";

export default async function PaynowReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ escrowId?: string }>;
}) {
  const { escrowId } = await searchParams;
  const href = escrowId ? `/dashboard/escrow/${escrowId}` : "/dashboard";
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-3xl">Payment return</h1>
      <p className="text-ink-soft">
        If you paid in the Ajira app, you can close this browser tab and return to the app.
        Otherwise continue on the web.
      </p>
      <Link href={href} className="btn btn-primary">
        Open escrow
      </Link>
    </main>
  );
}
