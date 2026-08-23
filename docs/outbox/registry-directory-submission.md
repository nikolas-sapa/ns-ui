# registry.directory submission — status

**SUBMITTED 2026-08-23** · id `design-helpmarq-com-r-registry-json-92897737` · status `pending`

registry.directory takes a single `POST /api/submit` — no account, no fork, no PR
(contract: <https://registry.directory/how-to-submit.md>). A maintainer's agent audits the
submission by fetching `registry.json` and several item URLs and checking they resolve with
real `files[].content`; a human makes the final call. Review takes a few days.

## What was sent

```json
{
  "name": "ns-ui",
  "description": "389 self-contained React components for Tailwind v4 and React 19, each built around a single interaction and gated by a screenshot suite. Ships a CLI and an MCP server.",
  "url": "https://design.helpmarq.com",
  "registry_url": "https://design.helpmarq.com/r/registry.json",
  "github_url": "https://github.com/nikolas-sapa/ns-ui",
  "github_profile": "https://github.com/nikolas-sapa.png",
  "featured": ["background-ascii-plasma", "gallery-coverflow-caustic", "ascii-torus-donut", "hero-particles-webgl", "hero-ascii-tunnel"]
}
```

`namespace` was deliberately omitted. The field is only legal once the registry is listed in
the official shadcn registry index, and that PR (`docs/outbox/shadcn-directory-pr.md`,
shadcn-ui/ui#11362) is still open — claiming it early is a 422.

## Updating it

Updates need the `submission_token` from the creation response as an
`Authorization: Bearer` header; it was shown exactly once and is NOT in this repo —
it lives in `~/scratch/registry-directory-submission.json` on the owner's machine.
Without it the pending submission is still reviewed as-is, it just cannot be edited.

Why it matters: an agent-readiness audit found `design.helpmarq.com` absent from a plain
"ns-ui" search, and the cause is that nothing on the web links to the subdomain. Directory
listings and the npm package pages are the first inbound links.
