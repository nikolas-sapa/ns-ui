# Anti-slop build fixture

A committed corpus for `scripts/test-antislop-build.ts`, kept **outside
`content/evidence/`** on purpose: the real corpus tests and the seed gate must
keep counting only real evidence, and a fabricated rating in that directory
would contaminate every count in the project.

**Why it exists.** On `content/evidence/` as it stands, zero of the 26 signals
are rule-eligible (2 files are rated `slop` against the 3-file pool minimum in
`scripts/antislop/eligibility.ts`), so a build over the real corpus writes no
counts, emits an empty `rules` array, and passes by having nothing to do.
Asserting against it would prove the build runs, not that it computes anything.

**Why it is committed rather than written at test time.** A fixture a test
generates is a target the test controls — the stale-green configuration this
repo keeps finding. These files get reviewed once, diff when someone changes
them, and are fed to the real `parseEvidence`/`parseRule`, so the chain
exercises the actual parse path.

**Shape.** 10 evidence files: 3 rated `slop` with `gradient-fill-cta: present`,
3 `exemplar` and 3 `pre-ai-2015` with it `absent`, plus one `slop` file rating
it `unresolved`. That clears every eligibility gate for exactly one signal,
which is the minimum that makes the build do real work. `fixture-hero-gradient`
names 7 of the 10; its count is `3/6`, because the `unresolved` file leaves both
sides.

**The committed count is the correct one.** A rebuild over a copy of this tree
must leave `fixture-hero-gradient.md` byte-identical — a test asserts exactly
that, so editing the fixture evidence without rebuilding fails rather than
silently changing what the suite proves.
