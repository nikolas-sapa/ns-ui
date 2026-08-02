# Security policy

## Scope

ns-ui is a registry of React components distributed as source, plus a small
Convex backend for sign-in, saved components and profiles. `npx shadcn add`
copies a `.tsx` file into your project, so anything shipped here runs with
your application's privileges.

The registry (`/`, `/preview/*`, `/r/*.json`, `/registry.json`, `/llms.txt`)
and the CLI/MCP server that read it are fully anonymous — no account, no
cookie, no session state. `npx shadcn add` and the MCP server never require
sign-in. `/` sets no cookie and its server-rendered response is identical for
every visitor; signed-in header state, where it appears, is added in the
browser after paint from a single `/api/me` call, not baked into the page.

Reports that matter here:

- A component that executes untrusted input (`dangerouslySetInnerHTML`,
  `eval`, unsanitized URL handling, injection through a prop).
- A supply-chain problem: a compromised or typosquatted dependency listed in a
  component's `meta.json`.
- A flaw in the registry JSON served from `design.helpmarq.com` that could
  cause `shadcn add` to install something other than what the repo contains.
- Anything in the preview site (`app/`) that could be used against a visitor,
  including the accounts feature described below: session handling, access
  control on `/api/me` and `/api/saves`, or a way to read or modify another
  user's data.

Out of scope: findings against the demo content itself, missing headers on
the preview site that have no exploit path, and automated scanner output with
no demonstrated impact.

## Accounts, sessions and data

Sign-in is via `@convex-dev/auth`: GitHub, Google, or an emailed one-time
code. No passwords are stored.

**What's stored, in plain terms.** For every account: an email address (for
OTP sign-in) or provider identity (for GitHub/Google), plus the tokens and
session records `@convex-dev/auth` needs to keep you signed in. If you set up
a profile: a display name, an optional bio and link, and up to three category
tags. If you save components: which ones, and which collections you put them
in. Two more tables exist purely to rate-limit abuse and hold no personal
data on their own: a salted, non-reversible hash of any email address that
requests a sign-in code, and a per-user counter for save requests.

Concretely, the tables involved are `users`, `authAccounts`, `authSessions`,
`authRefreshTokens`, `authVerificationCodes`, `authVerifiers` and
`authRateLimits` (all from `@convex-dev/auth`), plus this project's own
`profiles`, `saves`, `collections`, `collectionItems`, `otpRequestLimits` and
`saveRateLimits`.

**Sessions live in a cookie, never in browser storage.** On the deployed
site the session cookie is `__Host-__convexAuthJWT` (plus a
`__Host-__convexAuthRefreshToken` for renewal): `HttpOnly`, `Secure`,
`SameSite=Lax`, no `Domain`. A local/dev run does not get the `__Host-`
prefix or `Secure` flag — that gate is intentional and only the deployed
cookie is the one that matters for this policy. The auth client is also
configured with in-memory token storage rather than `localStorage`, and this
has been checked directly against a signed-in session: zero `localStorage`
keys. This matters more here than on a typical site — component previews on
this origin render as same-origin iframes with no `sandbox` attribute, so a
token sitting in `localStorage` would be readable by any component code
running on the page. Keeping the token out of any storage a same-origin
script can read is why this design was chosen over the more common approach.

**Everything you create is private until you publish it.** A profile, a
save, or a collection is invisible to everyone but its owner from the moment
it's created — `isPublic` defaults to false at the database level, not just
in the UI, so a missed check in a future feature can't expose it. There is no
public profile page yet; account features currently ship without one. When
one is added, an unpublished or never-created profile will return the same
404 as a handle nobody has claimed, specifically so the page can't be used to
enumerate who has an account.

**Avatars are never fetched from a third party in your browser.** Right now
the site doesn't render a provider avatar at all (an initial-letter badge is
shown instead); avatar images are not user-uploaded and never will be. If a
provider avatar is shown in the future, it will be proxied through this
origin rather than linked directly, so viewing a profile never sends your IP
to GitHub or Google.

**Rate limits are enforced server-side, inside the transaction that would
otherwise do the write.** Sign-in code requests are capped per email address;
saving or removing a component is capped per account. Both checks run inside
the same Convex mutation as the operation they guard, so there's no window
between "checked" and "written" for a concurrent request to slip through.

**What a leaked session gets an attacker:** your profile (including anything
you've kept private), your saves and collections — read, add, remove,
publish or unpublish — and your display name, bio, link and tags. It does
not reach component source (already public), cannot open a pull request on
your behalf, and cannot reach another account.

**Account deletion is not implemented yet.** Convex has no cascading
deletes, so removing an account cleanly requires an explicit mutation that
deletes every table that holds a row for that account. That mutation is
specified but not built.

## A known weakness in the auth library, and how we've compensated

The installed version of `@convex-dev/auth` (0.0.94) has a verification
weakness in its email one-time-code flow. We're not publishing the mechanism
here — for an open-source library other projects also depend on, the
mechanism is most of the finding — but we've compensated by hardening what
we control: sign-in codes are 8 digits with a 5-minute lifetime, deliberately
stricter than this project's own baseline and than the reference
implementation this flow was adapted from. This is a private-report
situation; as of this writing we have not yet completed that report to the
Convex team, and we will not publish further detail before they've had a
chance to respond. If you've independently found the same issue, please
report it to us privately rather than filing it publicly against this repo —
see Reporting below — and we'll coordinate with upstream.

## Reporting

Report privately. Do not open a public issue for a vulnerability.

- Preferred: GitHub's private reporting, via the Security tab on
  https://github.com/nikolas-sapa/ns-ui (Report a vulnerability).
- Otherwise: nikolas.sapalidis@gmail.com.

Include the component name (or route/endpoint), the version or commit you
tested, and a minimal reproduction.

## What to expect

This is a single-maintainer, personal open-source project — not a company
with an SLA. Response is best effort. Expect an acknowledgement within a
week. Valid reports are fixed on `main` and, since the registry and account
features are served from `main`, published on the next deploy. You will be
credited in the changelog unless you would rather not be.

## Supported versions

Only the current `main` is supported. There are no maintained release
branches; a fix ships forward.
