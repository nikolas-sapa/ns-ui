"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Signed-in state in the site header — hydration-only, additive (§5 step 9,
 * §7.3). The server-rendered default for `/` is the signed-out affordance
 * below, which is also exactly what an anonymous visitor keeps forever, so
 * there is no flash-of-signed-out to guard against: signed-out *is* the
 * honest default (B8).
 *
 * Deliberately does not import anything Convex-shaped (B9) and never reads
 * the client auth-state hook (§6.1a, A27) — signed-in state comes from one
 * `fetch('/api/me')` after paint, mirroring `/account`'s own
 * server-derived rule but from the client side of a static page. `useMe`'s
 * empty dependency array plus mounting only from `SiteShell`'s chrome
 * branch (never the bare-preview one every catalog/featured card iframes)
 * keeps this to the one call C4 budgets — see the mount site in
 * site-shell.tsx for why that placement, not this file, is what keeps the
 * count right.
 *
 * No avatar image: `/api/me` doesn't (yet) expose one, and the provider's
 * own `users.image` is a raw github/googleusercontent URL — rendering that
 * here would be a same-origin page shipping a third-party request on every
 * load, which is exactly what the eventual avatar proxy (non-goal #12)
 * exists to prevent. An initial-letter badge instead, until that proxy
 * exists.
 */
type Me =
  | { signedIn: true; handle: string | null; displayName: string | null }
  | { signedIn: false };

function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((res) => res.json())
      .then((data: Me) => {
        if (!cancelled) setMe(data);
      })
      .catch(() => {
        if (!cancelled) setMe({ signedIn: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return me;
}

export function SiteAuth() {
  const me = useMe();

  // Nothing fetched yet, or signed out: the same "Sign in" affordance the
  // server already rendered — the identical markup is what makes B8 hold
  // rather than something this component has to work to preserve.
  if (me === null || !me.signedIn) {
    return (
      <Link
        href="/account"
        className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
      >
        Sign in
      </Link>
    );
  }

  const label = me.displayName || me.handle || "Account";

  return (
    <Link
      href="/account"
      className="flex items-center gap-1.5 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span
        aria-hidden
        className="flex size-4 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[9px] font-medium text-accent"
      >
        {label.charAt(0).toUpperCase()}
      </span>
      <span className="max-w-[8rem] truncate">{label}</span>
    </Link>
  );
}
