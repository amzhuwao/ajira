import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { requestPasswordResetAction } from "@/lib/actions/auth";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="font-display text-3xl text-ink">
        Ajira
      </Link>
      <h1 className="mt-8 font-display text-3xl">Forgot password</h1>
      <p className="mt-2 text-ink-soft">
        Enter your account email and we&apos;ll send a reset link if it exists.
      </p>

      <ActionForm
        action={requestPasswordResetAction}
        className="mt-8 flex flex-col gap-4"
      >
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input className="input" id="email" name="email" type="email" required />
        </div>
        <button className="btn btn-primary" type="submit">
          Send reset link
        </button>
      </ActionForm>

      <p className="mt-6 text-sm text-ink-soft">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-forest">
          Back to log in
        </Link>
      </p>
    </main>
  );
}
