import Link from "next/link";

const links = [
  { href: "/about", label: "About" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/services", label: "Services" },
  { href: "/download", label: "Android app" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line px-6 py-10 text-sm text-ink-soft">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="font-display text-lg text-ink">Ajira</span>
            <p className="mt-2 max-w-sm">
              Freelance marketplace with Paynow escrow for Zimbabwe — hire, deliver, and get paid
              with clarity.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-2">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-ink">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex flex-col gap-1 border-t border-line pt-6 sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} Ajira. All rights reserved.</span>
          <span>
            Contact:{" "}
            <a href="mailto:info@ajira.online" className="text-forest">
              info@ajira.online
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
