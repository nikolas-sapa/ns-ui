---
context: hero
signal: gradient-blob
stance: avoid
severity: soft
evidence: [fixture-slop-1, fixture-slop-2, fixture-slop-3, fixture-slop-unresolved, fixture-exemplar-1, fixture-exemplar-2, fixture-exemplar-3]
---
## Avoid

A soft radial gradient blob behind the hero headline. Fixture rule, not a real
ns-ui rule: it exists so scripts/test-antislop-build.ts can exercise
loadCorpus -> countRule -> applyMarker -> snapshot end to end against the real
parser. The live rules live in content/rules/.

## Instead

One flat background and a single optical anchor.

Present in <!-- generated:count start -->3/6<!-- generated:count end --> of the
rated files studied for this rule. Seven files are named; the one rated
`unresolved` leaves both the numerator and the denominator.
