import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { registerAction } from "@/lib/actions/auth";

export const metadata = { title: "Create account" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const params = await searchParams;
  const defaultRole = params.role === "SELLER" ? "SELLER" : "BUYER";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="font-display text-3xl text-ink">
        Ajira
      </Link>
      <h1 className="mt-8 font-display text-3xl">Join Ajira</h1>
      <p className="mt-2 text-ink-soft">
        Create a buyer or seller account. Escrow and Paynow handle the rest.
      </p>

      <ActionForm action={registerAction} className="mt-8 flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="name">
            Full name
          </label>
          <input className="input" id="name" name="name" required />
        </div>
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input className="input" id="email" name="email" type="email" required />
        </div>
        <div>
          <label className="label" htmlFor="phone">
            Phone (for mobile money)
          </label>
          <input className="input" id="phone" name="phone" placeholder="0777…" />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input className="input" id="password" name="password" type="password" minLength={8} required />
        </div>
        <div>
          <label className="label" htmlFor="role">
            I want to
          </label>
          <select className="select" id="role" name="role" defaultValue={defaultRole}>
            <option value="BUYER">Hire freelancers</option>
            <option value="SELLER">Find work</option>
          </select>
        </div>
        <button className="btn btn-primary" type="submit">
          Create account
        </button>
      </ActionForm>

      <p className="mt-6 text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-forest">
          Log in
        </Link>
      </p>
    </main>
  );
}
