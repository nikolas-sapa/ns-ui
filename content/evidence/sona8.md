---
source: https://sona8.com
kind: site
cohort: yc-current
context: [hero, nav, testimonials]
verdict: mixed
studied: 2026-10-13
materials: [single-theme, video-hero]
signals:
  gradient-blob: absent
  three-card-row: present
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: absent
  testimonial-card-row: unresolved
  indigo-violet-accent: present
  gradient-fill-cta: absent
  scroll-reveal-blank: unresolved
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: present
  asymmetric-split: present
  single-optical-anchor: absent
  type-scale-high-contrast: present
  editorial-grid-break: present
  custom-type-pairing: present
  real-product-surface: present
  shows-deliverable: present
  density-variation: present
  one-accent-discipline: present
  live-claim-control: absent
---
Viewport only; below-fold unresolved.

"Good strategy starts with listening." sits top-left at roughly 68px in a
high-contrast didone serif against 16px sans body, close to 4:1 and two
voices used deliberately. A thin rule grid with visible crosshair marks at
the column intersections runs behind the content, and the nav sits in its
own boxed cell outside that grid, which is `editorial-grid-break`.

The right half floats a real product capture (a Rheinfeld Automotive
interview view with a sidebar, a transcript column and a participant
thumbnail) over a dotted violet halftone field, with a 1:43 runtime and a
"See how it works" label. `hero-mockup-float` and `real-product-screenshot`
both fire: it is a genuine screenshot, floated.

`indigo-violet-accent` is present on a flat violet CTA and the halftone,
with no gradient, which is the split v3 introduced working again. Below the
fold a ten-mark greyscale logo wall under "TRUSTED BY 20+ WINNING TEAMS",
then a three-up explainer row.

**v4 hole-7 deliverable re-pass**

Front-matter `shows-deliverable` left at `absent`: the live page is a
redesign of the studied one, so the studied-page rule forbids changing it.
Independent rating of the studied page is `present` (entry below); the live
page rates `absent`. Queued for the orchestrator to decide.

Capture (live, 2026-10-16): reused `~/scratch/antislop/s5/sona8`, 10 tiles,
`clamped: false`, coverage 1.0, `docH_before` = `docH_after` = 6649, stitched
to 2 strips at 6649px. The last strip ends in the footer ("© 2026 Sona8",
"SOC 2 compliant, certification in progress"). A cookie card overlays the
right edge of every tile; the DOM was read with Playwright to cover it.

Studied-page check: REDESIGNED. The original viewport shot
(`~/scratch/antislop/shots/sona8.png`, 2026-10-13 14:10) matches this file's
prose: "Good strategy starts with listening.", nav Home / Solutions / How it
works / Research, a floated Tella card showing Rheinfeld Automotive at 1:43,
"See how it works" 1:37, "TRUSTED BY 20+ WINNING TEAMS", and the tab row
"Sona8 interviews your people / Every answer is coded / You read the..." at
the fold. The Wayback snapshot 20261009203413 (bundle `index-BlzPeH7k.js`,
archived 20261009204102) is the same Vite SPA and carries all of it. No
capture exists between 2026-10-10 and 2026-10-16. The live page is now a
Next.js build with a replaced hero ("Interview your whole company in days."
over two portrait photos), "WORKING WITH 20+ ORGANISATIONS", a new video
("See Sona8 in a minute.", 1:03), a rewritten tab panel, and a new
"Ready to prove your strategy?" band.

Candidates on the STUDIED page:
- Hero video card, right half, y≈342-628 in the 2026-10-13 viewport shot.
  Inside a product capture: Tella `vid_cmud4jgae00110agm4x6bckh0`, 103.47s,
  Tella version 2026-09-22T20:58:46Z (before the studied date; the poster
  frame matches the shot). The walker cannot see it, so frames were pulled
  with ffmpeg. At ≈1:20-1:26 the product's own project page for "How is the
  AI transformation going for you?" reads "1 of 3 · day 1 of 14 · closes 6
  Oct", then under "How the conversations are going": "1 of 1 conversations
  did not reach Current stage of AI adoption within the team." and "The
  brief is fixed while the question is published. This is information for
  the next question — and, if it keeps happening, a reason to close early"
  (the cursor covers the last character). At ≈1:30 "How long calls run"
  reads "1 timed conversations · median 0 min · mean 0 min". The invitation
  screen earlier in the same video promises "About 15 minutes".
