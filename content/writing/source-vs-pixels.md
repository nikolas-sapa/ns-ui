---
title: "I tried to score a page's design from its HTML. Three signals, three wrong answers."
date: 2026-10-12
description: "Clerk declares a 754x727 indigo-to-cyan gradient circle that samples #f7f7f8 at every point. Measured from the source, two of three signals read worse than the page is, and the third would have put the first false positive on the one signal that has never fired."
---
I have been building a vocabulary for the look that AI-generated marketing pages converged on: the gradient blob behind the hero, the three-card row, the wall of glass panels, emoji standing in for icons. Twenty-six signals, each a yes/no somebody sets by looking at a site, plus a written note saying what they actually saw. Twenty-five sites rated so far.

The product sitting right next to that is a function you hand some markup and get a score back. `check_design(html)`. Everyone who hears about the vocabulary proposes it within about a minute, me included, and the program spec deferred the question rather than deciding it.

It is decided now. Three signals were measured both ways, once from the source and once from the rendered pixels, on two sites. Source-scoring was confidently wrong on all three.

## Clerk declares a gradient blob that never paints

One element on clerk.com carries `linear-gradient(to right in oklab, rgb(98, 72, 246) 10%, rgb(58, 212, 253) 100%)`. Indigo to cyan, the archetypal palette of the thing I am trying to name. It is 754x727 with a `border-radius` of `3.35e7px`, which makes it a circle, at `opacity: 0.25`, sitting at y=4447 of a 7187px page. On the evidence of the stylesheet it should be the most visible object on that screen.

Twelve pixel samples across its own row, taken from the render, come back `#f7f7f8` at every point. Not one channel of deviation from the field. The element is occluded, or clipped to nothing, and I cannot tell which from the outside. `gradient-blob` is `absent` on what the page renders. A grep would have scored it `present`, and it would have been the cleanest positive in the cohort.

## The sixteen glass cards are one blur

Same page. A naive count finds sixteen surfaces carrying `backdrop-filter: blur()`, against a threshold of three or more. By source, that is `glass-card-overuse` several times over.

They are sixteen 1440x50 `pointer-events-none` strips, stacked, with blur stepping 1px, 1px, 2px, 2px, 3px, 4px. It is one progressive-blur mask under the sticky nav, assembled out of bands because CSS has no primitive for a gradient blur. One effect, not sixteen glass cards. Absent.

## Railway's eight emoji are build logs

Railway's page returns eight emoji to a codepoint scan. All eight are U+2713, and all eight sit inside JetBrains Mono log lines in a captured build panel: `mise node@25.2.1`, then the check, then `installed`. `06:46:32 [vite]`, check, `built`. That is terminal output, photographed by the page rather than authored by it. The font family settles it and the codepoint cannot. Absent.

## Two of these flatter. The third corrupts the instrument.

The gradient and the glass fail in the generous direction: a source reader calls the page worse than it is, which is the failure mode I would have accepted if someone had asked me in advance to pick one.

The emoji one is different in kind. `emoji-as-icon` reads `absent` on all 25 files. The vocabulary's current draft names it "the one honest zero, and the baseline for judging other zeros", because a vocabulary full of signals that never fire is usually a vocabulary with bad definitions, and this zero is the one I trust.

Source-scoring would put the first non-zero there, from captured terminal output, on a page that has no emoji in it at all. It would not just be wrong about Railway. It would break the reference point every other zero is judged against.

## Why I am not building check_design(html)

On this evidence I would not build a tool that takes pasted HTML and scores it for slop. Three signals on two sites is a thin basis for an absolute, so take this as the direction the measurements point rather than a proof. The signals that are easiest to name in markup are exactly the ones where markup and paint disagree, because a gradient that got occluded, a blur stack that is one mask, and a check mark inside a screenshot are all completely ordinary things to find in a real stylesheet.

Anything automating this has to render the page and sample pixels. That is a much heavier product than the pasted-HTML version: a browser per request, a capture budget, and the capture problems below. I would rather have found that out before building it than after.

## Rendering is necessary and nowhere near sufficient

Two silent capture failures, both found by being wrong first.

**A full-page screenshot returns a correct-dimension image with unpainted content, and no error.** `openhack` rendered 5388px showing section borders, hairline rules and isolated buttons at their correct Y positions, with nothing between them. Two captures 3.5 seconds apart came back byte-identical, so it is not a timing problem. The page waits for scroll events, and a full-page capture never generates any.

**A scroll walker fixes that, and does not fix lazily-sized canvases.** Walking the document in 600px steps with a 700ms settle at each, re-measuring height per step, makes `openhack` paint completely. `modal.com` still returned correct-dimension empty panels with only a centred mono caption. Those are WebGL canvases that size from 0x0 only once they are in view, and the walk passes too fast for them. Parking on the section for about ten seconds paints real animated diagrams. Twelve further contexts on that page sit at 0x0 until something mounts them.

## Two errors of mine: melty.gg's cover art, and a threshold that cannot come back red

**I compared two captures by eye and reported a false confirmation.** On `melty.gg`, a band under the hero changes between loads: Call of Duty and Super Mario cover art in one capture, Elden Ring and Hollow Knight in the next. I read that as a section mounting. It is the page rotating its cover art per load.

A row-level diff puts every changed row in the hero video panel plus two rows in the cover-art strip, and across roughly 4000px of black between it and the FAQ, not one row differs.

Mean ink per row on `melty.gg` goes 7.6% to 8.3% under the walk, and all 0.7 of that point is the video sitting at a different frame. `openhack` under the identical walk goes 6.0% to 27.8%, 4.6x. That is what a gate opening looks like, and melty is not it.

**An absolute brightness threshold is meaningless on a light page.** Every pixel of `nxtcure-labs`'s `#f5f3ff` field clears a fixed brightness bar, so the page read 100% inked before the walk and 100% inked after, which is a measurement that cannot come back red and therefore proves nothing.

The first comparison pass counted a row as inked if a sampled pixel cleared a fixed brightness. Background has to be taken as the modal pixel of the capture, with a row counting as inked when a sample deviates from that.

## Vercel leaves 2630px unpainted, and the cause stays unresolved

`vercel.com` captures at 5333px, of which everything below roughly 3300px is empty. That reads as a scroll reveal, and I first recorded it that way.

The walk does not paint it. The document grows from 5333px to 5930px under the walk, so something does mount. But across the 2630px below y=3300, not one sampled pixel differs from the `#fafafa` field. Maximum deviation zero, under the same walk that takes `openhack` from 6.0% to 27.8%.

Scrolling is the gate the signal names, and scrolling does not open it. So the value is `unresolved`, not `present`. The dead region is established. Its cause is not: hydration that never completes headless, an observer waiting on real user activation, and a bot gate all fit this evidence equally well, and I have not separated them.

## What 25 evidence files and three signals measured both ways settle

Twenty-five evidence files. Three signals measured both ways, on two sites. That is a small basis for a general claim about reading design from source, and I would not want it quoted as more than it is. What it is enough for is the decision it was made to settle: I was about to build a markup scorer, and on the three cases I checked the markup scorer would have been wrong three times, once in a way that poisons the baseline. That is enough to not build it.

The cheaper half generalises past this project. Any verification pass applied only to the positives flatters the signal, and any threshold that cannot come back red is not a measurement.

Registry: [github.com/nikolas-sapa/ns-ui](https://github.com/nikolas-sapa/ns-ui) (MIT)
Live: [design.helpmarq.com](https://design.helpmarq.com)
Agent catalog: [design.helpmarq.com/llms.txt](https://design.helpmarq.com/llms.txt)
