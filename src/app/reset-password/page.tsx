import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { resetPasswordAction } from "@/lib/actions/auth";

export const metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token?.trim() ?? "";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="font-display text-3xl text-ink">
        Ajira
      </Link>
      <h1 className="mt-8 font-display text-3xl">Choose a new password</h1>
      <p className="mt-2 text-ink-soft">
        Pick a strong password of at least 8 characters.
      </p>

      {!token ? (
        <div className="mt-8 space-y-4">
          <p className="rounded-xl bg-[color-mix(in_srgb,var(--danger)_12%,white)] px-3 py-2 text-sm text-danger">
            This reset link is missing or incomplete. Request a new one.
          </p>
          <Link href="/forgot-password" className="btn btn-primary inline-flex">
            Request reset link
          </Link>
        </div>
      ) : (
        <ActionForm
          action={resetPasswordAction}
          className="mt-8 flex flex-col gap-4"
        >
          <input type="hidden" name="token" value={token} />
          <div>
            <label className="label" htmlFor="password">
              New password
            </label>
            <input
              className="input"
              id="password"
              name="password"
              type="password"
              minLength={8}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="confirmPassword">
              Confirm password
            </label>
            <input
              className="input"
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              minLength={8}
              required
            />
          </div>
          <button className="btn btn-primary" type="submit">
            Update password
          </button>
        </ActionForm>
      )}

      <p className="mt-6 text-sm text-ink-soft">
        <Link href="/login" className="font-semibold text-forest">
          Back to log in
        </Link>
      </p>
    </main>
  );
}
