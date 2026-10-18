---
source: https://www.melty.gg
kind: site
cohort: yc-current
context: [hero, nav, features, cta, footer]
verdict: exemplar
studied: 2026-10-10
materials: [single-theme, video-hero]
signals:
  gradient-blob: absent
  three-card-row: absent
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: absent
  testimonial-card-row: absent
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: absent
  asymmetric-split: absent
  single-optical-anchor: present
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: present
  shows-deliverable: absent
  density-variation: present
  one-accent-discipline: present
  live-claim-control: absent
---
Game mashups, YC F26. Consumer gaming, and the only site in this pass whose hero
is the product running rather than a picture of the product.

The opening viewport is a single rounded-corner video panel, nearly full width,
playing actual mashup footage: an Elden Ring environment, dust and a cathedral
facade, with a Minecraft HUD composited over it (heart row, hunger row, hotbar with
item counts 63 / 63 / 16) and a diamond sword in the lower right at Minecraft's own
block resolution. A small label top-left names the pairing with both games' store
icons ("Elden Craft"). The headline sits over the footage at the bottom left in two
lines: "Play game mashups" in white, then "In one click" reversed out of a blue
pill with a play triangle. Pause and mute controls sit in the panel's top right.

The headline is not centred and the video is not a floating mockup; it is the frame
the page is built around, and it is the only thing in the first screen.

live-claim-control is absent: the clip autoplays and loops on
its own, and the pause and mute affordances stop motion rather than let a visitor
test the claim the page is making. Across
two captures 3.5s apart the video is at different frames and the panel is otherwise
identical.

Below the hero: a one-line "Backed by Y Combinator" credit, then the pairing
mechanic shown literally as real Call of Duty and Super Mario cover art flanking a
"Download Melty · Free on Windows" button. Then a long blank band in the full-page
capture, so a mid-page section is scroll-triggered and did not fire; its signals are
not claimed here.

