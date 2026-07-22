export const meta = {
  name: 'lab-build',
  description: 'Fan out ideation + build + gate for one ns-ui lane; returns built slugs for the chat to commit',
  phases: [
    { title: 'Ideate', detail: 'fable lenses generate lane concepts' },
    { title: 'Judge', detail: 'opus selects, dedups vs the taken set' },
    { title: 'Build', detail: 'sonnet builders, one per component, disjoint folders' },
    { title: 'Gate', detail: 'opus verifies against a production build and repairs' },
  ],
}

// args (passed by the lab chat): {
//   laneKey, laneName, laneBrief, collectionHint ('core'|'loud'|'both'),
//   port (number, this worktree's dev port), existing (string[] of taken slugs),
//   count (how many to build, default 10), canvasAllowed (bool)
// }
if (!args || !args.laneKey) throw new Error('lab-build needs args.laneKey — invoke via Workflow({scriptPath, args})')
const LANE = args.laneName || args.laneKey
const BRIEF = args.laneBrief || ''
const PORT = args.port || 3460
const EXISTING = Array.isArray(args.existing) ? args.existing.join(' ') : String(args.existing || '')
const COUNT = Math.max(4, Math.min(16, args.count || 10))
const CANVAS_OK = !!args.canvasAllowed

const HOUSE = `ns-ui house style: near-black restrained "Geist-dark" surfaces; a small "loud" collection is deliberately flashier. Colors come ONLY from CSS custom properties --background --foreground --muted --border --accent; --accent (#006bff blue) is interaction only, never decoration. Geist Sans for text, Geist Mono for data/code. Generous whitespace, thin borders, physics easing (spring / ease-out-expo), radius rhythm 6/12/16/full, 4px spacing base. Naming is two evocative words that name the MECHANISM not the widget (worn-path, loose-thread, kerf-caret, penumbra-tip). BANNED: gradient washes, neon, purple/blue backgrounds, orange, emoji (use inline SVG), heavy 3D. For any CORE component: no <canvas>, no WebGL — DOM+SVG+CSS only (a canvas draw path cannot inherit the color tokens; it broke the light theme once). Loud components MAY use canvas but must still read colors from the tokens via getComputedStyle at mount and on theme change.`

const IDEA_SCHEMA = {
  type: 'object',
  properties: {
    concepts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
          collection: { type: 'string', enum: ['core', 'loud'] },
          the_idea: { type: 'string' },
          the_job: { type: 'string' },
          why_distinct: { type: 'string' },
          mechanism: { type: 'string' },
          canvas_needed: { type: 'boolean' },
          a11y_note: { type: 'string' },
        },
        required: ['slug', 'collection', 'the_idea', 'the_job', 'why_distinct', 'mechanism', 'canvas_needed', 'a11y_note'],
      },
    },
  },
  required: ['concepts'],
}

phase('Ideate')
log(`Lane "${LANE}" — generating concepts (fable), ${EXISTING.split(/\s+/).filter(Boolean).length} slugs already taken`)

// Three fable ideators on the same lane with different postures — range without a huge fan.
const POSTURES = [
  { k: 'daily-driver', p: 'Favor components someone reaches for every week — the humble job done exceptionally. Self-explains at rest.' },
  { k: 'mechanism-first', p: 'Start from a physical or material MECHANISM (tension, friction, wear, magnetism, liquid, elastic, fold, sediment) and find the UI job it makes legible.' },
  { k: 'swing', p: 'Take real swings — novel interactions you have not seen shipped. Some will be unbuildable; that is fine, this posture is for range.' },
]

const ideaSets = await parallel(
  POSTURES.map((posture) => () =>
    agent(
      `You are a design engineer with distinctive taste, brainstorming new components for ns-ui. Be creative, aesthetic, exploratory — this is the generative step. Every concept must be honest and buildable in principle.

${HOUSE}

LANE (stay inside it): ${LANE}. ${BRIEF}

POSTURE for this batch: ${posture.p}

ALREADY TAKEN (never duplicate one of these in IDEA, not just in name):
${EXISTING}

Generate 8-10 concepts. For each: name the single idea vividly, the real job it does, the nearest existing component and how yours differs, the concrete mechanism (the actual motion/visual technique), and an honest a11y_note (keyboard + screen reader story). Set canvas_needed truthfully — a core daily driver must be false; only a loud showpiece may need canvas${CANVAS_OK ? '' : ', and this lane should prefer core'}. Push past restyled native controls — those are not concepts.`,
      { label: `ideate:${args.laneKey}:${posture.k}`, phase: 'Ideate', model: 'fable', schema: IDEA_SCHEMA }
    )
  )
)

