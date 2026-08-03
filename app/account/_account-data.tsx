// Data-dependent body of `/account`, split out so `page.tsx` can wrap it in
// a `Suspense` boundary. Everything here awaits the three Convex round
// trips (`api.users.viewer`, `api.profiles.mine`, `api.saves.library`);
// nothing before this point in the tree does. Auth state (`isAuthenticatedNextjs`,
// §6.1a) stays in `page.tsx`, server-side, ahead of this boundary.
import Link from "next/link";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
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

const registryItems = new Map(
  (registry as { items: { name: string; title: string; description: string }[] }).items.map(
    (i) => [i.name, i],
  ),
);

export async function AccountData() {
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
    <main className="mx-auto flex max-w-6xl flex-col px-6 py-16 sm:px-10">
      <h1 className="text-xl font-medium text-foreground">Account</h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,320px)_1fr] lg:gap-14">
        <div className="flex flex-col gap-8">
          <div className="space-y-1 text-sm">
            {viewer?.displayName ? (
              <p className="text-foreground">{viewer.displayName}</p>
            ) : null}
            {viewer?.email ? <p className="text-muted">{viewer.email}</p> : null}
          </div>

          <section>
            <h2 className="text-sm font-medium text-foreground">Handle</h2>
            <div className="mt-3">
              <AccountHandle
                handle={profile.handle}
                canChange={profile.handleChangedAt === null}
              />
            </div>
          </section>

          <section>
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
        </div>

        <div className="flex flex-col gap-8">
          <section>
            <h2 className="text-sm font-medium text-foreground">Saved ({bookmarks.length})</h2>
            <SavedLibrary items={bookmarks} slugs={slugs} initialFolders={library?.folders ?? []} handle={profile.handle} />
          </section>

          {/* Renders nothing unless the queue endpoint answers — i.e. unless
              this viewer is in OWNER_EMAILS. No owner flag is sent to the
              client. */}
          <TestimonialModeration />
        </div>
      </div>

      <div className="mt-12 flex items-center justify-between border-t border-border pt-6">
        <AccountSignOut />
        <AccountDelete />
      </div>
    </main>
  );
}
