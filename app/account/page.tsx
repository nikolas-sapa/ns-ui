// §6.1a's load-bearing rule: signed-in state here comes from the server —
// `isAuthenticatedNextjs()` — never from the client-side auth-state hook.
// A27 greps `app/` for that hook's name and requires zero matches.
import Link from "next/link";
import {
  convexAuthNextjsToken,
  isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { AccountSignedOut } from "@/app/_components/account-signed-out";
import { AccountSignOut } from "@/app/_components/account-signout";
import { AccountProfileForm } from "@/app/_components/account-profile-form";
import { AccountDelete } from "@/app/_components/account-delete";
import { AccountHandle } from "@/app/_components/account-handle";
import { SavedLibrary } from "@/app/_components/saved-library";
import { TestimonialModeration } from "@/app/_components/testimonial-moderation";
// Same source `app/page.tsx:28` reads to filter FEATURED against what
// actually exists in the registry (§3's "slug gate") — not a second slug
// list. A save whose slug no longer resolves degrades silently: it's
// filtered out here, not shown as a broken link.
import registry from "@/registry.json";

export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
};

const registryItems = new Map(
  (registry as { items: { name: string; title: string; description: string }[] }).items.map(
    (i) => [i.name, i],
  ),
);

export default async function AccountPage() {
  const authed = await isAuthenticatedNextjs();

  if (!authed) {
    return <AccountSignedOut />;
  }

  const token = await convexAuthNextjsToken();
  const [viewer, profile, library] = await Promise.all([
    fetchQuery(api.users.viewer, {}, { token }),
    fetchQuery(api.profiles.mine, {}, { token }),
    fetchQuery(api.saves.library, {}, { token }),
  ]);

  // No `profiles` row yet — §8.3's abandonment case: "a `users` row exists
  // with no `profiles` row... the handle prompt reappears on the next visit
  // to any auth surface." `/account` is an auth surface.
  if (!profile?.handle) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center px-6 py-16">
        <h1 className="text-xl font-medium text-foreground">
          One more thing
        </h1>
        <p className="mt-2 text-center text-sm text-muted">
          Claim a handle to finish setting up your account.
        </p>
        <div className="mt-8">
          <Link
            href="/welcome"
            className="rounded-sm border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground outline-none transition-colors hover:border-muted focus-visible:ring-2 focus-visible:ring-accent"
          >
            Claim a handle
          </Link>
        </div>
        <div className="mt-8">
          <AccountSignOut />
        </div>
      </main>
    );
  }

  const slugs = library?.slugs ?? [];
  const bookmarks = slugs
    .map((slug) => registryItems.get(slug))
    .filter((item): item is { name: string; title: string; description: string } => item !== undefined);

  return (
    <main className="mx-auto flex max-w-5xl flex-col px-6 py-16 sm:px-10">
      <h1 className="text-xl font-medium text-foreground">Account</h1>
      <div className="mt-6 space-y-1 text-sm">
        {viewer?.displayName ? (
          <p className="text-foreground">{viewer.displayName}</p>
        ) : null}
        {viewer?.email ? <p className="text-muted">{viewer.email}</p> : null}
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-foreground">Handle</h2>
        <div className="mt-3">
          <AccountHandle
            handle={profile.handle}
            canChange={profile.handleChangedAt === null}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-foreground">Profile</h2>
        <div className="mt-3">
          <AccountProfileForm
            initial={{
              displayName: profile.displayName,
              bio: profile.bio,
              url: profile.url,
              tags: profile.tags,
            }}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-foreground">Saved ({bookmarks.length})</h2>
        <SavedLibrary items={bookmarks} slugs={slugs} initialFolders={library?.folders ?? []} handle={profile.handle} />
      </section>

      {/* Renders nothing unless the queue endpoint answers — i.e. unless this
          viewer is in OWNER_EMAILS. No owner flag is sent to the client. */}
      <TestimonialModeration />

      <div className="mt-10 flex items-center justify-between">
        <AccountSignOut />
        <AccountDelete />
      </div>
    </main>
  );
}
