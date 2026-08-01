import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { loginAction } from "@/lib/actions/auth";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="font-display text-3xl text-ink">
        Ajira
      </Link>
      <h1 className="mt-8 font-display text-3xl">Welcome back</h1>
      <p className="mt-2 text-ink-soft">Log in to manage projects, escrow, and payouts.</p>

      <ActionForm action={loginAction} className="mt-8 flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input className="input" id="email" name="email" type="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
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
