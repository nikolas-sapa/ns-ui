// §6.1a's load-bearing rule: signed-in state here comes from the server —
// `isAuthenticatedNextjs()` — never from the client-side auth-state hook.
// A27 greps `app/` for that hook's name and requires zero matches.
import {
  convexAuthNextjsToken,
  isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { AccountSignIn } from "@/app/_components/account-signin";
import { AccountSignOut } from "@/app/_components/account-signout";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const authed = await isAuthenticatedNextjs();

  if (!authed) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center px-6 py-16">
        <h1 className="text-xl font-medium text-foreground">Sign in</h1>
        <p className="mt-2 text-center text-sm text-muted">
          GitHub, Google, or an email code.
        </p>
        <div className="mt-8">
          <AccountSignIn />
        </div>
      </main>
    );
  }

  const token = await convexAuthNextjsToken();
  const viewer = await fetchQuery(api.users.viewer, {}, { token });

  return (
    <main className="mx-auto flex max-w-md flex-col px-6 py-16">
      <h1 className="text-xl font-medium text-foreground">Account</h1>
      <div className="mt-6 space-y-1 text-sm">
        {viewer?.displayName ? (
          <p className="text-foreground">{viewer.displayName}</p>
        ) : null}
        {viewer?.email ? <p className="text-muted">{viewer.email}</p> : null}
      </div>
      <div className="mt-8">
        <AccountSignOut />
      </div>
    </main>
  );
}
