---
source: https://openhack.com
kind: site
cohort: yc-current
context: [hero, nav, cta]
verdict: slop
studied: 2026-10-10
materials: [single-theme]
signals:
  gradient-blob: present
  three-card-row: unresolved
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: present
  symmetric-everything: present
  badge-pill-spam: absent
  generic-line-icon-set: unresolved
  testimonial-card-row: unresolved
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: present
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: present
  hero-mockup-float: present
  asymmetric-split: absent
  single-optical-anchor: absent
  type-scale-high-contrast: absent
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: present
  shows-deliverable: absent
  density-variation: absent
  one-accent-discipline: present
  live-claim-control: absent
---
AI security scanning, YC F26. This is the reference rendering of the current
template, and worth filing precisely because nothing about it is distinctive.

The hero is a centre-stacked column on a near-black field: two-line headline with
the second line ("AI Security Engineer.") in gold, three centred lines of body copy
at a narrow measure, then two centred buttons side by side (filled white "Book a
demo", outlined "Get started"). Every element shares one centre axis, including the
dashboard that follows. Nothing sits off-axis anywhere above the fold.

Behind the headline, a soft radial bloom: amber at the top right, a cooler teal
wash at the top left, both fading to black before they reach the copy.

Type is a neo-grotesque at default tracking across the whole hero, headline and
body in the same family and the same weight class. Headline to body is roughly
56px against 16px, which is a conventional ratio rather than a deliberate jump,
and there is no second family anywhere.

The product screenshot is real and is the best thing on the page: an org/project
switcher, a left rail of thirteen named sections, a findings sparkline, a severity
breakdown reading "277 total findings · 34 critical · 84 high", and a recent-scans
list with per-scan timestamps and severity chips. That content is specific. Its
presentation, a flat rounded rectangle floated under a centred hero, is not.

Below the fold is not assessable from a static capture and is marked unresolved
rather than guessed. The full-page render returns almost entirely black: section
borders and isolated controls ("Book a demo", "Get started", a GitHub mark, "All
research") appear at their correct positions with no content between them, so the
sections are scroll-triggered and never fired. Two captures 3.5s apart are
byte-identical, confirming nothing animates on a timer; the page waits for scroll.

Single theme, so there is no neglected second one. One accent, a single gold, used
on the headline's second line and nowhere else. A cookie-preferences panel covers
the lower right of the first viewport on load.

**Scroll walker confirms the gate.** Under a full-document scroll walk the page that
rendered as near-total black paints completely: a six-mark customer wall, four
benefit rows, a feature grid of code and scan panels, an integrations band with Slack
and Linear cards, a security-research carousel, a startups/enterprise two-up, a
seven-question FAQ and the footer. `scroll-reveal-blank` is present on evidence. It
also means the signals this file marks `unresolved` below the fold are recoverable
from a walked capture rather than permanently unsettleable.

**v4 hole-7 deliverable re-pass**

Capture: reused `~/scratch/antislop/s5/openhack` (walked 2026-10-16), 12 tiles,
`clamped: false`, `coverage: 1`, `docH_before` 7953 = `docH_after` 7953, stitched to
2 strips at 7953px with no drift. The last strip ends in the footer (`© 2026
OpenHack, Inc.` at y≈7910). Exact strings below were read off the DOM with
Playwright after a wheel walk, including each animated panel's end state
(opacity 0 under the walker's frozen animations); the hero dashboard is an
`<img>` (`/assets/images/product/security-dashboard.png`, 3566x1936), read at
full resolution.

Value: `absent`, unchanged. No entry in any scored artefact could count
against the vendor.

Candidates weighed, top to bottom:

- **Hero dashboard, y≈532-1161, inside a product capture.** `10 scans (10 done)`,
  `277 issues`, `34 critical`; severity bar `34 critical · 84 high · 110 medium ·
  49 low`; five recent scans all `Full Scan: main`, four tagged `1C` and one `2H
  4M 4L`; five recent vulnerabilities, four critical and all at
  `src/security-review/critical-demo.ts:42`, one medium (`Resource consumption
  lacks bounded limits in accounts`). Every scan is done, no row is failed,
  dismissed, unverified or a false positive. Every number flatters by being
  larger. The repeated `critical-demo.ts:42` path is seeding, scored on what it
  says (four repos, one critical each), not read as a dedup error the page
  authored. Fails on stance, like modal-com.
- **Feature grid, y≈2826-3990, page-authored HTML panels on the page's own
  canvas** (hole 7 medium, eligible):
  - Code scanning (y≈2916-3090): `Missing await bypasses upload authentication`,
    a diff adding `await`, resolving to `CVE-2026-36755`. A win.
  - Supply chain (y≈2880-3106): `next-auth`, `react`, `zod`, `typescript`,
    `tslib` each `Safe`, `chalk-core` `Typosquat`, `1 suspicious package`. A
    catch plus clean verdicts; nothing against the product.
  - Secret scanning (y≈3311-3552): three keys in `.env.production`, `3 secrets
    redacted`, `Rotate keys`. A win.
  - AI pentesting (y≈3350-3578): `user_248` fetches `/api/invoices/1042`, gets
    `HTTP/1.1 200 OK` with owner `user_901`, `Cross-account access confirmed ·
    Expected 403`. The `Expected 403` is the target app's failure, the product's
    success.
  - Vulnerability management (y≈3831-3957): `01 Broken access control ·
    Exploitable · Revenue impact · Critical`, `02 Leaked test credential · Not
    reachable in production · Low`. The strongest candidate, rejected: the
    down-ranked row is the prioritisation feature the page sells (`Know what to
    fix first ... based on true business impact`, `CVSS Scores` struck through),
    so it narrows nothing. A limit repeated as a feature does not count.
- **Integrations band, y≈4341-4663, page-authored Slack and Linear panels.**
  `Fix the upload authentication bypass first.`, `SEC-104`, `Fix ready. All
  checks passed.`, `Pull request #128 · Ready for review`. Every step succeeds.
- **Security-research carousel, y≈5094-5549.** Two teasers, `CVE-2026-36755: How
  OpenHack hacked Papermark and got unlimited uploads` and `How OpenHack found a
  37-Package npm Typosquatting Campaign Targeting Windows and WSL`, with stock
  article artwork. Headlines of wins, not an artefact.
- **`View sample report (PDF) ↗`, y≈3633,** links off-page to
  `/sample-pentest-report.pdf`. Not shown on the page, so not scored.
- Not deliverables: six-mark logo wall (y≈1301), four benefit rows (y≈1738-2399),
  startups/enterprise two-up (y≈5821), seven-question FAQ (y≈6368-7138, prose and
  excluded regardless), footer SOC 2 / HIPAA / GDPR marks.

Searched both places hole 7 names, the product capture and the page canvas, for
a failed or errored run, a false positive, a missed finding, a cost, a dismissed
or unverified result, or a refusal that narrows a claim. None exists. Every
artefact on the page is the product winning, which is sentient-os's failure
shape at higher fidelity. The `slop` verdict played no part in this.

Studied-page check: unchanged. The live page matches the prose section for
section (gold second headline line, centred hero, the dashboard with `277 total
findings · 34 critical · 84 high`, six-mark wall, four benefit rows, code/scan
feature grid, Slack and Linear band, research carousel, startups/enterprise
two-up, seven FAQ questions, footer). No candidate was borderline-new, so no
Wayback lookup was needed.
