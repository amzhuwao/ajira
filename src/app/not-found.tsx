import Link from "next/link";
import { SiteFooter } from "@/components/layout/site-footer";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-forest">404</p>
        <h1 className="mt-3 font-display text-4xl">Page not found</h1>
        <p className="mt-3 text-ink-soft">
          That URL does not exist or may have moved. Try the homepage or browse public services.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="btn btn-primary">
            Home
          </Link>
          <Link href="/services" className="btn btn-secondary">
            Services
          </Link>
          <Link href="/contact" className="btn btn-ghost">
            Contact
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
