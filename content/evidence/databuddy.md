---
source: https://www.databuddy.cc
kind: site
cohort: yc-current
context: [hero, nav, pricing, features, testimonials, cta, footer]
verdict: mixed
studied: 2026-10-10
materials: [single-theme, illustration]
signals:
  gradient-blob: present
  three-card-row: present
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: present
  testimonial-card-row: absent
  indigo-violet-accent: present
  gradient-fill-cta: absent
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: present
  asymmetric-split: present
  single-optical-anchor: absent
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: present
  shows-deliverable: absent
  density-variation: present
  one-accent-discipline: absent
  live-claim-control: absent
---
Product analytics tool, YC F26. Dark site, hero text left at roughly half measure,
headline split across two weights so the second line ("without a data team.") drops
to a mid grey.

The gradient is the loudest thing on the page and it is not behind the headline: a
large soft bloom runs orange to magenta to violet across the top right corner,
bleeding under a pixel-art rabbit silhouette. The same gradient returns in the
footer CTA as a mountain-range silhouette. Two instances, one of them 8000px down
the page, so the site is paying the cost of the blob twice.

Below the hero a dashboard screenshot sits on the gradient with a separate insight
popover layered over its right edge, partly occluding the KPI row behind it. The
tab strip ("Overview / Events / Errors / Vitals / Funnels") straddles the boundary
between the hero band and the screenshot.

Where the page earns something: the bento band shows a real install snippet with
the actual CDN path and client-id attribute, and a live event log with typed
coloured pills (FLAG, ERROR, VITAL, EVENT, PAGEVIEW), timestamps to the second,
and real right-hand context ("Safari 18", "Chrome · Germany", "25% of users").
That is genuine density against an otherwise sparse page.

Pricing is three equal cards (Free / $9.99 / $49.99). The 3-up feature grid above
it carries one undifferentiated grey line-icon set at uniform size and weight
(panel, shield-check, bolt), each repeating what its heading already says.
Testimonials are not a triplet: roughly a dozen quotes in a masonry wall with real
handles and avatars.

Single theme. The default (prefers-color-scheme: light) capture renders dark, so
there is no second theme to have neglected. Two captures 3.5s apart differ, so
something on the page animates, but nothing in a static frame shows whether any
motion answers to the pointer.
**v3 re-pass.** `indigo-violet-accent` is present: the top-right bloom samples at
#5e3e79 to #4e3d77 along its right edge, so the orange-to-magenta run terminates in
indigo-violet rather than stopping at magenta. `gradient-fill-cta` is absent — the
bloom is a background wash and both hero buttons are flat dark pills with hairlines.
The full page renders complete, so `scroll-reveal-blank` is absent despite the page
being 8761px tall.

**v4 hole-7 deliverable re-pass**

Capture: reused `s5/databuddy` walk, 13 tiles, `clamped: false`, `coverage: 1`,
`docH_before` 8486 = `docH_after` 8486, worst landing error 0px. Stitched to 2 strips,
8486px vs page 8486px. The last strip ends in the footer (`© 2026 Databuddy Analytics, Inc.`).
That capture is the live page of 2026-10-16, and it is a redesign (see the studied-page
check below). The studied page was therefore rated from the 2026-10-10 full-page capture
(`shots/databuddy-full.png`, 1440x8761, taken 15:01 +0300 = 12:01 UTC) plus the vendor's
public repo at the matching commit (`8bad96b3`, 2026-10-09) for the animated panels the
capture shows mid-state. Wayback has only `20261011203657` for Oct 1-16, which is after the
study, and the Archive went offline on follow-up queries.

Candidates on the studied page (y from the 10-10 capture, approximate):
- Hero live-demo iframe (`app.databuddy.cc/demo/...`, product chrome), y~555-1170. It is a
  loading skeleton in the studied capture, so unreadable. The 10-11 walk shows `+60%`
  `+80%` `+85%`, with the bounce delta hidden under the popover.
- Hero insight popover over the iframe (page canvas), y~575-848: "Signups from organic
  search rose 34% week over week", `Example investigation` `+34%`. The per-tab examples in
  source are all the product finding something about a customer's site.
- Bento (page canvas), y~1843-2540: `TypeError: undefined is not a function`
  `at /app/layout.tsx:42:15` `CRITICAL` `12 AFFECTED` (y~2459). Also flags `New Dashboard`
  / `AI Assistant` / `Dark Mode V2` and events `add_to_cart` `8.9k`. This is a generic demo
  customer, and an error caught by an error tracker is the feature being sold.
- Databunny investigation (page canvas, animated), y~3165-3676: `Signup completion −22%`,
  `3 signals found`, `a41f0c2 verification copy, Tue`. Every source scenario finds its cause
  and closes on a recovery (`Back to 62%`, `Back to 4.0%`, `Back to 41%`).
- Editor panel (page canvas, typed), y~3821-4045. It is empty in the capture. Source answers
  are "Launch week traffic is up 64%. ..." and "Yes. This week's investigation found checkout
  conversion down 22% ... I asked Databunny whether the two line up." Generic customer, the
  product wins.
- Swap-a-stack snippet + `One dashboard` live log (page canvas), y~4494-4790:
  `TypeError at /checkout` `Safari 18`, `acme.link/launch`. Generic acme demo.
- Pricing, y~5603-5759: three tiers with no refusal in the grid. "Set a billing limit and
  ingestion stops instead of surprising you." is footnote copy and a limit the page sells.
- FAQ "Can I trust the AI answers?": FAQ prose, excluded.
- Footer CTA chip, y~7997-8096: "Traffic looks normal next to last week. If a change is
  real, I'll post it in Slack." This is a null result sold as restraint.

Entry that could have embarrassed the vendor: none. Every artefact is either unreadable at
capture (the iframe) or a demo customer's trouble that the product catches and fixes. Nothing
shows the product erring or missing, or narrows a claim. Verdict: `absent`, confirmed for
the studied page.

Studied-page check: redesigned. The prose's install snippet, event log and icon card grid
are gone. A Databunny chat panel, a chat-thread FAQ, a macOS Claude Code window and a
dogfooded bento have appeared. Height went from 8761 to 8486. Vendor commits after the study:
2026-10-10 16:19 UTC `a196376d` (editor as a real Claude Code session), `9a6d2a0d` (FAQ as
chat thread) and `00505329` (Databuddy domains in the activity feed). Then 2026-10-16
00:10 UTC `71f86ec4`, "rebuild the bento with real Databuddy data", which "Removes the hero
insight popup and the tools section".

Drift, not applied: the redesigned page carries a candidate entry. In the bento error card
(page canvas), at y=2715 to 2807, it shows `TypeError: Cannot read 'plan' of undefined` `CRITICAL`
`/pricing at app/(home)/pricing/_pricing/table.tsx:88:11` `Last 24 hours` `12 affected`.
`apps/docs/app/(home)/pricing/_pricing/table.tsx` exists in the vendor's own repo, so the
artefact shows a critical crash in Databuddy's own pricing table, the same kind of entry as
railway-com's own error log. Weaker supports on the same page:
- The editor transcript at y~4389 (animation-dependent) runs on `websiteDomain: "databuddy.cc"`
  with `"Checkout conversion down 22% vs the prior 7 days"`.
- The live hero iframe currently reads `53.5%` Bounce rate `+36%` and `30s` Session
  duration `10%` in red.

On the redesigned page I would score `present` on the error card. It needs a full re-study.
