# Security policy

## Scope

ns-ui is a registry of React components distributed as source. There is no
backend, no database, and no user data. `npx shadcn add` copies a `.tsx` file
into your project, so anything shipped here runs with your application's
privileges.

Reports that matter here:

- A component that executes untrusted input (`dangerouslySetInnerHTML`,
  `eval`, unsanitized URL handling, injection through a prop).
- A supply-chain problem: a compromised or typosquatted dependency listed in a
  component's `meta.json`.
- A flaw in the registry JSON served from `design.helpmarq.com` that could
  cause `shadcn add` to install something other than what the repo contains.
- Anything in the preview site (`app/`) that could be used against a visitor.

Out of scope: findings against the demo content itself, missing headers on the
preview site that have no exploit path, and automated scanner output with no
demonstrated impact.

## Reporting

Report privately. Do not open a public issue for a vulnerability.

- Preferred: GitHub's private reporting, via the Security tab on
  https://github.com/nikolas-sapa/ns-ui (Report a vulnerability).
- Otherwise: nikolas.sapalidis@gmail.com.

Include the component name, the version or commit you tested, and a minimal
reproduction.

## What to expect

This is a single-maintainer project, so response is best effort rather than
contractual. Expect an acknowledgement within a week. Valid reports are fixed
on `main` and, since the registry is served from `main`, published on the next
deploy. You will be credited in the changelog unless you would rather not be.

## Supported versions

Only the current `main` is supported. There are no maintained release
branches; a fix ships forward.
