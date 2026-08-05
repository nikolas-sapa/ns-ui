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
 * Avatar image: `/api/me` exposes only `hasImage` — never the provider's
 * own `users.image` URL, which is a raw github/googleusercontent address.
 * When `hasImage` is true the badge below points an `<img>` at
 * `/api/avatar` (same-origin proxy, A26) instead of that URL; a page here
 * never ships a third-party request. `AccountBadge` falls back to the
 * initial-letter badge on load error or when there's no image at all.
 */
type Me =
  | {
      signedIn: true;
      handle: string | null;
      displayName: string | null;
      hasImage: boolean;
    }
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

// Same box either way (16px, `size-4`) — the sidebar overflow bug fixed
// earlier tonight was an element that could exceed its container, so the
// `<img>` branch gets the exact same sizing classes as the badge it
// replaces, never anything that can grow past them.
function AccountBadge({ me }: { me: Extract<Me, { signedIn: true }> }) {
  const [imgFailed, setImgFailed] = useState(false);
  const label = me.displayName || me.handle || "Account";

  if (me.hasImage && !imgFailed) {
    return (
      <img
        src="/api/avatar"
        alt=""
        width={16}
        height={16}
        className="size-4 shrink-0 rounded-full object-cover"
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className="flex size-4 shrink-0 items-center justify-center rounded-full bg-ns-accent/15 text-[9px] font-medium text-ns-accent"
    >
      {label.charAt(0).toUpperCase()}
    </span>
  );
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
        className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent transition-colors"
      >
        Sign in
      </Link>
    );
  }

  const label = me.displayName || me.handle || "Account";

  return (
    // `basis-full` drops this onto its own line under Changelog/Writing/Connect
    // (the footer row is flex-wrap in site-shell.tsx) rather than fighting them
    // for space on the first line — a long display name or email then only
    // ever has to fit the sidebar's own width, not whatever's left after three
    // fixed labels, so `min-w-0 flex-1 truncate` below is what actually clips
    // it instead of a fixed max-width that still overflowed past that point.
    <Link
      href="/account"
      title={label}
      className="flex w-full basis-full items-center gap-1.5 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent transition-colors"
    >
      <AccountBadge me={me} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </Link>
  );
}
