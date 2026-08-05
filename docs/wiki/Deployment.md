# Deployment

The site deploys to Vercel. **The Convex backend deploys with it** — there is
no separate Convex deploy step.

## The build command

`vercel.json`:

```json
{
  "buildCommand": "npx convex deploy --cmd 'npm run build'",
  "crons": [{ "path": "/api/status-snapshot", "schedule": "0 6 * * *" }]
}
```

`npx convex deploy` pushes the Convex functions and then runs the inner
command, so the site build and the backend it talks to ship from the same
commit. Any documentation that says Convex must be deployed separately is out
of date.

Note the wrapper is in `vercel.json`, not in `package.json`. `npm run build`
on its own is still `registry:build && next build` and never touches Convex.
So the drift this closes can still occur if a build runs outside `vercel.json`
— which is why `scripts/test-convex-deployed.ts` exists as a check rather than
being retired. See [Quality gates](Quality-gates).

Pushing to `main` triggers a production deploy.

## What the build does

`npm run build` is `npm run registry:build && next build`. The full generation
chain therefore runs on every deploy — see [Architecture](Architecture).

This is load bearing rather than incidental: `.vercelignore` excludes
`registry.json`, `public/r/**`, `public/llms*.txt` and `lib/*.generated.json`
from the source upload, so those paths **do not exist** on Vercel until the
chain has run. `lib/status.generated.json` is consumed by a static `import` in
`app/status/page.tsx`, never an fs read at runtime, for the same reason.

## `/status`

`app/status/page.tsx` renders two layers.

**Live reads, taken for that render.** `lib/status-checks.ts` fetches the
production origin's component count, the published CLI and MCP versions from
npm, and probes Convex. The banner states the worst state among those reads
and nothing else.

**Ninety days of recorded daily bars.** Drawn purely from snapshots recorded
in Convex. Nothing is seeded and nothing is backfilled: a day with no row
renders as an inert grey "no data" bar, which is the correct render for every
day before recording began. An uptime figure only appears once there is at
least one recorded day to compute it from, with its denominator printed next
to it.

`lib/status.generated.json` supplies the build-time measurements (component
counts, payload/screenshot/meta/poster/preview coverage, redirect pairs, the
versions the deploy was built against). It is measured by
`scripts/build-status.ts`, which runs last in the chain because it measures
the other scripts' output.

## The snapshot pollers

Two callers write samples, via `POST /api/status-snapshot`:

| Caller | Schedule | Role |
|---|---|---|
| `.github/workflows/status-poll.yml` | `*/10 * * * *` | The frequent sampler. |
| `vercel.json` cron | `0 6 * * *` | Once-a-day fallback, so a day GitHub skipped is not a blank day. |

**The 10-minute figure is a request, not a guarantee, and the repo is emphatic
about this.** GitHub's documented minimum interval for `schedule` is 5
minutes, scheduled workflows run on shared infrastructure and are commonly
delayed at peak, a run can be dropped rather than queued, and GitHub disables
schedules on repositories with no activity for 60 days. The real gap between
two samples is unbounded. The comment blocks in both the workflow and the
route state that no copy anywhere may describe this as continuous monitoring,
a heartbeat, or a 10-minute guarantee. The only truthful record of how much
was measured on a given day is that row's `sampleCount`.

Each call takes one measurement per service and adds it to that UTC day's row;
the row stays one bar per `(day, service)` however often it runs, so calling
it again by hand is safe. The workflow deliberately does not use `curl
--retry`: a retry after a response it never saw would count one measurement
twice.

A check that cannot determine its state writes **nothing** — the day stays
absent for that service. Every fetch in the route is `cache: "no-store"`
rather than the shared helpers in `lib/status-checks.ts`, which pass
`next: { revalidate: 3600 }`; reusing those in a scheduled job could stamp an
hour-old value with this moment's timestamp.

## Environment variables

Names only. Values are never written in the repo, in CI config, or here.
`.env.example` is the committed template and documents each one; copy it to
`.env` locally.

| Variable | Where it must be set |
|---|---|
| `NEXT_PUBLIC_REGISTRY_ORIGIN` | Optional. Overrides the `design.helpmarq.com` default in `lib/registry-origin.ts`. |
| `NEXT_PUBLIC_CONVEX_URL` | Next runtime. Required by the account surfaces (`/submit`, `/account`, `/welcome`, `/u/<handle>`, the routes under `app/api/...`). No default; unset, those surfaces crash in the browser. The component pages do not read it. |
| `EMAILOCTOPUS_API_KEY`, `EMAILOCTOPUS_LIST_ID` | Next runtime, server-only. The email capture form degrades to an error state if either is unset. |
| `OWNER_EMAILS` | Convex deployment. Fails closed when empty. |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | **Two places.** The same GitHub OAuth App credentials are needed on the Next runtime (for `/submit`'s handshake) and on the Convex deployment (for sign-in). A missing copy on the Next side breaks only the submission portal, not sign-in. |
| `SUBMIT_TOKEN_BINDING_SECRET` | Next runtime. Required — `/api/submit/github/callback` and `/api/submit` both fail closed without it. |
| `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`, `GITHUB_DEFAULT_BRANCH` | Optional. Default to this repo from `package.json`; only needed for a fork or staging deployment. |
| `CRON_SECRET` | **Two places with the same value:** the Vercel project (Production), and as a GitHub repository secret for the poll workflow. Vercel Cron sends it as `Authorization: Bearer <CRON_SECRET>`; the route rejects a mismatch. |
| `STATUS_SNAPSHOT_SECRET` | **Two places with the same value:** the Next runtime and the Convex deployment. |

The two status secrets are not redundant. `CRON_SECRET` gates the route.
`STATUS_SNAPSHOT_SECRET` gates the Convex `status.record` mutation itself,
which is a public internet-facing endpoint (`NEXT_PUBLIC_CONVEX_URL` is in the
client bundle) that the route's guard does not stand in front of. Without the
second check anyone holding the deployment URL could forge uptime history.
Both fail closed: an unset or empty secret means nobody can write.

`status.record` derives the day from the server clock rather than trusting the
caller, so even a leaked secret cannot rewrite the past.

The poll workflow also reads an optional repository **variable**,
`STATUS_SNAPSHOT_URL`, to point at a different deployment; it defaults to
production.
