---
title: "I audited my own llms.txt. Two thirds of it is still just tags."
date: 2026-08-02
description: "Four days after arguing that tags cannot separate similar components, 146 of my 228 selection-guidance lines still contain no comparison at all. Here is what I measured and what a name can never do."
---
Four days ago I published a post arguing that tags do not disambiguate components. Three of my toggle switches are all tagged `toggle`, `switch`, `input`, and to a model choosing between them, that makes them the same component listed three times. What separates them is mechanism, and mechanism does not fit in a tag.

I then went and grepped the file I actually ship.

### What does the shipped file say?

The registry is 228 components now. Each one gets a block in `public/llms.txt`, and each block carries a line called `use when`. That line is the entire selection surface. It is the one place a model is told which of four similar things to reach for.

Here are three of them, copied exactly as they ship:

```
use when: sticker (peel, drag, 3d).
use when: accordion (disclosure, hasp, latch).
use when: a loading indicator (loading, spinner, indicator).
```

That last one is not a typo on my part. The component is `loader-iris`, whose first four tags are `loader`, `loading`, `spinner`, `indicator`. The guidance it offers an agent is the noun the generator maps `loader` to, followed by the next three tags in parentheses. If you had two loaders in the catalog, and I do, nothing in that line tells you which is which.

Now here are two more, also copied exactly:

```
use when: an ambient hero/background where the wake left by pointer movement
itself is the effect. Reach for background-ascii-dither instead for a
media-driven glyph field (image or flowing noise) with a simple
cursor-proximity brighten rather than a persistent, per-cell decaying trail.
```

```
use when: a binary control where the mechanical, character-by-character throw
is a deliberate flourish and a printed OFF/ON legend belongs in the UI. Reach
for switch-frost instead for an iOS-pill switch with a soft, decorative
animation and no printed text legend.
```

Those two do the job. They name the situation, then they name the specific alternative and the specific condition under which you would pick it instead. A model reading the second one can answer "which switch" without seeing a pixel.

Same file, same field, same generator. The distance between the two halves is the whole subject of this post.

### How bad is it, exactly?

I counted rather than guessed, because the counting is trivial and the guessing was flattering.

- **228** `use when` lines, one per component.
- **106** components carry a hand-authored `useWhen` field in their `meta.json`. The remaining **122** do not.
- Those 122 hit a generated fallback. Of them, **66** contain no word that is not already one of that component's own tags. The rest add a mapped noun ("a loading indicator" from the tag `loader`) and nothing else.
- **146** of the 228 lines contain no comparative language at all: no "instead", no "pick", no "rather than", no "prefer", no "reach for". They describe, they do not compare.
- **82** carry real selection guidance.

So 36% of the catalog answers the question the post was about, and 64% does not.

### Is the fallback the villain here?

No, and I want to be precise about this, because "generated text is bad" is the wrong lesson.

The fallback in `scripts/build-llms.ts` takes the first tag that names a UI role, maps it to a phrase, and appends the remaining tags in parentheses. It is about fifteen lines. It has a comment above it that says, in so many words, that it is a fallback, that components sharing a role need a hand-authored sentence instead, and that you should add `meta.useWhen` once a component turns out to collide with something else.

The default did exactly what the default said it would do. What did not happen is the second half: somebody noticing the collisions and writing the sentences. That somebody is me. The mechanism is not neglectful, it is just a default, and a default is only ever as good as the rate at which you override it.

This is also why the number is 122 and not 228. A real person did sit down and write 106 of these, some of them very well. The work started. It stopped at 46%.

### Didn't the rename fix this?

Partly, and the part it fixed is real.

Every slug in the registry was renamed to put the role first: `chart-donut-halftone`, not `halftone-donut`. The point was that a model matching a query gets the disambiguating token at the front. That worked, measurably. **225 of 228** slugs now share at least one word with their own tags, which is the mechanical check that the name and the category agree. The three that do not (`confirm-hold-ink`, `not-found-knockout`, `not-found-postmark`) are deliberate, and the reasoning is written down in `docs/rename-plan.md`.

But a name and a comparison are different jobs. A name tells a model what kind of thing this is. It cannot tell it which of four similar things to pick, because the answer to that question is a sentence about a tradeoff, and a tradeoff does not fit in a hyphenated slug any better than it fits in a tag.

So the rename solved the retrieval half. The selection half belongs to `use when`, and `use when` is two thirds unwritten. I fixed the axis I had a script for.

### What does a good line actually contain?

Reading the 82 that work, they share a shape. Not a template, because the reasoning is bespoke every time, but a shape:

1. The situation, stated as a problem rather than a description. `meter-quota-rule` opens with "a single fraction-of-allowance reading (storage, seats, API credits, spend) meant to repeat dozens of times on one settings page at text scale, where the number itself is the primary reading and a bar/pill would be visual overkill".
2. The named alternative. Not "consider other options", the actual slug.
3. The condition that flips the choice. The same line continues: "pick sparkline-automaton instead when the thing being shown is a SERIES trending against a rule over time rather than one static used/total fraction, or feeler-gap when the framing is a pass/fail value-vs-limit check rather than an ongoing allowance."

Point three is the expensive one and the only one that matters. It is also the reason this cannot be generated: it requires knowing that two specific components compete, and why, and where the boundary sits. That is a judgment, made once per pair, by someone who has used both.

Which is a polite way of saying there is no clever fix available. There are 146 lines to write and they get written one at a time.

### The uncomfortable version

I wrote a post arguing that tags are not enough to choose between similar components. It was correct. I then shipped a file where, for 122 components out of 228, the selection guidance is the tags.

I did not find this by being rigorous. I found it by grepping a file I had already published, for a completely unrelated reason, and reading what came back.

The general form of this is worth more than the specific case: the gap between a thing you believe and a thing you ship is not visible from inside the belief. You have to go measure the artifact. I had the argument, I had the script, I had the 82 examples proving I knew how to do it, and the shipped file was still 64% the thing I had written a post against.

The 146 get written. Not by a template and not by a model, one at a time, by hand, because the tradeoff between two components is not information that exists anywhere except in someone's head until they type it out. I am not putting a date on it. I am putting the number in public so that the next person who greps this file can check whether it went down.

Registry: [github.com/nikolas-sapa/ns-ui](https://github.com/nikolas-sapa/ns-ui) (MIT)
Live: [design.helpmarq.com](https://design.helpmarq.com)
Agent catalog: [design.helpmarq.com/llms.txt](https://design.helpmarq.com/llms.txt)