const raw = ideaSets.filter(Boolean).flatMap((s) => s.concepts ?? [])
const takenLower = new Set(EXISTING.toLowerCase().split(/\s+/).filter(Boolean))
const seen = new Set()
const concepts = raw.filter((c) => {
  const k = (c.slug || '').toLowerCase()
  if (!k || seen.has(k) || takenLower.has(k)) return false
  seen.add(k)
  return true
})
log(`${raw.length} concepts -> ${concepts.length} after dedup vs taken + self`)

phase('Judge')
const SEL_SCHEMA = {
  type: 'object',
  properties: {
    build: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
          collection: { type: 'string', enum: ['core', 'loud'] },
          brief: { type: 'string' },
          nearest_existing: { type: 'string' },
          canvas_allowed: { type: 'boolean' },
        },
        required: ['slug', 'collection', 'brief', 'canvas_allowed'],
      },
    },
    rejected_notable: {
      type: 'array',
      items: { type: 'object', properties: { slug: { type: 'string' }, reason: { type: 'string' } }, required: ['slug', 'reason'] },
    },
  },
  required: ['build', 'rejected_notable'],
}

const selection = await agent(
  `You are the taste-and-feasibility gate for ns-ui, selecting which concepts in the "${LANE}" lane get built. Be strict — the registry's value is that every component is distinct and well-made, so reject most.

${HOUSE}

ALREADY TAKEN (a concept duplicating ANY of these in idea is rejected, however different the name):
${EXISTING}

CANDIDATES (JSON):
${JSON.stringify(concepts, null, 2)}

Judge each on: self-explains at rest, distinct (not already in the taken set and not a common pattern), buildable with honest accessibility, and house-fit (monochrome tokens; or genuinely earns a loud slot). Then SELECT the ${COUNT} strongest that are all distinct from each other and from the taken set, spread across jobs (do not pick six sliders). ${CANVAS_OK ? 'This lane may include loud/canvas showpieces where they are the strongest swings.' : 'Prefer core daily-drivers; only include a loud showpiece if it is clearly outstanding.'} You may refine a slug (house style: two mechanism words) or tighten an idea.

Write each brief as 5-8 sentences a builder needs no other context for: the idea, the job, the exact mechanism, the a11y requirements, how it must differ from the named nearest existing component, and whether canvas is allowed (only for loud). Return exactly ${COUNT} in build.`,
  { label: `judge:${args.laneKey}`, phase: 'Judge', model: 'opus', effort: 'high', schema: SEL_SCHEMA }
)

const BUILD = (selection.build ?? []).slice(0, COUNT)
log(`Selected ${BUILD.length}: ${BUILD.map((b) => b.slug).join(', ')}`)

const BUILD_RULES = `Read AGENTS.md IN FULL first — authoritative, describes the quality gate.
- Folder registry/<collection>/<slug>/ with exactly component.tsx ("use client"), demo.tsx, meta.json. Write NOTHING outside your folder — sibling builders run concurrently in this same tree.
- Colors ONLY from --background --foreground --muted --border --accent. No hex, rgb()/hsl(), or Tailwind palette class. Both light AND dark must render.
- Core: no <canvas>/WebGL. Loud: canvas allowed but read tokens via getComputedStyle, never literals.
- --accent interaction-only. No gradients/neon/emoji/orange/heavy-3D. Geist Sans/Mono. Radius 6/12/16/full. Physics easing. Respect prefers-reduced-motion (still usable under reduce).
- TAILWIND v4 TRAP: never pair base "outline-none" with "focus-visible:outline-<n>" on one element — outline-none sets --tw-outline-style:none so the focus ring renders invisible and the gate fails "no visible focus state". Use the focus-visible utilities alone.
- A11y (gate audits from markup): every control has an accessible name; role=switch|checkbox|radio carries aria-checked; a visible dialog has an accessible name; if any control renders, Tab reaches something; async updates use aria-live.
- meta.json: name, title, description, collection, tags, instruction (rich behavioral paragraph), dependencies. Add an autoplay descriptor so the card self-demonstrates (modes: pointer-path, scroll, press, drag, type, none — read the AGENTS.md autoplay section; "type" drives keyboard inputs). If the component has an open/expanded/armed state add a gate descriptor {openBy, expect}, or the verifier only ever sees the resting frame.
- GATE-SELECTOR TRAP: the verifier runs a "press" pass that clicks/toggles the first interactive control BEFORE the gate check. So a gate {openBy, expect} on a toggle must still resolve after a prior toggle (e.g. seal-on-Escape, or point openBy at a control the press pass did not consume). Design for that.
- Do NOT run git, do NOT run npm run verify, do NOT deploy. You MAY run npm run typecheck. registry/index.tsx is generated + gitignored — never touch it.`

