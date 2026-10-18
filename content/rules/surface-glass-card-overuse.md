---
id: surface-glass-card-overuse
context: features
signal: glass-card-overuse
stance: avoid
severity: soft
evidence: [heroku-2014, openhack, toppic]
---
## Avoid

Three or more translucent blurred surfaces (`backdrop-filter: blur`) across one page: frosted cards, frosted badges, a frosted panel around a frosted panel, each a pane of the same glass.

## Instead

Give surfaces opaque fills and separate them with weight, spacing or a rule. Keep blur for the one surface that genuinely sits over moving content, such as a sticky header.

## Why

Rare among exemplars and in the 2014 control, so it reads as a template default rather than an old convention. Soft: it fires on a minority of slop pages, and the count is of declared blur, which sometimes frosts nothing visible.

Counted over the slop-rated files no pre-screen chose: the screen that found the other slop files ranked on this signal, so they cannot vouch for it.

Present in <!-- generated:count start -->1/3<!-- generated:count end --> of the rated files studied for this rule.
