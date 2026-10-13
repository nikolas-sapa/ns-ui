---
id: color-indigo-violet-accent
context: hero
signal: indigo-violet-accent
stance: avoid
severity: soft
evidence: [acyclic, anthropic-com, aviern, basecamp-2014, browserbase-com, capveon, clerk-com, cursor-com, databuddy, decent-com, deepmark, dropbox-2014, github-2014, grep-ai, heroku-2014, linear-app, mailchimp-2014, melty-gg, modal-com, neomatter, nxtcure-labs, openhack, papaya, railway-com, resend-com, silica, sona8, squarespace-2014, stripe-2014, stripe-com, truemile, vercel-com]
---
## Avoid

Indigo through violet as the page's accent, in any fill. The hue most
associated with AI-era product pages, independent of whether it arrives as
a gradient or a flat colour.

## Instead

Nothing, necessarily. This is the weakest rule on the list and it is here
mainly to be checked against, not followed. If the hue is doing real work
in a brand, keep it. What it is worth asking is whether the hue was
*chosen* or inherited from a framework default, a component library, or the
first palette a model suggested.

## Why

This signal exists because the v1 vocabulary named the wrong thing. It had
`purple-blue-gradient-cta`, which read 0 in 25 files: the archetypal
palette had already moved to flat fills, so a signal defined on the
gradient could not see it. Splitting the hue from the gradient made both
visible, and this half is the one that fires.

The split's first real test is Stripe against Railway. Stripe's CTA is a
flat `rgb(83,58,253)`, so the hue is present and the gradient absent.
Railway ships an actual `radial-gradient` CTA. Under the v1 signal both
would have read identically.

It is a soft rule and it barely separates: it fires on a third of the slop
evidence and runs at a similar rate in the 2014 control, so it is not an
AI-era artifact in any strict sense. It is also the signal whose definition
is most obviously incomplete. "The hue, in any fill" with no scope rule
fires on a page whose only violet is a customer's logo card at 11%
saturation, which is why `linear-app` reads absent here on a judgment the
vocabulary should be making for the rater instead. `badge-pill-spam`
demonstrates how to write a scope exclusion; this signal needs the same and
does not have it.

Present in <!-- generated:count start -->10/32<!-- generated:count end --> of the rated files studied for this rule.
