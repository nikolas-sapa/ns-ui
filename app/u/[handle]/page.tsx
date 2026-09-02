// `/u/<handle>` — the public profile page, Phase B (docs/community-spec.md
// §8.1, moved here from Phase A 2026-08-01 because there is no publish
// control without it).
//
// Hard invariants, not stylistic choices:
// - PRIVATE BY DEFAULT. `convex/profiles.ts`'s `publicProfile` returns
//   `null` for a profile that hasn't published anything AND for a handle
//   nobody has claimed — same shape either way. `notFound()` on `null` is
//   what turns that into A18's byte-identical 404: never render a
//   "this user exists but is private" state, that's a handle-enumeration
//   oracle non-goal #8 forbids.
// - NEVER reads a cookie. No `isAuthenticatedNextjs()`, no
//   `convexAuthNextjsToken()`, nothing from `next/headers`. This route is
//   deliberately absent from `proxy.ts`'s matcher (§6.4) — the middleware
//   allowlist is the enforcement, this file not calling any cookie-reading
//   API is what keeps that true. B10: no set-cookie, no vary: cookie.
// - Renders only what `publicProfile` returns: handle, display name, bio,
//   url, tags, and the slugs inside PUBLISHED collections. Never email,
//   never saves outside a published collection, never anything else off the
//   `profiles` row.
// - `saves` has no visibility field at all (§8.1) — this page can only ever
//   show collections, never bare saves.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { CATEGORIES } from "@/lib/search-categories";
// Same source every other page filters saved/featured slugs against (§3's
// "slug gate") — not a second list. A component renamed or removed out from
// under a published collection degrades silently: it's dropped here, not
// shown as a broken link.
import registry from "@/registry.json";

export const dynamic = "force-dynamic";

const registryItems = new Map(
  (registry as { items: { name: string; title: string; description: string }[] }).items.map(
    (item) => [item.name, item],
  ),
);

const CATEGORY_LABELS = new Map(CATEGORIES.map((c) => [c.id, c.label]));

async function loadProfile(handle: string) {
  return fetchQuery(api.profiles.publicProfile, { handle });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const profile = await loadProfile(handle);
  if (!profile) return {};
  const title = `${profile.displayName ?? profile.handle} (@${profile.handle}) · ns-ui`;
  const description = profile.bio ?? `@${profile.handle} on ns-ui.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "profile" },
    twitter: { card: "summary", title, description },
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const profile = await loadProfile(handle);
  // A18: this is the ONLY branch — no distinguishable "private" state.
  if (!profile) notFound();

  return (
    <main className="mx-auto flex max-w-3xl flex-col px-6 py-16 sm:px-10">
      <div className="flex items-center gap-4">
        {/* Always same-origin (§8.2/A26) — never the provider's own host. A
            handle with no provider avatar (OTP sign-in) 404s at the route
            itself and the <img> falls back to nothing rendering, not a
            broken-image icon, since the route below returns an empty 404
            body rather than a placeholder. */}
        {/* Proxied, non-Next-optimized bytes — same choice as
            app/_components/site-auth.tsx's own avatar <img>, and for the
            same reason: this origin is fetching and re-serving the bytes
            itself, so next/image's remote-loader story doesn't apply. */}
        <img
          src={`/u/${encodeURIComponent(profile.handle)}/avatar`}
          alt=""
          width={64}
          height={64}
          className="h-16 w-16 rounded-full border border-border bg-surface object-cover"
        />
        <div>
          <h1 className="text-lg font-medium text-foreground">
            {profile.displayName ?? profile.handle}
          </h1>
          <p className="font-mono text-xs text-ns-muted">@{profile.handle}</p>
        </div>
      </div>

      {profile.bio ? (
        <p className="mt-6 max-w-xl whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {profile.bio}
        </p>
      ) : null}

      {profile.url ? (
        <a
          href={profile.url}
          rel="noopener noreferrer nofollow ugc"
          target="_blank"
          className="mt-3 inline-block w-fit rounded-sm text-sm text-ns-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ns-accent"
        >
          {profile.url}
        </a>
      ) : null}

      {profile.tags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {profile.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-foreground"
            >
              {CATEGORY_LABELS.get(tag) ?? tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-12 space-y-10">
        {profile.collections.length === 0 ? (
          <p className="text-sm text-ns-muted">Nothing published yet.</p>
        ) : (
          profile.collections.map((collection) => {
            const items = collection.slugs
              .map((slug) => registryItems.get(slug))
              .filter((item): item is { name: string; title: string; description: string } => item !== undefined);
            return (
              <section key={collection.name}>
                <h2 className="text-sm font-medium text-foreground">{collection.name}</h2>
                {items.length === 0 ? (
                  <p className="mt-3 text-sm text-ns-muted">Nothing in this folder.</p>
                ) : (
                  <ul className="mt-4 grid gap-5 sm:grid-cols-2">
                    {items.map((item) => (
                      <li
                        key={item.name}
                        className="overflow-hidden rounded-md border border-border bg-surface"
                      >
                        <Link
                          href={`/components/${item.name}`}
                          className="group block outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ns-accent"
                        >
                          <div className="px-4 py-5 transition-colors group-hover:bg-foreground/[0.03]">
                            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ns-muted">
                              ns-ui component
                            </p>
                            <h3 className="mt-2 text-sm font-semibold tracking-tight text-foreground">
                              {item.title}
                            </h3>
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ns-muted">
                              {item.description}
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })
        )}
      </div>
    </main>
  );
}