- "How Sona8 works" tab panel, below the fold after the logo wall, page
  canvas, y not measured (the page is gone). From the bundle: a transcript
  ("I could move budget between stores. Now anything over five thousand
  needs three signatures."), a CEO tree, and an insight card "Operating
  model 2027 / Insight", "38 of 41 asked, example", with bars "Approvals
  slower" 24 of 38, "Room to decide locally" 16, "Stopped asking" 9, "Not
  heard of it" 4. Every bad number is the client's. 38 of 41 is a
  participation figure that flatters by being larger, and it beats the
  vendor's own published "87.5% participation rate". Nothing counts
  against the vendor.
- "Organizations miss critical signals because they cannot listen at
  scale." degree diagram: a problem framing about organisations, no product
  output.

Entry that could have embarrassed the vendor (studied page): "1 of 1
conversations did not reach Current stage of AI adoption within the team."
The product's own dashboard says the only interview missed the theme it
was briefed on, beside a 0-minute median against a promised 15 minutes and
1 of 3 finished. A clean demo would have shown a full, on-brief interview.
Per the audit rule this is scored on what it says, not on being a staged
test; it is browserbase's missing `Failed` row, present. That makes the
studied page `present`.

Candidates on the LIVE page (none credited):
- Hero portraits y≈604-1057, page canvas, interview quotes: "“Give sales
  teams earlier visibility into product changes.”" (GRACE, SENIOR SALES
  MANAGER), "“We often hear what's changed from customers first.”" (DANIEL,
  VP MARKETING). The client's problems, not the vendor's.
- Video y 1219-1677, product capture, Tella `vid_cmv3cxred005t06kz7rgje8ce`,
  63.06s, sampled every 4s: "Moving to the central warehouse", "18 of 19
  finished", "Closes in 11 days", "5 things recur", employee statements
  such as "“Will I lose my job?”". All bad news is the client's; 18 of 19
  flatters.
- Tab panel y 1825 (h 380), page canvas: three dot grids, aria-labels "A
  grid of 36 people, seven of them in an interview", "A grid of 36 people;
  12 of them said something that belongs to the same theme", "The same 12
  of 36 people, counted together as one theme". "Ten agents code each
  statement, and a theme counts when six of them agree." is body copy
  selling a method, not an artefact.
- Degree diagram y 2277, testimonials y 3075, quote ticker y 3834
  ("“One week of interviews changed the order of our rollout.”"): flattering
  or about the client.
- Footer y 5859 "SOC 2 compliant, certification in progress": a concession
  in footer prose, not in an artefact (the deepmark exclusion).

**Orchestrator ruling on the re-pass above — `shows-deliverable` set to
`present` on the studied page.** The rule: a re-pass re-interprets the page as
studied. The studied page's hero video was on that page: its poster matches
the 2026-10-13 viewport shot, the file was last edited 2026-09-22, and the
Wayback snapshot `20261009203413` shows the old site. At about 1:20 the
product's own dashboard reports "1 of 1 conversations did not reach Current
stage of AI adoption within the team", with a median of 0 minutes against the
invite's "About 15 minutes". That is the product missing its own brief, which
is the entry the procedure asks for. The original study never saw it because
it rated the viewport only and the video plays on click. This is a capture-miss
correction, the stripe-2014 case, not a flip to a different page.

**Queued: a full re-study of sona8.** The live page is a redesign (new
framework, hero, video and tab panel), and on that page the re-pass found no
entry.