The FAQ is a two-column definition list, seven questions, left column the question
in two short lines, right column a direct answer: "What's a mashup? / A mod that
joins games into one. In SkyCraft, you play Skyrim as a Minecraft player." One of
them names the build path ("Copy Melty's instructions into Claude Code or Codex and
say what you want. Your agent builds it and publishes it.") and one answers the
actual objection ("Every upload is checked for dangerous files."). The close is
"Safe and free" with the same download button.

One accent, a single electric blue, on the nav Download chip, the "In one click"
pill and the download buttons. Nothing else on the page is chromatic; the colour
all comes from the game footage. Single theme, heavy condensed grotesk wordmark,
tight geometric sans for the headline.

**Scroll walker says no, and the first reading of it was wrong.** The band under the
hero does change between captures — Elden Ring and Hollow Knight cover art where the
static capture had Call of Duty and Super Mario — but that is the page rotating its
cover art per load, not a section mounting. A row-level diff of the two full captures
puts every changed row in the hero video panel plus two rows at y1220-1260 in that
cover-art strip. Across the roughly 4000px of black between it and the FAQ, not one
row differs. Mean ink per row goes 7.6% to 8.3%, and all of that 0.7 point is the
video sitting at a different frame.

So `scroll-reveal-blank` is `unresolved`, on the same standard applied to
`vercel-com`: the band is real and the page is clearly not rendering something, but
scrolling is the gate the signal names and a full-document walk does not open it.
`openhack` under the identical walk goes 6.0% to 27.8% mean ink, 4.6x — that is what
a confirmed gate looks like, and this is not it.

**v4 hole-7 deliverable re-pass**

Re-pass 2026-10-16. Value confirmed: `shows-deliverable: absent`. Front-matter unchanged.

Capture: reused `~/scratch/antislop/s5/melty-gg` walk, 13 tiles, `clamped: false`, `coverage: 1`, `docH_before` 9086 = `docH_after` 9086 (no drift). Stitched to 3 strips (4400 + 4200 + 486 = 9086px). The last strip ends in the footer: "© 2026 Stella Montis Inc." at y9048 with Privacy / Terms / Discord / X.com. Text and media read off the DOM with Playwright. The hero video is load-bearing, so it was pulled (`/videos/mashups-reel-1080p.mp4`, 32.0s, 1920x1080, sha256 `ae65b21f…39f0`) and read as 1fps contact sheets plus full-res frames at the text overlays, not from stills.

Unlike the study's capture, this walk renders the band between the cover-art strip and the FAQ. It holds four feature sections, each a page-authored HTML panel of product chrome over a game-frame background. Every candidate weighed:

- **Hero reel**, y100-860, inside a product capture (gameplay footage of mashups running; the clip label rotates with the clip, "Super Mario Ring" in this capture). There are eight ~4s clips: Elden Ring + Minecraft, Mario vs "Margit, the Fell Omen", Portal + Half-Life 2, Minecraft + a CoD rifle, a horde round, Mario in a Minecraft dungeon, MW2 sniping, MW2 skyscraper. The adverse-looking content is all game-internal. A Minecraft death line, "HomeInvader tried to swim in lava" (~21s). An MW2 scoreboard reading "LOSING" 200 / 300 (~24-28s). A boss health bar. These are the games working. None is Melty failing to install, launch, or join. The two overlay strings that are Melty's or the mod's own, "All enemy health x4 (1 = vanilla)." (~17s) and "Original controller controls | Start: pause | J: return to MW2" (~29s), are a difficulty setting and a control hint, both features. The tan pixel cloud in the Elden Craft clip (0-4s) reads as Minecraft hit/death particles, not a texture fault. Its colours rule out the magenta/black missing-texture checker, and I cannot support a glitch reading. No crash, error, hitch, compatibility notice or broken render appears in the 32s.
- **Cover-art strip**, y~1350-1556, page canvas: covers rotating per load (Skate 3 / GTA V / Terraria in the DOM read) flanking "Download Melty". Not output. The grey card is a crossfade (GTA V at opacity 0.86), not a missing asset.
- **"Discover" panel**, y2213-2540, page-authored chrome: six mashup tiles ("SkyCraft", "Super Mario Ring", "Skate Warfare", "Portal Life", "Elden Craft", "Spartan Warfare"), each a title, a frame and two covers. No ratings, no counts, no status. Nothing could count against the vendor.
- **"Forget setup / Play in one click" panel**, y3269-3717, page-authored chrome over `skycraft-1.webp`. The pill animates through "Play" → "Installing" → "Starting Skyrim" → "Playing". The walker froze it mid-transition, so it shows a blank blue pill. Read off the DOM, all four states are the success path. There is no failed-install, missing-game or retry state, even though the FAQ admits one ("If you’re missing one, Melty sends you to its store.").
- **"Multiplayer / Out of the box" panel**, y4613, page-authored chrome: "melty.gg/j/amber-fox-7k2q" → "Link copied", then a crowd of six initials and "+94". A count that can only flatter by being larger.
- **"Create and Publish / With your AI" panel**, y5667-5968, page-authored chrome: "My mashups" with "SkyCraft" and "Elden Craft", and "Publish with AI" → "Send instructions to coding agent". No moderation, rejection or failed-build state. (The SkyCraft thumbnail is blank in the strip: lazy `skycraft-2.webp` not yet painted, a capture artefact.)
- **FAQ**, y6656-8078: prose, excluded from scoring. It holds the page's only concessions: "If you’re missing one, Melty sends you to its store." and "If a mashup looks wrong, report it from its page." Both sit in body copy, not in an artefact (the deepmark ruling).

Entry that could have embarrassed the vendor: **none**. Searched: all 32s of the reel (every clip, every legible overlay), the DOM text of all four chrome panels including every hidden animation state, and the cover strip. Verdict: the deliverable is shown well and in two media. A real product capture (the reel) and page-authored chrome renderings (the four panels) both count under Part B. But every entry is the flattering one. The only adversity on screen belongs to the games, not to Melty. The one admission that Play can fall short lives in FAQ prose. The panel that dramatises Play shows only the success path. Absent on stance, not medium.

Studied-page check: unchanged. Wayback `20261010015523` (raw `id_`, deploy `dpl_82JjYH4NHi6oDne7778Sbueab1Ea`) against the live page (deploy `dpl_4HwXS12vXW4hQ5kLqhykhL9zxwPH`): 103 visible text strings each, zero diff. Every section above, including the four mid-page panels and the reel `mashups-reel-1080p.mp4`, is in the studied page's markup. The study's capture recorded that band as blank. This walk renders it. Since this re-pass covers `shows-deliverable` only, `scroll-reveal-blank` is left as it stands for the orchestrator to revisit. The only differences are per-load rotations (cover art, hero clip label).

**Orchestrator: `scroll-reveal-blank` unresolved → absent.** The `unresolved`
rested on a ~4000px black band that the study's walk could not open. Today's
walker renders that band as four content panels, and the Wayback snapshot
`20261010015523` confirms the page is unchanged, so the blank band was a
capture failure. Measured with `srb.cjs`/`dwell.cjs`: at rest, 19 of 77 text
nodes sit under 8% opacity. A full scroll walk crosses **2** of them (27
characters); a dwell control waiting the same time without scrolling crosses
**2** (44 characters). Equal counts mean the gate is time, not scroll, and the
17 nodes that stay faded are a design fade. Absent under the signal's own
procedure.