phase('Build')
const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    slug: { type: 'string' },
    built: { type: 'boolean' },
    typecheck_clean: { type: 'boolean' },
    uses_canvas: { type: 'boolean' },
    hardcoded_colors: { type: 'boolean' },
    autoplay_mode: { type: 'string' },
    gate_declared: { type: 'boolean' },
    design_notes: { type: 'string' },
    concerns: { type: 'string' },
  },
  required: ['slug', 'built', 'typecheck_clean', 'uses_canvas', 'hardcoded_colors', 'autoplay_mode', 'gate_declared', 'design_notes', 'concerns'],
}

const builds = await parallel(
  BUILD.map((c) => () =>
    agent(
      `Build ONE new ns-ui component.

YOUR SLUG: ${c.slug}
YOUR COLLECTION: ${c.collection}
YOUR FOLDER (the ONLY place you may write): registry/${c.collection}/${c.slug}/

${BUILD_RULES}

BRIEF:
${c.brief}
${c.nearest_existing ? `Must be clearly distinct from: ${c.nearest_existing}.` : ''}
Canvas allowed for this component: ${c.canvas_allowed ? 'YES (loud) — still read colors from tokens via getComputedStyle.' : 'NO — DOM+SVG+CSS only.'}

Study 3-4 existing components in registry/core (and registry/loud if loud) to absorb the idiom before writing. Build it, run npm run typecheck, report honestly. If it did not come together within the constraints, say so in "concerns" rather than shipping filler.`,
      { label: `build:${c.slug}`, phase: 'Build', model: 'sonnet', effort: 'high', schema: BUILD_SCHEMA }
    )
  )
)
const ok = builds.filter(Boolean)
log(`${ok.filter((b) => b.built).length}/${BUILD.length} built`)

phase('Gate')
const fixed = await agent(
  `Drive the ns-ui quality gate over the newly-added components in THIS worktree and repair every failure until fully green, then eyeball the screenshots for defects the gate cannot see.

Newly added: ${BUILD.map((c) => `${c.collection}/${c.slug}`).join(', ')}

BUILDER SELF-REPORTS (heed stated concerns — some are known defects):
${JSON.stringify(ok, null, 2)}

Read AGENTS.md in full. The token rule and no-canvas-for-core rule are absolute.

1. npm run registry:build; if it fails on a malformed meta.json, note which and fix.
2. npm run typecheck — fix every error.
3. Independently grep every new component.tsx/demo.tsx for <canvas>/WebGL in a CORE component and any hardcoded color (hex, rgb()/hsl(), Tailwind palette class). Fix all real hits (ignore matches inside comments and demo prose like an issue number — verify each by reading the line).
4. PRODUCTION build then start on THIS worktree's port: npm run build && npx next start -p ${PORT}. Run the verifier: BASE_URL=http://localhost:${PORT} node scripts/verify.ts <slug> per new slug (or npm run verify). AGENTS.md is explicit: verify against a production build, never a dev server — under concurrent load Turbopack serves corrupted chunks and components render at unhydrated defaults, which looks exactly like a catastrophic bug. Iterate until green. Kill the server after.
5. LOOK AT the generated screenshots for each new component (both light and dark). The gate only screenshots resting states, so check by eye for: elements clipped by an ancestor overflow, a blank demo, unreadable contrast in one theme, a stray autofocus ring, text overflow, or two states that must differ looking identical at rest (a real defect shipped this way: a "running" and "done" glyph were pixel-identical). For any component with an open/expanded state, confirm it declared a gate descriptor and the <theme>-open.png shows the open state.
6. A component that cannot be made good within the rules should be REMOVED (delete its folder, rebuild) rather than shipped broken — fewer good beats filler. Say what you removed and why.

Do NOT run git and do NOT deploy — the chat owns the commit boundary. You MAY run git status/git diff.

Report per component: pass/fail, what you fixed, screenshot observations (call out what a resting screenshot cannot verify), and anything removed.`,
  { label: `gate:${args.laneKey}`, phase: 'Gate', model: 'opus', effort: 'high' }
)

return {
  lane: LANE,
  selected: BUILD.map((b) => `${b.collection}/${b.slug}`),
  built: ok.filter((b) => b.built).length,
  builder_reports: ok,
  rejected_notable: selection.rejected_notable,
  gate_report: fixed,
}
