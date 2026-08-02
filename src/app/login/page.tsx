import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { loginAction } from "@/lib/actions/auth";

export const metadata = {
  title: "Log in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const params = await searchParams;
  const justReset = params.reset === "1";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="font-display text-3xl text-ink">
        Ajira
      </Link>
      <h1 className="mt-8 font-display text-3xl">Welcome back</h1>
      <p className="mt-2 text-ink-soft">Log in to manage projects, escrow, and payouts.</p>

      {justReset ? (
        <p className="mt-6 rounded-xl bg-[color-mix(in_srgb,var(--success)_12%,white)] px-3 py-2 text-sm text-success">
          Password updated. You can log in with your new password.
        </p>
      ) : null}

      <ActionForm action={loginAction} className="mt-8 flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input className="input" id="email" name="email" type="email" required />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between gap-3">
            <label className="label mb-0" htmlFor="password">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-sm font-semibold text-forest"
            >
              Forgot password?
            </Link>
          </div>
          <input className="input" id="password" name="password" type="password" required />
        </div>
        <button className="btn btn-primary" type="submit">
          Log in
        </button>
      </ActionForm>

      <p className="mt-6 text-sm text-ink-soft">
        New here?{" "}
        <Link href="/register" className="font-semibold text-forest">
          Create an account
        </Link>
      </p>
    </main>
  );
}
