# Can we port the 21st.dev bookmarks? Licensing audit

Researched 2026-08-01, against public GitHub and the local `design-reg` indexes
(aceternity, magicui, chanhdai, termcn, bklit). Conclusion first: **no.** Not from 21st.dev, and not
from the authors' own repos either, because for these particular components those repos do not exist.

## Why 21st.dev itself is not a source

From their Terms of Use:

- Components are "the sole and exclusive property of their respective authors and 21st Labs Inc."
- Republishing to other sites is prohibited without a clear visible link back to the original
  component page; media assets and metadata require explicit written permission.
- Scraping or automated collection without written consent is forbidden, as is using Marketplace
  content to train models, and "attempting to circumvent any technical measures."
- A subscription grants access to view and use content **through the platform**. It does not grant
  redistribution rights.

So the Builder subscription (~$7/mo) would not have unlocked what we wanted. The paywall was never
the blocker; the licence is. Anything recovered from their CDN bundles — the GLSL in
`.scratch-21st/`, which is gitignored — is off-limits for anything we ship.

## The authors' own repos: checked, and they are not there

The hoped-for shortcut was that these authors publish the same components in their own MIT repos, in
which case 21st.dev's listing would be irrelevant. Checked all 30 priority slugs (18 raw-WebGL, 12
CSS/SVG-only). **Zero clear the bar.**

| Component(s) | Author | Repo | Verdict |
|---|---|---|---|
| swirl, sphere, shader-lines, shiny-button, book-a-demo-2 | designali-in | `designali-in/designali` — real, **MIT** | **No.** It is the designali.in platform monorepo (Next/Tailwind/MDX). No shader or button code in it. Same person, different project. |
| 8bit-loading-screen, 8bit-not-found1 | theorcdev | `TheOrcDev/8bitcn-ui` — real, substantial, **MIT** | **No.** Pulled the live registry and checked the full component list: no loading-screen and no 404 component exist there. Closest is `Skeleton`. |
| blue-light-swirl, verdant-swirl | serafimcloud | `serafimcloud/21st` — the marketplace platform itself | **No.** Platform codebase, not a component library. |
| liquid-glass | suraj-xd | `suraj-xd/XD-UI-Library` — 50+ components | **No.** No LICENSE file at all (so all-rights-reserved by default), and no `liquid-glass` in it regardless. |
| shiny-button | Shatlyk1011 | `my-best-resources` — a links list | **No.** |
| knot-animation | montekkundan | 105 repos, none matching by search | **Unclear** — lowest-confidence call in the table; GitHub search does not index repo contents well. Worth a manual pass. |
| icey-night-shards, line-shader-homlu-ui, waves-shaders-homlu-ui, shader-anima, portfolio, valley-of-the-mind, istanblue, crystal-shader, liquid-crystal, liquid-gradient, blue-meshy-background, spooky-smoke-animation, apple-tahoe-liquid-glass-button, gradient-bars-background, trail-grid, metamorphic-loader, seed | various one-off handles | none found | **No.** These read as 21st.dev-native contributors who publish to the platform rather than maintaining a public component repo. |
| award-badge | shugar | none | **No**, and out of scope anyway — it is a Product Hunt branded asset. |

The two most useful rows are `designali-in` and `theorcdev`: both have real, confirmed-MIT repos
containing plenty of their other work, and neither contains the bookmarked component. That is a
definitive negative rather than an absence of evidence — it rules the shortcut out rather than
leaving it open.

**Not exhaustively verified:** `montekkundan`'s 105 repos were not walked individually, and
`serafimcloud` was only checked for the main platform monorepo — as 21st's founder they plausibly
have a personal shader-experiments repo. Two ten-minute follow-ups, neither blocking.

## What this leaves, and why it is fine

**Independent reimplementation, not porting.** This was already the framing in
`docs/21st-source-audit.md` §"Worth porting into ns-ui, Tier 1", and the licence audit only makes it
mandatory rather than preferable.

The technique is not owned even where a specific implementation is. Simplex and value noise, fbm,
domain warping, the fullscreen-triangle + `u_time`/`u_resolution` uniform pattern, standard gradient
and vignette functions — these are textbook material from The Book of Shaders, Shadertoy and the
general GLSL literature. Writing a shader host and N presets from that knowledge is clean. Copying
their GLSL text is not, and we are not doing it.

The 12 CSS/SVG-only components are unaffected by any of this: there was no source to obtain in the
first place, and a clean-room rebuild from the rendered preview was always the plan.

## Attribution mechanics, for whenever a clean source does surface

MIT-to-MIT porting is standard and explicitly permitted. What must travel with the code:

1. **The copyright notice and licence follow the file**, not just the repo root. A header comment on
   the ported `component.tsx` — `/* Adapted from <repo-url> (MIT) © <year> <author> */` — is
   sufficient when the repo root `LICENSE` covers the project, optionally with a `NOTICE` or
   `THIRD_PARTY_LICENSES` file listing every adapted source.
2. **`meta.json` records the paper trail**: source repo URL, original author, SPDX id, and the
   commit or tag ported from.
3. **Attribution survives modification.** Rewriting the code does not remove the obligation — it
   credits the original work, not the untouched bytes.
4. All three apply only where the repo exists, the licence is confirmed permissive, and the component
   is genuinely the same component rather than the same name. None of the 30 clear that today.
