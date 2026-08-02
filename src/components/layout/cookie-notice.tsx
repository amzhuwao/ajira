"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "ajira_cookie_consent";

type Consent = "accepted" | "essential" | null;

export function CookieNotice() {
  const [consent, setConsent] = useState<Consent>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "accepted" || stored === "essential") {
        setConsent(stored);
      }
    } catch {
      // ignore
    }
    setReady(true);
  }, []);

  function save(value: Exclude<Consent, null>) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore
    }
    setConsent(value);
    window.dispatchEvent(new CustomEvent("ajira-consent", { detail: value }));
  }

  if (!ready || consent) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie notice"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-panel p-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl text-sm text-ink-soft">
          <p className="font-semibold text-ink">Cookies &amp; privacy</p>
          <p className="mt-1">
            We use essential cookies to run Ajira (login and security). If advertising is enabled,
            Google and partners may use cookies for ads measurement and personalization. See our{" "}
            <Link href="/privacy" className="text-forest underline-offset-2 hover:underline">
              Privacy Policy
            </Link>
            . You can change your mind later by clearing site data.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => save("essential")}>
            Essential only
          </button>
          <button type="button" className="btn btn-primary" onClick={() => save("accepted")}>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
