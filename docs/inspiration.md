# Inspiration Bank — 2026-07-17 harvest

56 sites scouted by research agents, 52 accessible. Synthesis themes + top-15 ranked candidates, then per-site findings.

## Craft themes

- Interruptible springs replace durations: the best sites publish tuned stiffness/damping/mass as documented defaults (kinetics shows the values per demo), retarget mid-flight from current velocity instead of restarting, and pipe raw scroll progress through useSpring (stiffness ~100, damping ~30) before it ever touches a style.
- Glass is a stack, not a filter: convincing liquid glass = backdrop blur+saturate on a ::before pseudo-element + tiled noise grain + multi-inset specular rim shadows on ::after + a 5-7 layer graduated shadow ramp with negative spreads, with children z-lifted above the blur (glass3d, NameThatUI, refero bevel stacks).
- Monochrome chrome with a color budget of one: UI stays grayscale with 1px hairline borders and tinted surface steps instead of drop shadows; saturation appears only in content media or a single interaction/animated state (Ultramock's orange = 'this property is animated', Endless Tools' pure-black gallery frame, Geist blue-for-interaction).
- Luminance-to-glyph rendering is a rising aesthetic: ASCII, Bayer dither, dot-matrix, LEGO-stud and halftone effects all map brightness to character/dot density — and stay premium only when each cell carries micro-lighting (stud speculars, phosphor glow, dot softness). 21st.dev gave ASCII its own top-level category.
- One split-to-spans text engine powers everything: split-flap, scramble/decode, shimmer, glyph-splice are all per-character stagger on a shared primitive — with tabular-nums/mono charsets to kill width jitter, real text in aria-label with churning spans aria-hidden, and a prefers-reduced-motion static fallback as part of the contract.
- Scroll pacing by geometry, not duration: sticky-container height (300vh) and offset windows (['start end','center center']) define speed and completion points so everything scrubs both directions; scroll velocity becomes a physics input (skew, marquee direction); invisible native scroll-snap overlays provide a free discrete index; transform/clip-path only, for compositor/ScrollTimeline eligibility.
- Cursor effects run on direct-DOM rAF loops: 60fps proximity/trail/tilt work bypasses React state entirely — lerp-smoothed pointer tracking with Gaussian distance falloff, pointer position exposed as CSS vars or shader uniforms (satisui documents 'React state is too slow' as API guidance).
- Micro-annotation mono metadata as identity: uppercase letterspaced Geist-Mono-style labels, blueprint dimension lines and drafting marks, kbd hint chips embedded inside controls, tiny technique tags next to huge display type — engineering detail exposed as brand (javii, designmd, Fontshare, Ultramock, bklit).

## Ranked component candidates (top 15)

### 1. `ascii-dither-media` — core, medium

Canvas/shader renderer that maps any source (image, video, animated noise field, or an r3f scene) to a luminance-driven glyph grid: Geist Mono ASCII mode, Bayer/Floyd-Steinberg dither mode, and dot-matrix mode, with cursor-proximity brighten/resolve and an optional reveal-from-black entrance where 90% of the figure stays below the visibility threshold. Monochrome #ededed on #0a0a0a.

**Why:** Six independent sites converged on this — shader-grade motion expressed in pure monochrome glyphs is the single best match for 'shader taste + Geist restraint', 21st.dev made ASCII its own category (trend confirmed), and Aceternity/Magic UI have nothing like a unified glyph-rendering engine.

**Sources:** https://21st.dev/home · https://x.com/uihssn/status/2075335893192523951/photo/2 · https://app.ditther.com/ · https://www.originkit.dev/components/svgparticles · https://variant.com/community · https://blog.vibecoder.me/

### 2. `dispersion-glass-object` — core, large

r3f showcase object (torus/arrow/extruded logo prop) in drei MeshTransmissionMaterial with chromatic dispersion, attenuation tint, iridescence and clearcoat, refracting a swappable backdrop (solid, animated shader, or video texture) behind it. Cursor-lerped gaze/tilt plus momentum drag (velocity carry, exponential decay) exposed as tunable props.

**Why:** Direct hit on three owner-taste pillars at once (3D interactive object, cursor-following, liquid glass); real spectral edge-splitting over moving content is something no CSS glass fakes and no mainstream registry ships as an installable component.

**Sources:** https://valessa.riotters.com/ · https://craftwork.design/catalog?filterByPrice=free · https://endlesstools.io/

### 3. `glass-panel` — core, small

Container-level liquid-glass primitive (card/toolbar/sheet) using the full three-layer recipe: ::before backdrop-filter blur+brightness+saturate with optional tiled noise grain, ::after five-stack inset specular rim, 7-step graduated shadow ramp — all driven by CSS vars (blur, tint, noise, elevation) with concentric capsule radii for grouped toolbars.

**Why:** Lifts the existing glass-button material into a reusable surface system (the missing container half of the liquid-glass lane); small effort, foundational for every future overlay, and the documented recipe is copyable craft most libraries get wrong with a single backdrop-filter.

**Sources:** https://glass3d.dev/ · https://namethatui.com/

### 4. `decrypt-text` — core, small

Scramble-to-decode text reveal: mono glyphs churn and lock in left-to-right with per-character settle deadlines and a subtle scanner highlight on the resolving character. Tabular-nums/mono charset for zero layout jitter, final string in aria-label with churn aria-hidden, instant render under prefers-reduced-motion.

**Why:** Text-choreography taste at the smallest possible effort with hero-grade wow; distinct from the roadmap text-morph (entrance reveal vs A-to-B transition), and the a11y/jitter engineering documented at NameThatUI makes the ns-ui version measurably better than the many sloppy clones.

**Sources:** https://text-effects.colorion.co/ · https://namethatui.com/ · https://kinetics.colorion.co/

### 5. `cursor-image-trail` — loud, medium

Section wrapper spawning a trail of images/cards along the cursor path: lerp-smoothed follow, spawn after N px of travel, spring scale-in, staggered rotate/fade age-out, velocity-driven spawn rate. Direct-DOM rAF loop, no React state on the hot path.

**Why:** Three sites independently flagged it and 21st save-counts prove cursor-reactive pieces outrank static ones; it is the signature studio-portfolio pointer interaction, squarely in the cursor-following taste, at medium effort.

**Sources:** https://21st.dev/home · https://ui.unlumen.com/components · https://www.inspo.page/

### 6. `magnetic-dock` — core, medium

Cursor-proximity magnification engine with Gaussian distance falloff and rAF+lerp direct-DOM tracking, shipped as three variants on one core: macOS-style icon dock, avatar group with distance-falloff lift, and an image/card row with grayscale-to-color focus. Interruptible springs on release; liquid-glass dock surface.

**Why:** Four-site convergence merged into one physics core; the Gaussian-falloff + direct-DOM version reads dramatically better than the binary-hover docks Magic UI ships, and the variant family demonstrates registry depth from a single mechanism.

**Sources:** https://satisui.xyz/ · https://transitions.dev/ · https://vibecodecomponents.com/navigation-components · https://kinetics.colorion.co/

### 7. `scroll-odometer` — core, medium

Scroll progress re-expressed in domain units (metres descended, % shipped, files processed) with rolling odometer digits in Geist Mono tabular figures, driven by spring-smoothed scrollYProgress so the readout lags and settles physically. Pairs with a hairline progress rail, blue tip only.

**Why:** Scroll-choreography taste in its most distinctive form — 'the scrollbar is an odometer' narrative device from Fable's best pieces, complements (not duplicates) the roadmap scroll-story section, and leverages the already-installed @number-flow/react.

**Sources:** https://fable-25.netlify.app/ · https://motion.dev/docs/react-scroll-animations · https://mobbin.com/discover/apps/ios/latest

### 8. `morph-button` — core, medium

State-morphing CTA that spring-animates through idle pill → inline input → live working state (ticking real-number counter, 'Downloading 142 files', thin progress hairline) → drawn SVG success check, using interruptible Motion layout animation. Radius morphs 6→12px; shape choreography, not material.

**Why:** Merges four sites' button-state ideas into one micro-craft flagship; 'show work, not spinners' plus container continuity is the Family-app-school detail that separates crafted registries from shadcn defaults, and it sits beside glass-button without overlapping it.

**Sources:** https://ui.watermelon.sh/ · https://saveweb2zip.com/en · https://kinetics.colorion.co/ · https://chanhdai.com/components

### 9. `particle-image` — loud, medium

Image/logo sampled into a canvas particle field keeping original pixel colors, with cursor repulsion (configurable force/radius) and spring-based self-reassembly on pointer leave; variant modes for glowing LED-dot cells with bloom falloff and shader pixel-displacement. Color-mode axis: original / single monochrome / palette.

**Why:** Content-driven particles (the particles ARE the image, and it heals itself) are categorically different from the ambient particle-hero; the disintegrate/reassemble loop is peak wow-per-effort for the loud collection and the color-mode axis makes a core monochrome variant free.

**Sources:** https://www.originkit.dev/components/svgparticles · https://app.ditther.com/ · https://www.framer.com/marketplace/components/ · https://transitions.dev/

### 10. `theme-wipe` — core, small

Theme switcher where toggling triggers a full-viewport geometric reveal — expanding circle from the toggle button, optional blur-edge and polygon variants — via the View Transitions API with animated clip-path, graceful instant-switch fallback.

**Why:** The 'signature the boring utilities' thesis in one small component: platform primitives only (zero runtime cost, perfect crispness), a moment every visitor of the preview site experiences, and rarely shipped as an installable piece by the big registries.

**Sources:** https://chanhdai.com/components

### 11. `split-flap-text` — core, medium

Departure-board text in Geist Mono: each character 3D-flips (rotateX half-panels, perspective, backface-visibility) through intermediate glyphs with mechanical, slightly desynced stagger and spring settle; trigger-on-view and speed/stagger props. Monochrome dark panels keep it Geist-restrained.

**Why:** The mechanical/physical counterpart to the roadmap text-morph — tactile in a way gradient text effects never are, flagged independently by two sites, and the split-spans engine it requires becomes the shared primitive for all future ns-ui text choreography.

**Sources:** https://text-effects.colorion.co/ · https://fable-25.netlify.app/

### 12. `blueprint-card` — core, medium

Wrapper that renders any child component as an engineering drawing: graph-paper surface, dashed SVG dimension lines with Geist Mono annotations (W/H/radius/spring values), control-point dots, annotations stroke-drawing in sequentially on hover. Doubles as the ns-ui preview frame that documents each component's own parametric spec.

**Why:** 'Document the math in the UI' is the perfect meta-component for a personal registry — every preview becomes a technical drawing exposing tuned spring values and tokens, an identity move no competing library has, built entirely from the micro-annotation mono system.

**Sources:** https://javii.tools/ · https://designmd.cc/ · https://www.fontshare.com/?q=Clash%20Display

### 13. `terminal-window` — core, medium

Faux-terminal card (traffic-light chrome, #0a0a0a, Geist Mono) that types scripted command sequences on scroll-into-view with variable human-jitter timing, prints ANSI-colored output, box-drawing borders, Unicode block-character sparklines, and an optional collapsible AI 'thinking' block with soft block cursor.

**Why:** Dev-tool hero element straight from the Vercel school; the character-cell constraint gives it instant signature identity, and AI-agent streaming UI is a fast-emerging component category the mainstream registries barely cover.

**Sources:** https://www.termcn.dev/docs/components · https://variant.com/community · https://www.cosmos.so/home

### 14. `cursor-gravity-metal` — loud, large

Full-bleed raymarched liquid-metal/ferrofluid background: SDF metaball field in a fragment shader with HDRI-style reflections, cursor as a gravity well denting and pulling the surface, spring-damped recovery. Runs at reduced internal resolution with IntersectionObserver pause and DPR cap.

**Why:** The apex shader-background statement piece — a continuous physical surface chasing the pointer is categorically beyond particle systems and beyond anything Aceternity ships; large effort is the only reason it is not top-5.

**Sources:** https://fable-25.netlify.app/ · https://endlesstools.io/ · https://21st.dev/home

### 15. `velocity-marquee` — loud, medium

Infinite marquee physically coupled to input: speed and direction driven by live scroll velocity (inverts on scroll-up, spring-settles to idle drift), with a 3D variant where drag momentum and page-scroll boost feed a velocity-mapped skewX/perspective shear so the strip visibly bends with how hard you fling it. Mask-image edge fades.

**Why:** Every registry ships a constant-speed marquee; none ship one with mass. Velocity-as-physics-input is the exact scroll-choreography craft theme, and the contrast with Magic UI's static marquee makes the distinctiveness obvious in a single scroll.

**Sources:** https://motion.dev/docs/react-scroll-animations · https://satisui.xyz/ · https://v0.app/


---

## Per-site findings

### https://bklit.com/charts/live-line-chart
component-library — Bklit UI is a design-engineered React chart component library (a Recharts/Tremor alternative by uixmat, shadcn-style distribution) whose live-line-chart page showcases real-time streaming line charts in many polished dark-mode variants.

- **Live streaming line chart** — Continuously scrolling real-time line with a pulsing live dot at the leading edge, animated axes that re-tick as data flows, and a scrub crosshair, feels like a Bloomberg terminal distilled to minimal dark UI. `[SVG path continuously re-rendered/translated in React with rAF-driven data window, CSS/SMIL pulse on the live dot, crosshair via pointer-tracked overlay lines]`
- **Momentum-colored line variant** — Line stroke switches green/red per segment based on whether the value is rising or falling, encoding a second data dimension into the stroke itself with zero extra chrome. `[Per-segment SVG paths or gradient stops computed from delta sign between points]`
- **Pattern-filled surfaces (dot grid, diagonal hatch) with edge fade** — Area fills and reference bands use dot-grid or diagonal-line textures that fade out at the edges instead of flat color or gradient washes, adds tactile depth while staying monochrome-dark. `[SVG <pattern> fills clipped to the area path, combined with an SVG mask/linearGradient for the edge fade]`
- **Reference bands with dashed edges and bracket markers** — Annotation bands styled like technical drafting marks, dashed boundary lines, small bracket glyphs at the ends, colored Y-axis ticks, rather than the usual translucent rectangle. `[SVG rect + dashed stroke lines + custom bracket path markers positioned from the band's domain values]`
- **Chromatic glitch filter on trusted-by logos** — Homepage logo strip runs logos through a chromatic-aberration glitch effect, RGB channels split and jittered, giving a static section a signature moment. `[SVG filter (feColorMatrix channel isolation + feOffset per channel) or layered copies with mix-blend-mode and animated translate]`
- Candidates: `live-stream-chart` (core/medium); `pattern-surface` (core/small); `chromatic-glitch-text` (loud/medium)
- Lesson: Texture beats gradient in dark UIs: SVG pattern fills (dot grid, diagonal hatch) masked with an edge fade give surfaces depth while staying flat and monochrome, a direct substitute for banned gradient washes.
- Lesson: Encode meaning into the stroke itself: momentum green/red segment coloring shows semantic color used only where it carries data, mirroring the rule that accent color is for interaction/status, never decoration.
- Lesson: Annotations styled as drafting marks (dashed boundaries, bracket glyphs, tinted axis ticks) read far more crafted than translucent overlay rectangles, small technical detailing is what makes minimal components feel design-engineered.

### https://transitions.dev/
component-library — Curated copy-paste gallery of ~33 production-ready micro-interaction transitions (CSS-first with React variants), each an interactive card demo with a one-line technique description.

- **Delete image (shred + smoke)** — Deleting an image shreds it into vertical strips that fall and dissolve into smoke — a destructive action given a physical, memorable exit far beyond a fade-out. `[clip-path/inset slicing into strips, per-strip staggered translate/rotate falls, blur + opacity dissolve, likely a few particle divs for the smoke]`
- **Avatar group hover (distance-falloff lift)** — macOS-dock-style magnification applied to an avatar stack: hovered avatar lifts most, neighbors lift proportionally less, with a bouncy spring return. `[pointer-position-driven per-item transform scaled by distance from cursor, spring easing on release]`
- **Dropdown menu morph** — The trigger button itself morphs into the menu surface (Family-app style) instead of spawning a separate popover — container continuity makes the menu feel like one object. `[animated width/height/border-radius interpolation of a shared surface with origin-aware transform-origin, content cross-fade with slight blur]`
- **Number pop-in / spinning counter** — Digits flip or spin like a slot reel to the target value with per-digit stagger and motion blur, making dry numeric updates feel mechanical and alive. `[per-digit stacked columns translated vertically, staggered delays, filter: blur() during travel, cubic-bezier overshoot]`
- **Organic shimmer text** — Not the standard linear shimmer sweep — a wavy, organic gradient pass with an edge glow that reads like light rippling across the letters. `[background-clip:text masked gradient animated along a non-linear path, possibly SVG turbulence/displacement or layered keyframed background-position]`
- Candidates: `morph-menu` (core/medium); `shred-delete` (loud/medium); `dock-avatars` (core/small)
- Lesson: Blur is a motion primitive: pairing scale/translate with a transient filter: blur() (icon swap, toast, digit flip) makes UI elements read as physically fast rather than tweened — worth encoding as a default in ns-ui enter/exit transitions.
- Lesson: Asymmetric timing intent: tooltips use a delayed, eased entrance but an instant exit — entrances sell craft, exits must never block the user. Encode enter != exit durations across components.
- Lesson: Origin-aware transforms: menus and modals scale from the trigger's actual position (transform-origin computed from anchor), which is what makes them feel attached to the UI instead of floating in — cheap to implement, large perceived-quality gain.

### https://www.termcn.dev/docs/components
component-library — termcn is a shadcn-style registry of ~90 terminal UI components (built on Ink, React-for-CLI, plus OpenTUI themes) — layout, forms, data, charts, and a full AI/agent-chat suite, distributed via the shadcn CLI/registry and an MCP server.

- **AI component suite (Chat Thread, Streaming Text, Thinking Block, Tool Call, Tool Approval, Token Usage)** — A complete, opinionated kit for building Claude-Code-style agent CLIs — treats streaming text, collapsible thinking blocks, tool-call approval prompts, and token meters as first-class reusable components, a taxonomy almost no web library has yet `[Ink (React reconciler emitting ANSI escape sequences), interval-driven character streaming and state-machine spinners re-rendered per frame]`
- **Embedded Terminal** — A terminal-inside-your-terminal component — runs a pty subprocess and renders its output inside an Ink layout region, enabling IDE-like TUI composition `[node-pty style pseudo-terminal piped through an ANSI parser into a scrollable Ink box]`
- **Charts in the terminal** — Dedicated charts section rendering data viz entirely in character cells — bars, sparklines, progress circles — proving dashboards don't need pixels `[Unicode block/braille characters (▁▂▃▅█, ⣿) mapped to value buckets, colored via ANSI 256/truecolor]`
- **Theming with classic terminal palettes (Zenburn etc.)** — Ports shadcn's CSS-variable theming model to ANSI color tokens, so one component set reskins across nostalgic terminal color schemes `[Token map of semantic roles to truecolor ANSI values injected via React context]`
- **Big Text + Gradient typography** — Display typography for CLIs — figlet-style ASCII letterforms with smooth multi-stop color gradients flowing across the glyphs `[ASCII-art font rasterization with per-character color interpolation via ANSI truecolor escape codes]`
- Candidates: `streaming-response` (core/small); `terminal-window` (core/medium); `ascii-sparkline` (core/small)
- Lesson: Constraint as identity: the entire library derives its look from the character-cell grid (box-drawing borders, block-glyph charts, monospace rhythm) — adopting one hard constraint per component gives ns-ui pieces a recognizable signature faster than adding effects.
- Lesson: AI-agent UI is now a component category, not an app feature: streaming text, thinking blocks, tool-approval prompts, and token meters are reusable primitives worth standardizing in a registry.
- Lesson: shadcn's registry + CSS-token theming model generalizes to any render target (here ANSI colors in a CLI) — keep ns-ui components token-driven so core/loud reskins are a variable swap, not a fork.

### https://www.originkit.dev/components/svgparticles
component-library — Originkit is a free animated React component library (~50 flashy interaction components); this page documents "SVG Particle", which decomposes an image or SVG into an interactive particle field with hover and cursor-repulsion physics.

- **SVG Particle (the target component)** — An image is sampled into a grid of particles (square/circle/mixed) that keep the original pixel colors so the picture stays readable, then reacts two ways: hover 'roam' (particles drift within bounds) or 'hide' (they scatter away), plus continuous cursor repulsion with configurable force and radius. The image reassembles when the cursor leaves, giving a satisfying disintegrate/heal loop. `[Image drawn to an offscreen canvas, pixels sampled at a density set by particleCount, each sample rendered as a positioned dot (SVG elements or canvas draw) with per-particle spring return + inverse-distance cursor repulsion vector]`
- **Live controls-panel documentation** — Every API prop maps 1:1 to a slider/toggle/color-picker on the demo ("All props map directly to the controls panel"), with Random and Reset All Settings buttons — docs double as a playground, so users discover the prop space by feel before reading the table. `[React state-driven controls panel re-rendering the live component; prop table generated from the same config schema]`
- **Color-mode system (original / single / palette)** — One effect spans three brand contexts: 'original' keeps photo fidelity, 'single' turns any image into a monochrome dot-matrix mark, 'multi' distributes a palette across particles — a small API choice that makes one component fit both restrained and loud design systems. `[Per-particle fill assignment at sample time: read pixel RGBA, override with constant, or index into a palette array]`
- **Breadth of particle/pixel family (Particle Sphere, Particle Tunnel, Pixel Drift, Pixel Reveal, Pixelate Image)** — The library clusters ~6 sibling components around the same sampling idea (sphere formations, tunnel fly-throughs, pixelation reveals), shown only as video previews on the homepage — seen at listing level, not inspected in detail. `[Likely canvas/WebGL point rendering variants of the same image-sampling core (secondhand, from names and previews only)]`
- Candidates: `particle-image` (loud/medium); `dot-matrix-logo` (core/small)
- Lesson: Split pointer interaction into independent, individually-toggleable systems (hover behavior vs. cursor repulsion, each with its own config object) — composable motion beats one monolithic 'interactive' prop and makes the core/loud split a config difference, not a fork.
- Lesson: Give every visual effect a color-mode axis (source-color / single / palette): the same component then serves both a restrained monochrome system and a flashy showcase, which maps directly onto ns-ui's core vs loud collections.
- Lesson: Docs-as-playground: mirror every prop with a live control plus Random and Reset buttons; users internalize the prop space by manipulation before reading the API table — worth adopting for ns-ui preview pages.

### https://text-effects.colorion.co/
component-library — A free MIT library of 66 self-contained pure-CSS animated text effects (aurora gradients, glitches, split-flap boards, liquid fills), each copyable as CSS or as a ready-made AI prompt.

- **Split-Flap (DEPART)** — Airport departure-board letters that flip in per-character with mechanical stagger, an unusually tactile, physical-feeling text reveal done with no JS. `[Per-letter spans with 3D rotateX flips (perspective + backface-visibility) and staggered animation-delay, pure CSS]`
- **Borealis / Aurora** — Slow drifting aurora colors living inside the glyphs themselves rather than behind them, rich without being garish. `[Multi-stop animated gradient with background-clip: text and animated background-position/hue-rotate]`
- **Aqua-Fill** — Liquid fill that rises inside letterforms with a wavy meniscus, a lesser-seen trick vs the usual fade/slide reveals. `[background-clip: text with an animated wavy background (radial/wave gradient or SVG wave) translating upward]`
- **Phosphor (CRT_MODE)** — Convincing CRT terminal look: scanlines, phosphor glow bloom and subtle flicker on type, strong retro atmosphere from tiny ingredients. `[repeating-linear-gradient scanline overlay + layered text-shadow glow + opacity-flicker keyframes]`
- **Cipher / Redactor decode** — Text that resolves from scrambled/redacted glyphs into the real string, hacker-decode feel achieved without JS character shuffling. `[Per-character pseudo-element content swaps / clip-path scanner bar with staggered CSS keyframes]`
- Candidates: `split-flap-text` (core/medium); `decrypt-text` (core/small); `aurora-text` (loud/small)
- Lesson: Per-letter span choreography with staggered animation-delay is the single engine behind most premium text effects; ns-ui should ship one shared split-into-spans primitive that all text components reuse.
- Lesson: Every effect paints through one --ink color token, making 66 wildly different effects instantly theme-portable; parameterize ns-ui effect components the same way instead of hardcoding palettes.
- Lesson: Every animated snippet ships a prefers-reduced-motion fallback (static end state) as part of the component contract, not an afterthought; plus their 'copy the CSS or copy an AI prompt' dual-distribution is a clever registry idea worth considering for ns-ui docs.

### https://kinetics.colorion.co/
component-library — Kinetics is a free open-source library of 117 spring-physics micro-interactions (buttons, inputs, feedback states), each shipped as CSS, React, and an AI prompt with a live stiffness/damping readout.

- **Live spring-parameter readout per demo** — Every effect card displays the exact tuned stiffness/damping/mass values (e.g. 'damping 24 stiffness 320 mass 1.0') plus an easing-curve visualization, so users copy calibrated springs instead of guessing bezier values. Turns motion tuning into a first-class documented artifact. `[RAF-driven spring solver with DOM readout; cubic-bezier approximation rendered as inline SVG curve]`
- **Magnetic Button + Squish Button family** — Buttons that attract the cursor within a proximity radius and compress with weight on press — the motion feels physical because the spring is interruptible mid-flight rather than a fixed-duration transition. `[pointermove distance tracking mapped to translate via spring interpolation in a RAF loop; GPU-composited transforms only]`
- **Checkbox Draw / Underline Draw / Success Check** — State changes drawn as strokes rather than faded in — the checkmark literally draws itself with spring overshoot at the end, a small detail that reads as hand-crafted. `[SVG stroke-dasharray/stroke-dashoffset animated with spring easing]`
- **Elastic Lasso and Rubber-band Slider** — Overscroll/out-of-bounds input met with rubber-band resistance and elastic snap-back, borrowing iOS physics for web controls — deformation communicates constraint instead of a hard clamp. `[JS pointer tracking with logarithmic resistance function feeding spring return animation]`
- **Scramble Reveal + Odometer Count-up text effects** — Text choreography where characters resolve from noise or digits roll with momentum and overshoot, giving typography literal weight. `[per-character interval scramble (randomized glyph cycling) and translateY digit columns with spring settle]`
- Candidates: `magnetic-button` (core/small); `hold-to-confirm` (core/small); `inertial-dial` (core/medium)
- Lesson: Publish tuned spring values (stiffness/damping/mass) as documented defaults on every animated component instead of duration+bezier — calibrated physics is copyable, guessed easing is not.
- Lesson: Springs must be interruptible: retarget mid-animation from current position/velocity rather than restarting, which is what makes hover/press motion feel physical instead of scripted.
- Lesson: Communicate constraints through elastic deformation (rubber-band resistance at bounds, overshoot on settle) rather than hard clamps or instant state swaps; keep it all on GPU-composited transforms.

### https://ui.unlumen.com/components
component-library — Unlumen UI is a freemium React/Tailwind/Motion component library ("motion and restraint" positioning) with ~50 components across animations, WebGL/canvas backgrounds, gooey navigation, image effects, and animated SVG icons.

- **Pixel Liquid Background** — Real-time Navier-Stokes fluid sim that reacts to cursor, then deliberately degrades it through pixelation, Bayer dithering, and film grain for a retro-CRT look; auto-demos after ~1.2s of idle cursor and theme-switches palettes live via MutationObserver. `[WebGL fragment-shader fluid solver (Three.js) at 0.4x resolution, plus pixelate/dither/noise post-processing shader passes]`
- **Pixel Scroll Transition** — Section-to-section wipe where a grid of pixels dissolves between two colors as you scroll, with 6 directions x 6 algorithmic patterns (spiral, wave, checker, radial) and temporary accent-color pixel bands mid-transition; sticky and inline modes. `[HTML5 canvas pixel grid redrawn from eased scroll progress, DPR-aware, no animation library]`
- **Vercel Snap Text** — Scroll-driven text list with a clever dual-layer trick: an invisible native scroll-snap overlay (scroll-snap-type: y mandatory) provides the index, while a spring-animated visible track centers the active row and fades neighbors by distance (opacity = 1 - dist x 0.82). Zero JS scroll-position rounding. `[CSS scroll-snap overlay + Motion spring track, ResizeObserver height sync]`
- **Gooey SVG Filter (+ Gooey Navbar)** — Reusable liquid-merge primitive: adjacent moving elements blob together like mercury, used for pill selectors and expanding menus; ships with Safari-detection hook because the alpha-contrast trick only fully works in Chromium. `[SVG filter chain: feGaussianBlur then feColorMatrix alpha-contrast sharpening, applied via filter: url(#id); Framer Motion layout animation on top]`
- **Gravity Stars** — Canvas particle background with actual physics craft: cursor attract/repel, click-spawn bursts, star-to-star bounce/merge collisions with three glow-response modes (snap, lerp, damped spring), toroidal edge wrapping, and IntersectionObserver pause when off-screen. `[HTML5 canvas + JS physics in CSS-pixel space, DPR capped at 2x, O(n^2) collisions capped at 80 particles]`
- Candidates: `pixel-dissolve-section` (loud/medium); `gooey-pill-nav` (core/medium); `cursor-media-trail` (loud/small)
- Lesson: Decouple scroll position from animation state: use native CSS scroll-snap on an invisible overlay to get a discrete index for free, then drive springs from that index — no scroll-math rounding, and momentum feel comes from the browser.
- Lesson: Post-process expensive shaders downward, not upward: running a fluid sim at 0.4x resolution and adding pixelation/dither turns a performance cap into an aesthetic, worth encoding for any ns-ui shader background.
- Lesson: Effects components should ship their own lifecycle hygiene as API: IntersectionObserver pause off-screen, DPR cap at 2x, WebGL disposal on unmount, idle auto-demo after ~1s, and documented Safari fallbacks (gooey filter) — Unlumen documents these per component and it reads as craft.

### https://satisui.xyz/
component-library — SATIS UI is a shadcn-registry React component library by design engineer Satish Kumar offering Awwwards-style animated components (carousels, cards, text animations, scroll "wheels") built with Motion + GSAP.

- **3D Drifting Marquee** — Infinite image marquee with cinematic physics: cards drift with perspective (5000px), skewX dynamically mapped to velocity from three inputs (auto-scroll, drag momentum, page-scroll boost), grayscale-to-color on hover, rotateY/rotateX entry animations. `[Motion (motion/react) motion values + CSS 3D transforms (perspective, preserve-3d), wrap() utility for seamless looping, spring easing, frame-loop rather than CSS animations]`
- **Proximity Image Row** — macOS-Dock magnification for an image row: Gaussian distance falloff around the cursor so neighbors swell proportionally, with LERP-smoothed 60fps tracking and optional grayscale desaturation of inactive images. Docs explicitly bypass React state ("too slow") for direct DOM writes. `[requestAnimationFrame loop + direct DOM style manipulation, Gaussian distance math + tunable lerpFactor; simpler hover variant uses CSS transitions with exponential index-decay growth factors]`
- **Radial Scroll Gallery** — A 'buried wheel': items placed trigonometrically on a large circle whose lower half is hidden by a CSS gradient mask; scrolling pins the section and rotates the wheel 360° over ~2500px, hovered items scale up while others fade/blur. Keyboard accessible. `[GSAP ScrollTrigger pinning + scrub-driven rotation, sin/cos item placement, CSS mask-image gradient for the depth cutoff, render-prop children]`
- **Fanned Card Stack** — Carousel where cards fan out like a held hand of playing cards instead of a linear track, giving physical stacked depth to a standard pattern. `[Motion/GSAP rotate+translate transforms from a shared pivot with per-index angle offsets]`
- **Typography Reveal / text animation set** — A full family of text choreography primitives (Color Cycle, Flipping Word Swap, Fluid Text, Sparkles Text, Reveal Text) treating type as the animated hero rather than decoration. `[Per-character/word splitting with staggered Motion transforms; GSAP for scroll-triggered sequencing]`
- Candidates: `proximity-row` (core/medium); `drift-marquee` (loud/large); `radial-wheel` (loud/large)
- Lesson: For fluid cursor-tracking effects, skip React state entirely: run a requestAnimationFrame loop writing styles directly to DOM nodes with lerp smoothing (tunable lerpFactor) — SATIS documents this as required for 60fps.
- Lesson: Map distortion to velocity, not time: skew/tilt proportional to scroll or drag speed (clamped to +/- maxSkew*2) makes motion read as physical mass; combine multiple velocity sources (autoplay, drag, page scroll) into one value.
- Lesson: Grayscale-to-color transition is a cheap, layout-stable focus signal — desaturate inactive siblings and restore color on proximity/hover instead of resizing or re-bordering; pairs well with CSS gradient masks that 'bury' geometry to fake depth.

### https://chanhdai.com/components
component-library — Personal shadcn-registry component library by Chanh Dai (@ncdai): 35 pixel-perfect React/Tailwind/Motion components in a minimalist Vercel-school portfolio site, installable via `shadcn add @ncdai/<name>`.

- **Apple Hello Effect** — Faithful recreation of Apple's handwritten 'hello' boot screen, with localized variants (English, Hindi, Spanish, Vietnamese) that keep the same handwriting choreography — rare craft depth for a free component. `[SVG path stroke-draw animation using pathLength with Motion's animated stroke-dashoffset; durationScale prop and onAnimationComplete callback for sequencing into page intros.]`
- **Theme Toggle Effect** — Theme switch becomes a full-screen geometric wipe (circle, triangle, polygon variants, some with blur) instead of an instant repaint — turns a utility toggle into a signature moment. `[View Transitions API (document.startViewTransition wrapping setTheme) plus animated CSS clip-path on the transition pseudo-elements; graceful no-animation fallback for unsupported browsers.]`
- **TOC Minimap** — Notion/Vercel-style collapsed line minimap of headings that expands to a full TOC on hover, with depth-aware line lengths and scroll-synced active state — long-form nav as a piece of micro-craft. `[Scroll-driven active-heading tracking (IntersectionObserver-style) driving a hover-expandable list; heading depth mapped to line width in the collapsed state.]`
- **Slide to Unlock** — iPhone-classic unlock affordance rebuilt as a composable compound component (Track/Handle/Text) with a shimmering-mask label, spring drag physics, and an onUnlock callback — playful but production-grade API design. `[Motion drag gesture with spring physics on the handle; label uses an animated shimmer via a moving gradient mask (background-clip: text / mask-image sweep).]`
- **Fluid Gradient Text** — Text gradient that flows toward the cursor as you move across it — interactive color without canvas or shaders, so it stays crisp and cheap. `[SVG text with a linearGradient whose position is recalculated from horizontal pointer coordinates, smoothed with eased transitions.]`
- Candidates: `theme-wipe` (core/small); `toc-minimap` (core/medium); `slide-to-confirm` (core/medium)
- Lesson: Signature the boring utilities: chanhdai's most-shared pieces (theme toggle wipe, TOC minimap, copy button) are mundane controls given one exceptional motion detail — higher ROI than another hero effect.
- Lesson: Prefer platform primitives over canvas: View Transitions + clip-path, SVG pathLength stroke-draw, and SVG gradient tracking deliver 'shader-feeling' effects at near-zero runtime cost and perfect text crispness — good default before reaching for WebGL in the core collection.
- Lesson: Ship compound-component APIs (SlideToUnlock.Track/Handle/Text pattern) plus sequencing hooks (onAnimationComplete, durationScale) — composability and choreography props are what make registry components feel professional rather than demo-ware.

### https://vibecodecomponents.com/navigation-components
component-library — Vibe Code Components is a free/premium copy-paste UI component library; this page is its navigation category with ~11 nav patterns (navbars, menus, breadcrumbs, dock, tabs, pagination) with live previews.

- **Dock Navigation (macOS-style)** — Horizontal icon bar with proximity magnification, icons scale up smoothly as the cursor nears, the one genuinely playful piece on an otherwise conventional page `[JS mousemove tracking cursor x-distance per icon, mapped to a scale transform with CSS transitions (or spring interpolation); no canvas/WebGL]`
- **Floating Action Button cluster** — Expandable FAB where child actions pop out with staggered scale-in and the main icon rotates into an X, tight choreography for a small component `[CSS transforms with per-child transition-delay stagger plus icon rotation transition]`
- **Slide-In Menu** — Off-canvas sidebar with frosted backdrop overlay, profile header, and pinned sign-out footer, a complete pattern rather than a bare drawer `[translateX panel transition plus backdrop-filter: blur overlay with opacity fade]`
- **Animated Tab Bar** — Sliding active indicator that glides between tabs, offered in pill and underline variants `[Absolutely positioned indicator animated via left/width transitions or a shared-layout translate (FLIP-style)]`
- Candidates: `magnetic-dock` (core/medium); `sliding-tabs` (core/small); `orbit-fab` (loud/small)
- Lesson: Stagger is the cheapest wow: nearly every component here that reads as 'polished' is just per-child transition-delay of 30-60ms on scale/opacity, encode a standard stagger token into ns-ui motion presets.
- Lesson: Proximity-driven scaling (dock magnification) reads far better with a falloff curve (scale as a function of cursor distance) than binary hover states, worth a reusable useProximity hook.
- Lesson: Off-canvas overlays land best as a pair: panel translateX plus a backdrop-filter blur scrim fading in together, treat scrim + panel as one choreographed unit, not two independent animations.

### https://ui.watermelon.sh/
component-library — Watermelon UI is a free open-source React component registry (600+ components, 100+ animations) heavily weighted toward Motion-driven micro-interactions, organized by interaction type (disclosure, micro-interaction, widgets) plus blocks, dashboards, and templates.

- **Morphing Button ("Notify Me")** — A single button that shape-shifts through states (idle → expanded input → confirmation) as the landing page's flagship micro-interaction demo, sold under a bracketed "[ MORPHING BUTTON ]" spec label. `[Likely Motion (framer-motion) layout animation with AnimatePresence, spring easing on width/border-radius morph]`
- **Knob Slider with odometer digits** — A rotary knob control paired with vertical 0-9 digit reels (raw "0123456789" strips visible in markup) that roll like a mechanical odometer as the knob turns — instrument-panel feel rare in web UI kits. `[Drag-to-rotate pointer math on the knob plus translateY-animated digit columns (each digit a stacked 0-9 strip), driven by Motion transforms]`
- **Telemetry/instrument editorial system** — Section labels written as monospace machine annotations — "//TELEMETRY DATA", "SYS.01X-AXIS", "[ WATERMELON-UI.COM/TEMPLATES ]" — give a dark neutral SaaS page a distinct instrument-panel voice with zero heavy graphics. `[Pure typography: monospace font, uppercase, slashes/brackets as decoration; CSS only]`
- **Micro-interaction catalog (43 components)** — The largest category is app-fragment morphs rather than primitives: Dock Component, Family Wallet, Contextual AI Bar, Copy Confirm, Feature Tour, Fractional Picker — each a small self-contained product moment, closer to Emil Kowalski / Family-app craft than shadcn primitives. `[Motion layout/shared-layout transitions, staggered AnimatePresence mounts, interruptible spring animations]`
- **DM-screenshot testimonial marquee** — Social proof rendered as labeled "DM" / "TWEET" cards in an infinite marquee, making informal Twitter DMs feel like verified receipts — more credible-feeling than polished quote cards. `[CSS keyframe marquee with duplicated list, unavatar.io for live avatars]`
- Candidates: `morph-button` (core/medium); `knob-dial` (core/medium); `ai-command-bar` (core/medium)
- Lesson: Monospace machine-annotation labels ("//SECTION NAME", "[ COMPONENT NAME ]") are a near-free way to give a dark neutral registry a distinct instrument-panel identity — ns-ui could adopt a Geist Mono bracket-label convention for preview frames.
- Lesson: Package micro-interactions as tiny complete product moments (a wallet, a dock, a copy-confirm) instead of bare primitives — a component demo that tells a one-second story reads as far higher craft than an isolated button.
- Lesson: Volume without a unifying system reads as AI-generated: Watermelon's own testimonials flag inconsistency across its 600 components. A small set with one enforced motion/typography DNA (ns-ui's approach) beats breadth.

### https://21st.dev/home
component-library — 21st.dev is a community marketplace of thousands of React/Tailwind components, templates, themes, shaders, and ASCII art with a shadcn-style install flow, MCP server, and AI generation.

- **Liquid Metal Button (@johuniq, 1.0k saves)** — Button surface reads as flowing chrome/mercury that deforms on hover, a level of material realism far beyond gradient buttons `[WebGL fragment shader (or animated SVG turbulence/displacement filter) rendered behind masked button text, pointer-uniform driven]`
- **Horizon Hero Section (@lovesickfromthe6ix, 2.9k saves)** — Cinematic 3D horizon/terrain hero where scroll flies the camera through the scene, hero-as-a-journey rather than a static banner `[three.js/react-three-fiber scene with camera position bound to scroll progress (scroll-driven camera rig)]`
- **Hero ASCII (@larsen66, 1.1k saves)** — Full hero rendered as animated ASCII characters; monochrome terminal aesthetic that is high-craft but zero-color; 21st gave ASCII its own top-level category, signaling a real trend `[canvas/WebGL scene downsampled per-frame to a character grid (luminance-to-glyph mapping), drawn in a mono font]`
- **Tubelight Navbar (@ayushmxxn, 2.9k saves)** — Active nav item lit by a glowing 'tube' that slides between items with spring physics, tiny component, huge perceived polish `[Framer Motion layoutId shared-element indicator plus layered blurred box-shadows/pseudo-element for the neon glow]`
- **Glare Card / Image Cursor Trail (Aceternity 799 / @m.umairwaheedansari 553)** — Two flavors of cursor-reactive craft: holographic glare that tracks the pointer across a tilting card, and a trail of images spawning along the cursor path `[Glare: pointer-position CSS vars driving a rotating conic/radial gradient overlay + 3D transform. Trail: DOM image stack spawned on pointermove with lerped position and staggered scale/fade-out]`
- Candidates: `ascii-shader-hero` (core/medium); `tubelight-nav` (core/small); `cursor-image-trail` (loud/medium)
- Lesson: One italic serif word inside a bold sans headline ('Build something *beautiful*') is a cheap, high-impact emphasis device: contrast via style, not color.
- Lesson: Cursor-reactive components (glare, trails, parallax floating, spotlights) consistently outrank static equivalents in saves — expose pointer position as CSS vars/uniforms as a standard pattern in interactive ns-ui components.
- Lesson: Monochrome ASCII/terminal rendering is a rising aesthetic (own top-level category on 21st): shader-level motion expressed in mono glyphs reads as craft without breaking a no-gradient, dark-neutral system.

### https://www.framer.com/marketplace/components/
component-library — Framer's official marketplace of community-made UI components (5K+ items across Interactions, Carousels, Typography, Backgrounds, Buttons, etc.), with a Featured row of effect-heavy components.

- **Pixel Distortion (Munzir Kareem, $8)** — Cursor-reactive pixelation/displacement of images — the image breaks into shifting pixel blocks under the pointer, a tactile 'digital decay' effect rarely seen outside awwwards sites. `[WebGL fragment shader on an image texture: UV quantization + displacement driven by a cursor-trail render target]`
- **Halftone Media FX (Lee Black, $30)** — Live halftone rasterization of any image/video — media rendered as animated print-style dot grids; priced at $30, the marketplace's premium tier, signaling perceived craft value. `[Canvas/WebGL shader sampling media luminance and drawing size-varying dots per grid cell, animatable dot scale/angle]`
- **Image Spheres (Thanh Tran, $5)** — Image thumbnails arranged on a rotating 3D sphere, an instantly memorable gallery hero treatment. `[Three.js: plane sprites positioned via spherical coordinates, billboarded to camera, inertia rotation from drag]`
- **Scroll Sequences (Cristian Mielu, free)** — Apple-style scroll-scrubbed image-sequence playback, turning scroll position into cinematic frame-by-frame animation. `[Canvas drawing preloaded frame images indexed by scroll progress (IntersectionObserver + rAF, or scroll-driven animation timeline)]`
- **Kinetic Wheel (Thanh Tran, $5)** — Drag-driven circular carousel where items ride a wheel with momentum, so navigation itself becomes the visual hook. `[Pointer-drag velocity mapped to wheel rotation with spring/inertia physics; items placed by angle with transform rotate/translate]`
- Candidates: `progressive-blur` (core/small); `light-sweep` (core/small); `pixel-distortion-image` (loud/large)
- Lesson: Effect components sell as single-purpose primitives: one effect, one prop surface (Pixel Distortion, Light Sweep, Progressive Blur), not multi-mode mega-components — keep ns-ui entries similarly atomic.
- Lesson: Category demand ranking is a roadmap signal: Interactions (1.9K) > Carousels (829) > Typography (630) > Backgrounds (577) > Buttons (540) — interaction/motion primitives and carousels dominate what builders actually want.
- Lesson: Every featured card leads with a motion-implying still (mid-distortion frame, sweep highlight caught mid-pass): preview thumbnails for ns-ui should capture the effect at its most dynamic instant, not the resting state.

### https://www.1001fonts.com/gc-avalance-demo-font.html
font — A 1001fonts listing page for "GC Avalance Demo", a free-for-personal-use geometric neo-modern sans by Glyphonic in eight weights, presented with the site's standard type-tester tools.

- **Live custom-text type tester** — Real-time preview of user-typed text rendered in every weight of the family with an adjustable size control (24pt to 240pt), the classic font-directory tester pattern done functionally rather than beautifully. `[Plain DOM text nodes with @font-face loaded webfonts, a range input driving font-size, no canvas or WebGL]`
- **Weight waterfall view** — Each of the eight weights (Thin to Extra Bold) shown as a cascading specimen at multiple sizes, letting you scan the family's weight axis at a glance. `[Repeated styled text rows per font file; server-rendered HTML with per-row font-family/size CSS]`
- **Character map grid** — Per-style glyph grid (53 characters each), a compact inventory view of the typeface. `[CSS grid of glyph cells rendered with the webfont]`
- Candidates: `type-tester` (core/medium)
- Lesson: A weight waterfall (same string repeated across the full weight axis) is the fastest way to communicate a type family's range; the pattern transfers directly to showcasing any design-token scale (spacing, radius, color ramps).
- Lesson: Live editable specimen text beats static screenshots for typography components; letting the viewer type their own string creates instant engagement with near-zero implementation cost.
- Lesson: Geometric neo-modern sans families lean on tight kerning (1,680 pairs here) at display sizes; when building hero text components, apply tightening letter-spacing as size increases, matching the Geist heading rule already in the design DNA.

### https://glyphonic.gumroad.com/?section=K5mawmOEQwxo6vUb1VtYnw%3D%3D
font — Gumroad storefront for Glyphonic Studio, a type foundry selling ~89 "GC"-prefixed display/sans/serif fonts via image-card specimen grids on the stock Gumroad template.

- **Specimen-image product cards** — The only visual identity work on the page: each font is sold via a pre-rendered raster specimen card (big type samples in curated sections: Popular, Sans Collection, Serif Collection). All craft lives in the images, none in the page itself. `[Static raster images in the default Gumroad storefront grid — no custom CSS, JS, or effects on the page.]`
- Lesson: Type specimens sell themselves when set huge: a component's demo/preview card can be a single oversized text sample rather than a UI mockup — worth remembering for ns-ui registry preview cards.
- Lesson: Curated groupings (Popular / Sans / Serif) beat a flat grid for a large catalog; ns-ui's core/loud split could similarly surface a 'Popular' shelf as the catalog grows.

### https://www.fontshare.com/?q=Clash%20Display
font — Fontshare is the Indian Type Foundry's free font library (100 families, e.g. Clash Display) with a spreadsheet-like cream/black editorial UI built around live, editable type specimens, a glyph inspector, and rich filtering.

- **Glyph inspector with live metric rulers** — Hovering a cell in the A-Z glyph grid instantly renders that glyph huge (~350px) beside labeled hairline rulers showing real font metrics with values (Cap Height 670, x-height 494, Baseline 0, Descender -170), plus the Unicode codepoint (U+0052) and a weight-style switcher and Solid/Outlines toggle. `[Live HTML text rendering of the loaded webfont with absolutely-positioned 1px hairlines placed from font-metric data; hover state on grid cells drives the preview via shared state, no canvas needed]`
- **Editable specimen cards with global sync** — Every font preview row is directly editable ('Click on text to edit'), and a single sticky 'Your Text' field, size slider (8-280px), alignment toggles, and light/dark swatch re-render ALL specimens at once. Preset content modes (Cities / Excerpts / Names) swap the sample copy across the whole list. `[contenteditable specimen elements bound to shared React state; size slider maps to font-size, dark/light toggles flip per-card theme classes]`
- **Hairline-grid chrome with inverted active tab** — The entire layout is drawn with 1px hairline rules like a printed specimen sheet; the active nav item ('Fonts') is a solid black block reversed out of the cream #FFF9E5 background with its count (100) as a small superscript figure. Zero shadows, zero gradients, still reads as premium. `[Pure CSS: 1px borders on a rigid grid, background/color inversion for active state, small-caps/superscript counters]`
- **Personality + property filter columns** — Collapsible filter columns in the sticky header combine taste-based tags (Informal, Futuristic, Dirty, Luxurious) with typographic range sliders (weight 50-1000, No. of Styles 1-20+, Width, Contrast, Edges, x-Height) — filtering fonts by measured letterform properties, not just category. `[Accordion columns with custom dual-handle range sliders driving client-side filtering of font metadata]`
- **Per-weight style ledger on family pages** — The Styles tab lists each weight (Extralight through Bold) as its own full-width 120px live specimen row with a tiny gray weight label and a '+ Add Style' action per row, turning font weights into a scannable ledger you build a download cart from. `[Repeated live-text rows with variable-font weight settings; sticky section tab bar (Styles/Glyphs/Layouts/Details/License) with underline indicator scrolls/switches sections]`
- Candidates: `glyph-inspector` (core/medium); `type-tester-card` (core/medium); `inverted-tab-nav` (core/small)
- Lesson: Hierarchy without shadows or gradients: one flat background, pure-contrast foreground, and 1px hairline rules everywhere creates a premium editorial 'specimen sheet' feel — directly transferable to Geist dark by using #2e2e2e hairlines instead of elevation shadows.
- Lesson: Make the content the control: contenteditable previews and hover-driven specimens invite play far more than static demos — ns-ui component previews should be directly manipulable (type into them, drag weight), not just watched.
- Lesson: Extreme scale contrast as the core visual device: 10-11px muted uppercase metadata labels (metric names, codepoints, counts) set against 120-280px display text — tiny mono annotations next to huge type is a cheap, repeatable way to look crafted.

### https://craftwork.design/catalog?filterByPrice=free
gallery — Craftwork.design is a curated digital design-asset marketplace (UI kits, illustrations, mockups, icons, gradient packs, Framer templates), here filtered to its free tier — static downloadable assets, not live coded components.

- **Mesh Gradients pack (97 backgrounds)** — Large curated set of soft multi-point mesh gradient backgrounds, a look that is hard to get right by hand and here pre-tuned for hue harmony `[Static raster/vector exports of mesh gradients — reproducible in code via layered radial-gradients or a WebGL/canvas noise-blended shader]`
- **Vertex 3D glass illustrations** — Glassy translucent 3D shapes with refraction and edge highlights, exactly the liquid-glass aesthetic in modern SaaS heroes `[Pre-rendered 3D (Blender-style glass shader) shipped as images; live equivalent would be react-three-fiber with transmission/thickness materials]`
- **Multi-image product cards on the catalog** — Each card cycles several preview shots with creator attribution and a clean Free badge — dense information with no visual noise `[Standard CSS grid cards with image carousels/hover-swap; craft is in the curation and spacing, not exotic code]`
- **Device mockups (iPhone 17 Pro, iPad Pro, MacBook)** — High-fidelity device frames with realistic lighting for dropping screenshots into marketing pages `[Photoshop/Figma smart-object PSDs — static assets]`
- Candidates: `mesh-gradient-bg` (loud/medium); `glass-object-3d` (loud/large)
- Lesson: Pre-curated palettes make gradients work: Craftwork ships 97 tuned mesh gradients rather than a generator — a gradient component should expose named curated palettes, not raw color pickers
- Lesson: Dense catalog cards stay calm by giving each card exactly three information slots (preview, creator, price badge) with generous internal padding — a pattern worth keeping for the ns-ui preview site grid
- Lesson: The liquid-glass look reads as premium mainly through edge behavior (bright rim highlights and refraction at silhouette edges), so glass components should invest in border/edge treatment more than surface blur

### https://logosystem.co/
gallery — Logosystem is a free curated gallery of 1,200+ real logos (static, animated, app icons) with deep faceted filtering and designer attribution, plus a beta AI moodboard generator.

- **Faceted filter system** — Six orthogonal filter dimensions (type, industry, style, shape, color, mood) with 100+ total options, yet the browsing experience stays lightweight — filtering is the site's primary navigation, not an afterthought sidebar. `[Client-side chip toggles driving a filtered grid, likely React state + URL params with Next.js, infinite-scroll loading state]`
- **Animated logo grid** — A whole collection of motion logo marks presented in a uniform grid — motion becomes the content itself, each cell a looping mark that reads instantly at thumbnail size. `[Looping muted video/GIF assets in grid cells (autoplay or hover-to-play), Next.js image/video optimization, infinite scroll]`
- **Attribution-first cards** — Every logo cell links back to the original designer's Behance/Instagram/X — credit is a structural part of the card, not a footnote, which builds trust for a reference library. `[Simple anchor-wrapped grid cells with creator metadata; content model discipline more than visual trickery]`
- **Neutral content-first chrome** — The UI itself is nearly invisible — flat grid, minimal type, no decoration — so hundreds of wildly colorful logos read as the design. Restraint as a deliberate strategy for showcase surfaces. `[Plain CSS grid, generous gutters, monochrome UI chrome]`
- Candidates: `hover-play-card` (core/small); `filter-chips` (core/medium)
- Lesson: Showcase chrome should be nearly invisible: when the content is colorful (logos, demos, shaders), keep UI strictly monochrome and flat so the content supplies all the color — matches ns-ui core's Geist restraint.
- Lesson: Make attribution/metadata structural: bake a credit row (creator, source link) into card components rather than tacking it on — it elevates perceived curation quality.
- Lesson: Motion-as-content grids need uniform cell timing: looping marks at thumbnail scale only read well when every cell shares size, loop discipline, and muted autoplay — a constraint worth encoding into any media-grid component.

### https://fable-25.netlify.app/
gallery — Index gallery of 105 experimental micro-sites designed and built autonomously by Claude (Fable 5), organized in five thematic waves, each card linking to a WebGL/canvas/SVG interactive experience labeled with its rendering technique.

- **AURUM (/ferrofluid/)** — Raymarched liquid-metal blob where the cursor acts as a gravity well deforming the surface — background as a physical object you push around, not a looping video. `[Fragment-shader raymarching of an SDF metaball field with cursor position fed as a uniform; per site's own tag: 'raymarching'. (Tag seen on index; effect itself not opened.)]`
- **THE HADAL TRUST (/abyssal/)** — Scroll position mapped to literal depth: you descend 10,924 m down an ocean trench past bioluminescent creatures, so the scrollbar becomes a depth gauge and narrative device. `[Scroll-driven camera translation through layered WebGL scenes with a live depth readout; site tag: 'depth-scroll siphonophore'.]`
- **CORNICHE (/corniche/)** — A motoring essay laid out along 38 km of cliff road where 'the scrollbar is an odometer' — typography set on a spline path, scroll progress re-expressed in real-world units. `[Text on an SVG/canvas spline path advanced by scroll, with a units-converted progress counter; site tag: 'spline typography'.]`
- **RIME (/rime/)** — Window frost that grows via diffusion-limited aggregation and melts back where 'your warm breath' (cursor/mic input) touches it — generative texture with a reversible, embodied interaction. `[DLA crystal growth simulation on canvas/GPU with local melt radius around pointer; site tag: 'DLA frost garden'.]`
- **Index page card grid itself** — Every card pairs a poetic one-line premise with a terse engineering tag ('verlet rope', 'caustic projection'), Fraunces serif display at 114px/-2.28px tracking over Space Grotesk body on #0b0b0e, and hovers animated over 0.8s with cubic-bezier(0.22,1,0.36,1). `[Plain CSS: dark surface cards (#141419, 1px #26262e border, 14px radius), long ease-out-expo transitions on transform/box-shadow, screenshot thumbnails.]`
- Candidates: `cursor-gravity-metal` (loud/large); `scroll-odometer` (core/medium); `split-flap-text` (loud/medium)
- Lesson: Pair a high-contrast display serif (Fraunces, tight -2% tracking at 100px+) with a geometric grotesk body on near-black — editorial character without leaving a dark-mode system; ns-ui core could allow a serif display slot for hero moments.
- Lesson: Slow, physical hover/reveal timing: transform and shadow on 0.6-0.8s cubic-bezier(0.22,1,0.36,1) (ease-out-expo family) reads as weight and craft, versus the default 150-300ms snap; reserve fast timing for state changes, slow for spatial moves.
- Lesson: Label components with a terse lowercase 'technique tag' ('verlet rope', 'caustic projection', 'point cloud') next to the human-facing description — metadata as a design element that signals craft; ideal pattern for a component registry's card metadata.

### https://www.figma.com/design/1RjQY50dy7t9SucZtAIb1p/Super-Visuals--Backgrounds-Library.?node-id=27733-15 *(inaccessible — secondhand)*
gallery — A view-only Figma file titled "Super Visuals: Backgrounds Library." containing a sequentially numbered set of static AI-generated background images (frames named AI_Bg_089, AI_Bg_090, implying 90+ items); the file shell loaded but the canvas image fills never rendered in automated browsers, so the actual visuals were not seen.

- Lesson: Verified structure only, not visuals: the library is a pack of static raster backgrounds (AI_Bg_### frames). For ns-ui this reinforces the existing direction — procedural/shader backgrounds (like particle-hero) are resolution-independent and themeable, which static image packs like this cannot be; no specific craft observations could be extracted because the canvas content never rendered.

### https://land-book.com/
gallery — Land-book is a curated, daily-updated website design inspiration gallery with faceted browsing across full sites, page sections, mobile shots, motion clips, headlines, and OG images.

- **Faceted inspiration filters (Industry / Style / Type / Typography / Color / Platform)** — Treats visual attributes — the typeface used and the dominant color — as first-class query facets, not just topic tags, so designers can browse by aesthetic rather than category. `[Standard filter UI over tagged screenshot metadata; the craft is in the curation/tagging taxonomy, not a rendering trick]`
- **Content-type segmentation (Websites / Sections / Motion / Headlines / OG Images)** — Slices the same corpus at multiple zoom levels — whole page, single section, animation clip, single headline — which is a smarter information architecture for inspiration than one monolithic grid. `[Separate cropped/clipped asset pipelines per content type; Motion entries are short video captures rather than static screenshots]`
- **Screenshot-card gallery grid** — The core browsing surface: a dense grid of tall page screenshots that reads cleanly at volume; the site's own chrome stays deliberately neutral so the featured work carries all the color. `[CSS grid of fixed-ratio image cards with signed CDN screenshot URLs; no exotic rendering]`
- Candidates: `screenshot-peek-card` (core/medium); `facet-filter-bar` (core/small)
- Lesson: Expose visual attributes (typeface, dominant color) as browsable metadata, not just decoration — a component gallery becomes far more useful when items are queryable by aesthetic.
- Lesson: When the content is other people's designs (screenshots, previews), keep the host chrome strictly neutral — near-black surfaces, mono labels, no accent color competing with the thumbnails.
- Lesson: Offer the same corpus at multiple zoom levels (full page, section, single headline, motion clip) — a registry preview site benefits from per-section and motion-only views, not just full-demo pages.

### https://www.opendoodles.com/
gallery — Open Doodles is Pablo Stanley's CC0 gallery of ~30 hand-drawn sketchy character illustrations (SVG/PNG/GIF) with a companion pose/color generator app, built on Webflow.

- **Boiling-line animated doodles** — Several doodles (coffee, sprinting, levitate, doggie) ship as GIFs where the hand-drawn linework wiggles frame to frame at low fps, making static sketches feel alive without any smooth tweening `[2-3 redrawn frames swapped as GIF, the classic 'boiling line' cel-animation trick; reproducible on the web with steps() CSS animation or SVG feTurbulence displacement]`
- **Misregistered flat-color fills** — Pink/patterned color blocks sit deliberately offset from the black outlines (visible in the hero swing girl), giving a screen-print/risograph hand-made energy to otherwise flat vector art `[Separate SVG fill layer translated a few px from the stroke layer, drawn behind it]`
- **Organic blob backdrop composition** — Hero places the character over soft pastel blobs (yellow quarter-round, blush circle) that bleed off the canvas edge, softening a stark white page and anchoring the illustration without a boxed container `[Absolutely positioned SVG/CSS border-radius blobs behind the subject, overflowing the section]`
- **Doodle generator (generator.opendoodles.com)** — Companion SPA that lets you cycle poses and recolor ink/fill/background then export SVG/PNG, turning a static asset set into a parametric system `[React app recoloring SVG layers via fill/stroke variable swaps (JS-rendered, could not inspect internals directly)]`
- **High-contrast serif display over sketch art** — Fat didone-style serif headline ('A Free Set of Open-Source Illustrations!') against loose brush linework: rigid type vs wobbly drawing is the whole visual tension of the brand `[Plain webfont typography, contrast achieved purely through pairing choice]`
- Candidates: `sketch-wiggle` (loud/small); `misprint-hover` (loud/small); `blob-backdrop` (loud/medium)
- Lesson: Stepped low-fps motion (steps() timing, 2-3 frames) reads as intentional and alive; not everything needs smooth 60fps tweens, and the jitter itself can be the aesthetic.
- Lesson: Deliberate misregistration, offsetting a fill layer a few px from its outline, is a cheap two-layer trick that adds craft and tactility to flat UI shapes.
- Lesson: Contrast of systems beats contrast of color: a rigid high-contrast display face against loose organic shapes creates identity; on a stark base, a couple of soft off-canvas blobs are enough to anchor a hero.

### https://svgl.app/
gallery — SVGL is an open-source, categorized library of 665+ brand SVG logos with theme-aware variants, instant copy-to-clipboard, and a public API.

- **Theme-aware dual-variant logo cards** — Every logo ships as a light/dark pair and the whole 600+ item grid swaps variants instantly with the theme toggle, so brand marks never sit on a wrong-contrast background. Elevates a plain grid into something that feels 'native' in both modes. `[Dual SVG assets per entry rendered conditionally by theme class / prefers-color-scheme; no JS re-render trickery needed, just CSS-gated <img>/<svg> pairs]`
- **Hover-reveal copy action rail on cards** — Cards are pure content at rest (just the mark + name); action buttons (copy SVG, copy JSX, open site) only surface on hover, keeping a 600-card grid visually silent. Copy fires a toast confirmation instantly, no page nav ever. `[Opacity/transform transition on a hover-gated overlay, Clipboard API write of raw SVG source, toast via a sonner-style stacked notification system]`
- **Cmd+K search affordance** — Search is advertised with a kbd '⌘K' chip in the input itself; the whole library is filterable in-memory so results are effectively instant, which is what makes a 665-item gallery feel small. `[Keyboard-shortcut-bound input/command palette with client-side fuzzy filtering; kbd element styled as a physical keycap]`
- **Category sidebar with live counts** — 40+ categories each show their logo count (AI 67, Software 283...), turning navigation into a data readout. Counts set expectation before a click, a small honesty detail most galleries skip. `[Static counts computed at build time from the JSON registry, rendered as muted-mono numerals beside each link]`
- Candidates: `copy-card` (core/medium); `kbd-search` (core/small); `theme-swap-frame` (core/small)
- Lesson: Actions belong behind hover in dense grids: cards at rest show only content, controls fade/slide in on intent, which is how a 600+ item page stays visually quiet — encode a rest/hover two-state contract into ns-ui cards.
- Lesson: Every copy/clipboard interaction needs a closed feedback loop within ~1s: icon morph on the button itself plus a toast; the button-local morph matters more than the toast because the eye is already there.
- Lesson: Ship theme-awareness at the asset level, not just the token level: components that display imagery/logos should accept light+dark sources and swap them, otherwise dark mode breaks on embedded content even when tokens are perfect.
- Lesson: Utility chrome stays monochrome (grays + type weight for hierarchy, counts in muted mono) so the content — colored logos — is the only saturated thing on screen; matches Geist restraint exactly.

### https://60fps.design/
gallery — Curated gallery of ~2,000 screen-recorded UI animation "shots" from best-in-class iOS/web apps, organized by a 108-tag motion taxonomy plus glossary, storyboards, and code snippets/MCP.

- **Shots grid (1,985 hover-play video tiles)** — A huge wall of app-animation recordings that stays fluid at scale; each tile is a muted looping capture, filterable across 108 interaction tags (drag, morph, liquid glass, gyroscope, particles). `[Lazy-loaded muted looping <video> elements with hover/intersection-triggered playback, virtualized/paginated grid; filtering via tag taxonomy. Secondhand for the videos themselves — content is recordings of other apps, not live code.]`
- **Motion taxonomy / filter system** — 108+ precise tags splitting motion into gestures (flick, long press), effects (shimmer, morph, spring), states (empty, success, toast), and advanced mechanics (shared elements, parallax, gyroscope) — a real pattern language, not vague categories. `[Information architecture, not a visual effect: tag-based filtering over a shot database.]`
- **Storyboards section (50 entries)** — Frame-by-frame breakdowns of app animations — turns a 2-second interaction into a readable sequence, rare educational format for motion design. `[Extracted video frames laid out as sequential stills; likely static image strips per shot.]`
- **Snippets & MCP** — The gallery ships code snippets and an MCP server so agents/IDEs can query the animation reference directly — inspiration corpus as tooling, not just eye candy. `[MCP server + code snippet library exposing the shot/tag database.]`
- **Named micro-interaction shots (e.g. Duolingo Score Increased Mascot, Apple Music, ChatGPT details)** — Curation granularity: individual delight moments are named and cataloged per app, showing spring physics, squash-and-stretch, and shared-element transitions dominate best-in-class mobile UI. `[Screen recordings; underlying apps likely use native spring animation APIs (SwiftUI/UIKit springs). Secondhand — not inspectable code.]`
- Candidates: `hover-play-media-card` (core/medium); `filter-pill-bar` (core/small); `spring-toast` (core/medium)
- Lesson: Name motion precisely: 60fps splits every animation into gesture + effect + element + state (e.g. flick / morph / card / success). Adopting this vocabulary in ns-ui prop APIs and docs (trigger, effect, state) makes components composable and searchable.
- Lesson: Muted autoplay loop is the best documentation medium for motion components — a hover-play video/preview per registry item communicates more than any prop table; worth building into the ns-ui preview site.
- Lesson: The 60fps bar itself: best-in-class shots read smooth because they animate only transform/opacity with spring physics and stagger, never layout properties — encode spring presets (gentle/snappy/bouncy) as shared tokens rather than per-component durations.

### https://www.cta.gallery/
gallery — A curated screenshot gallery of call-to-action designs (buttons, modals, newsletter forms, pricing sections) submitted by the community and filterable by CTA pattern type.

- **Pattern-taxonomy filter nav** — The gallery is organized by CTA pattern (Button, Call-to-Buy, Download, Form, Modal/Pop-up, Navigation, Newsletter, Pricing/Subscription) rather than by industry or style, which makes browsing purposeful — you shop by the job the UI element does. `[Static category-filtered grid with Load More pagination; plain HTML/CSS grid, no notable runtime effects observed]`
- Lesson: Organize a component registry by the job the component does (newsletter capture, modal, pricing CTA) rather than by visual style — cta.gallery's pattern taxonomy makes discovery fast and is directly applicable to ns-ui's registry navigation.
- Lesson: The site is content-first and visually restrained; the screenshots carry all the color while the chrome stays neutral — a good argument for keeping ns-ui's preview shell strictly Geist-neutral so components pop.

### https://dribbble.com/
gallery — Dribbble is a design-portfolio gallery and freelance marketplace whose homepage centers on a masonry grid of hover-animated shot cards under a cycling-headline hero.

- **Cycling discipline headline** — Hero H1 rotates through 'web design / mobile design / motion design / product design / brand design / UX-UI design' in place, conveying breadth in one line without layout shift; the swapped word is the only animated element on an otherwise static hero. `[JS-driven word swap with CSS transform/opacity transitions inside a fixed-height inline-block span to prevent reflow]`
- **Hover-to-play shot cards** — Grid cards holding animation shots swap the static thumbnail for an autoplaying video preview on hover, plus a bottom gradient scrim fading in title, author avatar, and like/save actions — grid stays perfectly calm until pointer intent. `[Lazy-mounted muted <video> toggled on mouseenter, layered over the poster image; overlay via opacity + translateY transition on a linear-gradient scrim]`
- **Masonry shot grid** — Uniform-aspect cards with tight consistent gutters and metrics (likes/views) rendered outside the image area, so thousands of wildly different artworks read as one orderly surface — the frame is neutral so content carries all color. `[CSS grid with fixed 4:3 media aspect-ratio boxes, infinite scroll via intersection observer]`
- **Scrollable filter pill bar** — Category pills (Animation, Branding, Typography...) in a single horizontally scrolling row with edge fade-out masks and an active state, doubling as both navigation and taxonomy without a dropdown. `[overflow-x scroll container with scrollbar hidden, CSS mask-image linear-gradient edge fades, active pill styled via aria-current]`
- **Split dual-audience hero** — One viewport serves two funnels (Hire Talent vs Get Hired) as mirrored stacked sections with parallel copy structure and one CTA each — clean information architecture rather than visual fireworks. `[Plain flex/grid layout; the craft is copy symmetry and spacing, not code]`
- Candidates: `media-hover-card` (core/medium); `filter-pill-rail` (core/small)
- Lesson: Keep browsing grids calm by hiding all metadata and actions until hover intent; motion previews should be opt-in per card, never autoplaying grid-wide.
- Lesson: When content is colorful and unpredictable (user artwork, screenshots), make the container maximally neutral: fixed aspect ratio, consistent gutters, metrics outside the image frame.
- Lesson: Animate a single word inside a headline (fixed-height inline span, transform+opacity swap) to express range without layout reflow or competing with the rest of the hero.

### https://ogfolio.com/
gallery — OGFolio is a curated gallery of ~900 Open Graph (social share) images from real products, plus an OG image analyzer tool, run as a companion to Toolfolio.

- **OG image card grid** — A large (896-item) image-first grid where each card pairs the full 1200x630 OG preview with a small favicon thumbnail and tool name, making the artwork itself the entire interface, monochrome chrome so the colorful OG images carry all visual weight. `[Plain CSS grid of aspect-ratio-locked image cards with load-more pagination; no heavy JS effects observed in the fetched markup]`
- **OG Image Analyzer** — A URL-input micro-tool that fetches a page's OG tags and scores the image against platform optimization standards, a utility hook that turns a passive gallery into a reason to return. `[Server-side meta-tag fetch and validation rendered as a report; standard form + fetch, not a visual effect]`
- Candidates: `og-preview-card` (core/small)
- Lesson: When the content is imagery, remove all chrome color: OGFolio keeps its own UI strictly monochrome so the grid of colorful OG images provides 100% of the visual interest, a good rule for ns-ui's preview/gallery pages.
- Lesson: A fixed 1200x630 (1.91:1) aspect ratio applied uniformly across a grid creates instant rhythm and scannability; lock aspect-ratio on preview cards rather than letting images dictate height.
- Lesson: Pairing a large preview with a tiny identity mark (favicon + name) is enough metadata for a card; resist adding descriptions, tags, or buttons when the image already communicates.

### https://www.inspo.page/
gallery — Details.so is a curated web-design inspiration library (3,000+ video-captured micro-details from production sites, tagged by element/section/interaction/industry) plus a "Vault" of paste-ready animation code snippets.

- **Cursor Trail Image (Vault snippet)** — A section-level effect where images trail behind the cursor as it moves — the signature 'studio portfolio' pointer interaction, packaged as copyable code. Only the name and thumbnail were visible (Pro-gated); the effect itself was not directly viewed. `[Typically lerp-smoothed pointer tracking spawning absolutely-positioned <img> elements (or canvas draws) that scale/fade out on a stagger]`
- **Liquid Popover (Vault snippet)** — A popover with a liquid/gooey morph treatment, filed under 'UI Details' — micro-craft applied to a normally boring primitive. Pro-gated; identified from title/thumbnail only. `[Likely SVG gooey filter (feGaussianBlur + feColorMatrix contrast trick) or clip-path/border-radius spring morph on open]`
- **Shutter / Clip Reveal page transitions (family of Vault snippets)** — Three named variants (Clip Reveal, Shutter 2, Horizontal Shutter) — a taxonomy of wipe-style page transitions treated as interchangeable, parameterized recipes rather than one-offs. `[Scroll/route-driven clip-path inset()/polygon() animation over stacked panels, staggered slat elements for the shutter variants]`
- **Paywall decoy cards ('Nice try — These are no real cards')** — Past the free preview, the infinite grid continues with blurred fake cards labeled 'Nice try, these are no real cards' — the paywall itself is a designed, self-aware component instead of a hard cutoff, preserving scroll rhythm while converting. `[CSS blur/skeleton placeholder cards repeated in the same grid, overlaid upgrade CTA]`
- **Video-first capture format for the whole library** — Every gallery item is a short video capture, not a screenshot — 'captured as video wherever motion matters'. For a motion-focused library this is the whole product insight: static thumbnails cannot sell an interaction. `[Autoplaying muted looped <video> thumbnails, lazy-loaded in an infinite masonry grid]`
- Candidates: `cursor-trail-media` (loud/medium); `liquid-popover` (core/medium); `shutter-transition` (loud/small)
- Lesson: Curate and demo at the detail level, not the page level: ns-ui preview pages should show each component isolated as a looping motion capture (video or live loop), because static thumbnails cannot communicate an interaction.
- Lesson: Organize by interaction taxonomy, not just element type — Details.so's axes (element / section / transition / scroll / pointer) map cleanly onto registry tags and make a small library feel navigable and complete.
- Lesson: Ship variants as a named family (Shutter, Shutter 2, Horizontal Shutter): one core mechanism with parameterized directions/staggers reads as depth and craft, and is cheap to build once the first variant exists.
- Lesson: Make even utilitarian states designed moments: their paywall decoy cards keep grid rhythm and add wit — empty/locked/error states in ns-ui demos deserve the same intentionality.

### https://variant.com/community *(inaccessible — secondhand)*
gallery — Login-walled community gallery of Variant, an AI design tool whose core UX is an infinite-scroll feed of generated UI design variations; details below are secondhand from press coverage plus a direct screenshot of the auth wall.

- **Infinite-scroll generation feed** — The whole product replaces the prompt-refine loop with scrolling: each scroll reveals another fully-formed visual interpretation of the same brief, feed never repeats. Navigation IS the ideation mechanic. (Secondhand.) `[Virtualized infinite feed with scroll-driven lazy generation, likely IntersectionObserver-triggered fetches rendering live HTML/React previews in sandboxed iframes]`
- **Dot-matrix techno ticket (community piece)** — Berlin techno event ticket rendered as a dot-matrix monochrome grid: raw printer-aesthetic typography over pixelated noise textures. (Secondhand.) `[Halftone/dot-grid rendering, likely canvas sampling or CSS radial-gradient dot pattern plus a bitmap/monospace face]`
- **Sci-fi terminal diagnostic UI (community piece)** — Green-on-black diagnostic readouts (STATUS: AUTHORIZED ACCESS) with scan-line overlays, full CRT terminal treatment. (Secondhand.) `[Repeating-linear-gradient scan-line overlay + mix-blend-mode, monospace type, possibly typewriter reveal animation]`
- **Style Dropper** — Eyedropper-for-aesthetics: absorbs one design's palette, typographic rhythm, and spatial density and transfers it onto another layout. A genuinely novel interaction primitive. (Secondhand.) `[AI-driven style-token extraction and re-generation; UI likely a drag-target picker with animated style-transfer transition]`
- **Auth wall restraint (seen directly)** — Sign-in screen on near-black is extremely dim: gray-on-#0d0d0d heading, barely-elevated input/button surfaces, hairline dividers fading at both ends. Confident low-contrast hierarchy that still reads. `[Pure CSS: layered near-black surfaces (#111-#1a1a1a), 1px borders slightly lighter than fill, gradient-masked divider lines]`
- Candidates: `dot-matrix-text` (loud/medium); `scanline-terminal` (loud/medium); `infinite-reveal-feed` (core/medium)
- Lesson: Low-contrast dark UI can go further than expected: Variant's auth screen keeps headings at roughly gray-500 on near-black and elevates surfaces by only one step (#0d → #17), proving hierarchy can come from surface steps and hairline borders rather than contrast jumps — directly applicable to ns-ui core.
- Lesson: Gradient-masked hairline dividers (1px line fading to transparent at both ends, as in Variant's 'or' separator) read far more crafted than solid rules; cheap to encode as a core utility.
- Lesson: Make scroll the interaction, not just the transport: Variant's whole product identity is 'just scroll'. Components that reveal, generate, or morph as a function of scroll position feel like product mechanics, not decoration — a framing worth carrying into ns-ui's scroll-story work.

### https://mobbin.com/discover/apps/ios/latest
gallery — Mobbin is a UI-research library of 620k+ real app screenshots and flows; the /discover iOS feed itself is signup-walled, so analysis is based on the public marketing landing page (Framer-built) that showcases the product.

- **Pattern-taxonomy tab browser (Screens / UI Elements / Flows / Text)** — A tabbed showcase where each tab swaps in a horizontal rail of labeled phone-screenshot cards (Checkout, Bottom Sheet, Toast, Paywall...). The label-above-thumbnail rhythm at consistent device aspect ratio makes a huge dataset feel instantly scannable. `[Framer component states + CSS scroll-snap horizontal rails; tab swap is a layout crossfade, images lazy-loaded at fixed 768x1662 device aspect]`
- **App-logo marquee rows (Coinbase, Spotify, Notion...)** — Three stacked infinite marquee rows of app icons with names, alternating scroll directions, closing the page with implied breadth rather than a claims list. `[CSS keyframe translateX marquee on duplicated flex rows, opposing animation-direction per row]`
- **Library stat block (1,428 apps / 621,500+ screens / 323,900 flows)** — Raw numbers set at display-heading scale carry the entire value proposition; no illustration needed. Comma-formatted figures at h1 size read as design, not data. `[Pure typography; likely viewport-triggered count-up via Framer scroll variants]`
- **Flow preview duality (Video vs Prototype)** — Same user-flow content offered two ways: autoplaying video with real micro-interactions, or a click-through prototype with hotspots at your own pace. A smart pattern for previewing motion-heavy content. `[Muted looping video elements plus hotspot overlay on static frames]`
- Candidates: `screen-rail` (core/medium); `stat-counter` (core/small); `hover-flow-card` (core/medium)
- Lesson: Fixed device aspect ratio across all thumbnails (Mobbin locks to ~1125x2436) is what makes a dense screenshot grid feel calm; enforce a single aspect token in any gallery component.
- Lesson: Tiny category label above the card, not overlaid on it, keeps imagery clean and creates a scannable metadata rhythm; overlays are for hover states only.
- Lesson: Large comma-formatted numerals can serve as the visual hero: pair display-weight figures with muted small-caps/mono descriptors instead of adding illustration.

### https://motionsites.ai/?prompt=urban-jungle-hero
gallery — MotionSites is a paywalled library of AI-prompt landing-page templates with video previews; the linked "Urban Jungle" item is a Premium landing page whose hero is an AI-generated looping video of a flower-overgrown subway car with eclectic mixed-glyph display typography (prompt text itself is behind the paywall; analysis based on the 6.8s preview video pulled from the site's R2 CDN).

- **Urban Jungle video hero** — Full-bleed AI-generated looping video (yellow tram interior consumed by ferns and daisies) as the hero background, with a huge white headline sitting directly on the footage. The surreal photoreal video does the atmosphere work a shader normally would, and the busy imagery is tamed by keeping every UI element monochrome white/black. `[Autoplay/muted/looped h264 mp4 background layer, oversized text overlaid with no scrim, UI reduced to white pills]`
- **Mixed-glyph display headline (UNLEASH THE FULL POWER)** — Individual letters are swapped for ornate blackletter/swash alternates (the U, T, F, P) inside an otherwise clean geometric sans headline. The clash of calligraphic and grotesk glyphs in one word is the template's signature and reads as bespoke lettering. `[Per-letter spans styled with a second display font (or a font's stylistic alternates/ss0x features), likely static; trivially animatable by cycling which letters use the alternate face]`
- **Scroll card-over-video reveal (About panel)** — On scroll, an olive-green panel with large rounded corners slides up over the still-playing hero video, carrying editorial serif copy; the video stays sticky behind and peeks around the panel's margins, creating cheap but convincing depth. Panel color is sampled from the foliage so overlay and media feel like one scene. `[Sticky/fixed video layer + scroll-driven translateY on a rounded overlay section (Framer-style scroll transform), inset margins exposing the media at the edges]`
- **Editorial serif with italic emphasis** — The About copy sets key words (urban, nature, bloom) in italic within a large-set roman serif, giving typographic rhythm to a plain paragraph — emphasis via style contrast rather than color or weight. `[Single serif family, italic style on inline spans, large size with tight leading]`
- **Hover-play video card grid (site-wide)** — The library itself previews every template as a silently autoplaying mp4 inside its card, making the whole gallery feel alive without interaction. `[Lazy-loaded muted mp4s in cards, IntersectionObserver-gated playback]`
- Candidates: `glyph-splice-heading` (loud/medium); `media-veil-section` (loud/medium); `float-pill-nav` (core/small)
- Lesson: Splicing a second typographic voice into single letters (blackletter alternates inside a grotesk headline) creates a signature identity with zero extra assets — encode as a per-letter span pattern, not a custom font.
- Lesson: A rounded-corner overlay panel sliding over sticky media, with the media peeking at the edges, is the cheapest convincing scroll-depth trick: one translateY transform plus 16px+ radius, no parallax math.
- Lesson: Over busy/rich backgrounds, restrict all UI chrome to pure monochrome (white pills, black buttons) and tint content panels with a color sampled from the media itself — contrast handles legibility, sampling handles cohesion.

### https://detail.design/
gallery — Curated gallery ("Detail · Where craft lives", by Rene Wang) of small interface details and micro-interaction patterns, tagged by category (Design, Copywriting, Accessibility, Motion, Optimization), each shown as a screenshot or short autoplay video card.

- **Unified Login Field** — Collapses two auth flows (magic link + password) into one field with zero added UI chrome; the demo video shows the interaction, not a static mock `[Animated layout/state transition on a single input: the submit affordance morphs between 'send magic link' and 'enter password' modes, likely Motion/Framer layout animation on shared elements]`
- **Screen Shaking Feedback** — Featured as the Motion-category exemplar of feedback that communicates 'rejected' without any text, borrowed from OS-level password fields `[CSS keyframe translateX shake (or spring-based x oscillation) triggered on invalid submit]`
- **Avoid Browser Default Back Behavior** — A one-line CSS fix presented as a craft detail; the video demonstrates the failure mode and the fix side by side `[CSS overscroll-behavior-x on horizontal scroll containers to stop trackpad swipe triggering browser back-navigation]`
- **Platform-Agnostic Shortcut Labels** — Framed as 'millisecond-level improvements' for power users, a good example of the site's thesis that tiny details compound `[Runtime platform detection (navigator/UA) swapping kbd glyphs (Cmd vs Ctrl) in shortcut hints]`
- **Skill distribution of the gallery itself** — Novel distribution: the inspiration gallery doubles as a machine-readable craft checklist agents can install, not just a site humans browse `[`npx skills add detaildotdesign/skill` in the hero, gallery content packaged as an installable agent skill on GitHub]`
- Candidates: `unified-auth-input` (core/medium); `shake-input` (core/small); `kbd-hint` (core/small)
- Lesson: Micro-details compound: the site's whole thesis is that sub-second, single-property refinements (overscroll-behavior, label htmlFor focus, platform-correct kbd glyphs) are what separate crafted UI from templated UI; ns-ui core components should each ship 2-3 of these invisible details by default
- Lesson: Demo motion patterns as short looping videos per card rather than static screenshots; for a component registry, autoplay looped previews on the grid sell interaction components far better than stills
- Lesson: Feedback can be purely kinetic: a rejection shake or state morph communicates outcome without copy, matching the core collection's restraint (motion carries meaning, color stays neutral)

### https://motion.dev/docs/react-scroll-animations
other — Motion (framer-motion successor) docs page teaching scroll-triggered vs scroll-linked animation in React via useScroll, useTransform, useSpring, and whileInView, with live embedded demos.

- **Sticky horizontal scroll section** — A 300vh tall container with a position:sticky inner pane whose x transform is driven by scrollYProgress — vertical scroll becomes a horizontal gallery, and felt speed is tuned purely by container height rather than animation duration. `[scroll-driven: useScroll + useTransform mapping scrollYProgress to translateX inside a sticky wrapper]`
- **Scroll-linked clipPath image reveal** — Image progressively unveils via animated clipPath tied to an offset window of ['start end', 'center center'], so the reveal completes exactly as the element reaches viewport center — deterministic, scrubbing both directions. `[scroll-driven: useScroll with element target + offset, useTransform to clip-path inset()]`
- **Spring-smoothed scroll progress bar** — scrollYProgress piped through useSpring (stiffness 100, damping 30, restDelta 0.001) into scaleX with originX:0 — the bar lags and settles physically instead of tracking raw scroll, which reads far more premium than a 1:1 bar. `[useScroll -> useSpring -> scaleX transform (GPU-composited)]`
- **Scroll-velocity ticker** — Marquee text whose direction and speed respond to scroll velocity, inverting when the user scrolls up — scroll input becomes momentum for a decorative element rather than just position. `[useScroll velocity + useTransform feeding a continuously animating Ticker x offset]`
- **Native ScrollTimeline hardware acceleration** — Motion runs scroll-linked animations off the main thread on the browser's native ScrollTimeline where supported — scrub animations stay smooth even when React re-renders janks the main thread. `[CSS ScrollTimeline API with JS fallback; IntersectionObserver pooling for scroll-triggered variants]`
- Candidates: `sticky-horizontal-gallery` (core/medium); `clip-reveal-media` (core/small); `velocity-ticker` (loud/medium)
- Lesson: Never pipe raw scroll progress straight into styles: route it through useSpring (stiffness ~100, damping ~30, restDelta 0.001) so scroll-linked elements settle physically instead of tracking 1:1.
- Lesson: Control scroll-choreography pacing with geometry, not duration: offset windows like ['start end','center center'] and container height (300vh) define when and how fast things happen, keeping everything scrubbable in both directions.
- Lesson: Build parallax depth from transform-range ratios (background mapped over [0,0.5], foreground over [0,2] of the same scroll input) and stick to transform/clip-path properties so animations stay compositor-friendly and eligible for native ScrollTimeline.

### https://designengineer.tools/
other — A curated link directory of ~25 categories of tools for design engineers (inspiration galleries, AI code tools, component libraries, easing/color utilities, 3D/shader tools), maintained by James Warner — a resource aggregator, not a showcase.

- Lesson: The page itself is a plain categorized link list with no notable visual craft — its value is the taxonomy, not the design; nothing observed worth encoding into components.
- Lesson: Useful as a sourcing map, not inspiration: its Components, Web Utility (easing/color/SVG), and Visual/Motion/3D categories (ShaderToy, Motion Primitives, shadcn) point to primary sources that ARE worth mining for ns-ui.

### https://styles.refero.design/?q=https://cluely.com/
other — Refero Styles, an AI-readable design-system catalog; the queried entry is a full token/component breakdown of cluely.com's landing page (atmospheric blue-gradient SaaS with EB Garamond + Geist pairing).

- **Serif-meets-tech hero headline** — 80px EB Garamond (weight 500, line-height 1.02, -0.012em tracking) reserved exclusively for the hero h1, set against Geist for every functional element — a single deliberate typographic collision that becomes the whole brand identity. `[Pure CSS typography: constrained font pairing with one serif exception, tight leading, negative tracking scaled to size]`
- **Beveled CTA hover shadow stack** — Primary button hover depth built from three layered box-shadows: a 0.5px #0544a9 ring, a -1px inset of #022c70 (dark bottom edge), and a 0.5px inset of #81b6ff (light top edge) — a machined bevel with zero drop shadow and zero background change. `[Layered box-shadow stack (ring + dual inset highlights) transitioned on hover]`
- **Shadow-free elevation system** — Zero drop shadows across ~2500 instances of the #e4e4e7 hairline border; elevation is expressed entirely through surface tints (#ffffff → #f3f8ff → #edeef2) and 1px borders, giving a flat but clearly layered page. `[CSS surface-hierarchy tokens: tinted backgrounds + hairline borders instead of box-shadow elevation]`
- **Atmospheric gradient hero** — Full-bleed radial sky-to-mountain gradient (#73a8e8 → #1c38ea → indigo) with a mountain illustration overlay, transitioning into a crisp white workspace below — cinematic without any 3D or particles. `[Radial CSS gradient + layered illustration/image overlay, hard handoff to flat white section]`
- **Floating tilted product frames with glass-edge rings** — Product screenshots in 16px-radius frames, slightly perspective-tilted, edged with rgba(207,226,255,0.24) 1px ring + inset -0.5px white highlight instead of a drop shadow — the frame reads as a thin glass edge catching light. `[CSS 3D transform (rotate/perspective) + ring-and-inset box-shadow pair, no drop shadow]`
- Candidates: `bevel-button` (core/small); `hairline-surface-card` (core/small); `atmosphere-hero` (loud/medium)
- Lesson: Elevation without shadows: pair 1px hairline borders with a 3-step tinted surface hierarchy (white → barely-blue → cool gray); reserve inset highlights for interactive edges only.
- Lesson: Scale letter-spacing with size: roughly -0.04em at 48px easing to -0.005em at 14px gives headlines an engineered density without ever tracking body text wide.
- Lesson: Depth on interactive elements via layered inset box-shadows (light inset on top edge, dark inset on bottom, thin ring outside) reads as physical bevel and works with a single flat accent color — keep total saturated-color coverage near 2% of the page.

### https://blog.vibecoder.me/
other — Editorial content hub ("The Missing Manual for AI-Assisted Development") — a dark, Geist-based Next.js blog with learning tracks, tool comparisons, and a canvas dot-matrix hero.

- **Dot-matrix hero canvas** — Pure-black hero backed by a sparse grid of tiny twinkling blue dots — reads as a subtle 'signal field' rather than a particle wash, and keeps text contrast perfect. Pixel sampling showed only ~2% of the field lit at any moment, so it stays quiet. Canvas appears to unmount when scrolled away (perf-conscious). `[2D canvas (verified via getContext('2d')), absolutely positioned inset-0 behind hero, no WebGL libs present]`
- **Two-word gradient headline** — 96px Bricolage Grotesque 800 with -2.4px letter-spacing; line one pure white, line two ('vibe coders.') carries a cyan→blue→purple gradient. It is the ONLY saturated color on an otherwise fully monochrome oklch page, so the gradient acts as the focal point instead of decoration. `[background-clip:text gradient on a display font, colors constrained to one phrase]`
- **Track-card surface system** — Cards on pure black get depth with zero shadows: background oklab(0.205 0 0 / 0.5), 1px border of white at 6% alpha, 14px radius, 150ms cubic-bezier(0.4,0,0.2,1) hover transition. Clean Vercel-school elevation from alpha layering alone. `[oklab/oklch alpha color tokens + hairline translucent borders, CSS transitions]`
- **Spotlight entrance keyframe** — Build ships an Aceternity-style @keyframes spotlight (opacity 0→1, translate(-72%,-62%)→(-50%,-40%), scale 0.5→1) — a cinematic light-sweep entrance pattern for the hero rather than a generic fade-in. `[CSS keyframe animating transform+opacity on an oversized positioned glow element]`
- **Editorial metadata chips** — Every card carries a consistent meta row (article count, total minutes, difficulty pill: beginner/intermediate/pulse) in Geist Mono style — turns a content list into a scannable system and sets clear commitment expectations. `[Plain flexbox chip row with tokenized pill styles]`
- Candidates: `dot-grid-shimmer` (core/medium); `spectrum-text` (loud/small); `spotlight-entrance` (core/small)
- Lesson: Color budget of one: keep the entire surface monochrome (oklch neutral ramp on #000) and spend all saturation on a single headline phrase — the gradient becomes a focal point instead of decoration.
- Lesson: Shadowless depth on pure black: elevate cards with a half-alpha oklab surface (oklab(0.205 0 0 / 0.5)) plus a 1px white/6% border at 14px radius and a 150ms cubic-bezier(0.4,0,0.2,1) transition — no box-shadow needed.
- Lesson: Geist for body + a characterful display face (here Bricolage Grotesque 800 at -2.5% tracking, 96px) gives editorial personality without breaking the Geist system; the display font appears only at H1/H2 scale.

### https://trickle.so/blog/trickle-vibe-coding-prompt-library
other — A blog-post prompt library from Trickle listing 50 categorized text prompts for AI website generation (vibe coding), not a visual component showcase.

- Lesson: A five-axis taxonomy (visual style / page functionality / interaction / brand-mood / cross-media) is a useful way to tag and organize a component registry so users browse by intent, not just by widget type.
- Lesson: Prompt cards pairing a plain-language use-case sentence with the exact copyable monospace prompt text is a good docs pattern for ns-ui: each component page could ship a one-line 'when to use' plus a copy-ready install/usage block.

### https://vibeui.online/
other — Vibe UI is a copy-paste prompt library (92 layout prompts across auth, pricing, hero, nav, etc.) for generating UI with AI tools, not a rendered component showcase.

- Lesson: Taxonomy transfers even when visuals don't: its 15-category breakdown (hero, stats bar, CTA banner, testimonial wall, FAQ, empty state...) is a solid checklist for rounding out ns-ui's registry coverage over time.
- Lesson: Every prompt bakes in 'match the user's screenshot for colors/typography' rather than prescribing a palette — the same principle as ns-ui's token-driven approach: components should inherit the design system, not carry their own.

### https://www.cosmos.so/home
other — Marketing landing page for Cosmos, a visual inspiration/curation platform ("Your space for inspiration"), built as a near-monochrome editorial page where the curated imagery itself supplies all the color.

- **Self-typing search bar placeholder** — The nav search input types out rotating example queries ('Try celestial maps') character by character, with already-typed characters rendered darker/bolder than the untyped remainder, plus inline visual-search (camera) and multicolor color-search dot icons. Turns a dead placeholder into a product demo. `[JS interval typewriter swapping a styled span pair (typed = full-opacity, rest = muted) inside the placeholder layer; icon buttons absolutely positioned in the pill input]`
- **Ghosted image-wall hero fade** — Below the giant headline, a masonry wall of curated images emerges but is faded almost to white at the fold, so imagery ghosts into the page rather than starting with a hard edge (visible as a faint grid band in the hero screenshot). `[CSS mask-image / linear-gradient overlay fading the image grid into the page background, with lazy-loaded images and scroll-triggered opacity]`
- **Search-by-color demo section** — A hex chip (#bc361b) sits beside a grid of images all sharing that burnt-red hue, demoing color search as a visual artifact: the swatch IS the UI, no explanatory chrome. `[Static curated image sets per swatch; chip likely a rounded div with the hex as both fill and label, section swap on scroll]`
- **AI-content Show/Blur/Hide segmented control** — A three-state segmented toggle (Show / Blur / Hide) applied live to an image flagged 'likely generated by AI', animating between clear, frosted, and removed states. A genuinely novel moderation-UI pattern shown as interactive marketing. `[Segmented control driving CSS filter: blur() + opacity/scale transitions on the media element]`
- **Attribution overlay cards** — Full-bleed photo cards carry quiet credit lines ('Photograph from Unformen der Kunst — Karl Blossfeldt'), demoing provenance research as elegant typographic overlays instead of metadata tables. `[Absolutely positioned caption layer over the image with a subtle scrim gradient; likely fade/slide in on scroll or hover]`
- Candidates: `typewriter-search` (core/small); `ghost-grid-hero` (core/medium); `blur-reveal-toggle` (core/small)
- Lesson: Chrome stays achromatic (off-white bg, pure black controls, gray text) so the content imagery supplies all color — the same discipline as Geist's 'blue only for interaction', extended to 'hue only from content'.
- Lesson: Hierarchy by scale, not color: a tiny letterspaced caps label (COSMOS) over a ~90px tight-leading grotesque headline over pill buttons; three sizes do all the work with zero accent color.
- Lesson: Blend media into the page with gradient masks instead of hard section boundaries — a faded mask at a section edge makes dense image grids feel calm and lets dark/light bases absorb rich content.
- Lesson: Primary vs secondary CTAs distinguished purely by fill (solid black pill) vs hairline outline pill at identical size — no hue needed for button hierarchy.

### https://x.com/uihssn/status/2075335893192523951/photo/2
social-post — X post by Ahmed Hassan (@uihssn) captioned "Respect to Fable 5, but this is a different league" showcasing 4 AI-era landing-page concepts; photo 2 is "Verdant", an SEO SaaS hero with a painterly meadow scene, and photo 1 is "Phantom", a dark cybersecurity hero with an ASCII-dithered skull (X page itself is login-walled, but images were retrieved via Twitter's CDN and viewed directly).

- **Scene-embedded dashboard (Verdant)** — The product dashboard is not floating on the page, it is composited INTO the illustrated meadow: foreground flower hills overlap and partially occlude the UI card, so the screenshot reads as an object sitting in the landscape with real depth. `[Layered composition: full-bleed illustrated background, dashboard mock mid-layer, foreground hill/flower cutout with higher z-index (in web form: stacked absolutely-positioned layers or a masked PNG, easily parallaxed on scroll)]`
- **Inline icon-chip headline with serif italic accents (Verdant)** — Headline mixes a light geometric sans ("Turn … into endless") with serif-italic keywords ("Content", "Organic traffic") set inside soft tinted rounded chips (lavender, peach) each carrying a small icon. Emphasis comes from typeface contrast and chip fill, not size or weight. `[CSS inline-flex pill spans inside the h1 with border-radius, low-saturation background tints, icon SVGs, and a contrasting serif italic font]`
- **ASCII-dithered skull hero (Phantom, photo 1)** — A skull emerges from a near-black page rendered as a density map of ASCII glyphs (@, #, S, x, 0) — only the lit rim is visible, ~90 percent of the figure dissolves into darkness. Stray glyphs at ~3 percent opacity are scattered across the page as atmosphere. Sinister, restrained, unforgettable. `[ASCII dithering: sample image luminance per cell and map brightness to glyph density/character weight — canvas 2D or a WebGL shader; static version is just pre-rendered art]`
- **Serif numerals in dashboard metrics (Verdant)** — KPI values (42,642.1, 273,398 Monthly Visits) and card titles are set in an editorial serif inside an otherwise clean sans UI, making a routine analytics dashboard look like print typography. `[Font pairing only: serif display face scoped to metric values and headings, sans for labels and chrome]`
- **Dot-grid sky overlay (Verdant)** — A faint white dot grid is laid over the photographic sky, bridging the organic painterly background with the product-UI aesthetic so the two worlds do not clash. `[CSS repeating radial-gradient (or tiled SVG) dot pattern at low opacity over the hero image]`
- Candidates: `ascii-dither-image` (core/medium); `chip-headline` (loud/small); `depth-scene-hero` (loud/large)
- Lesson: Emphasis via typeface contrast, not size: swapping key headline words to a serif italic (optionally chip-contained) creates hierarchy while every word stays the same optical size — a cheap high-craft trick for any hero or text-morph component.
- Lesson: Serif numerals elevate data UI: scoping an editorial serif to metric values while keeping labels/chrome in the sans instantly de-templates dashboards and stat cards.
- Lesson: Darkness as material: the Phantom hero keeps ~90 percent of the figure below the visibility threshold and scatters glyph noise at ~3 percent opacity — atmosphere from restraint suits the core collection far better than fully-lit effects; let effects fade INTO the #0a0a0a base rather than sit on it.

### https://x.com/Av1dlive/status/2060035425574764708 *(inaccessible — secondhand)*
social-post — Login-walled X post by @Av1dlive (May 28, 2026, ~149K views) that links to his X Article "How to Design using AI (Builder's Guide)", about building a stripped-down personal Notion with AI; the article body itself is also paywalled/login-walled and could not be read.

- Lesson: Secondhand, from the article teaser only: the author's thesis is 'AI will replace designers but not TASTE' — he rebuilt only the parts of Notion he actually uses, stripped of the rest. Transferable to ns-ui: a personal registry earns identity by curating fewer, opinionated components rather than cloning a full library.

### https://x.com/RoundtableSpace/status/2055238007926509894 *(inaccessible — secondhand)*
social-post — Login-walled X post by @RoundtableSpace resharing a ~20-minute video tutorial by @viktoroddy on building interactive animated websites with AI (Google AI Studio / Gemini workflow); recovered via the Twitter syndication API and the video thumbnail, so all specifics are limited to the post text and one still frame, not the video itself.

- **PureFlow 'Clean Air Hero' demo page (visible in video thumbnail only)** — Full-screen hero with an oversized two-line headline ('Clean Air, Clear Mind. Anywhere.') set over a full-bleed cinematic 3D render of a jet-engine-like purifier with a single warm glowing turbine as the sole color focal point on an otherwise neutral gray/white composition; tiny letterspaced eyebrow label and pill-shaped nav keep the chrome minimal. `[AI-generated (Gemini in Google AI Studio) React landing page; hero appears to be a static/rendered product image with layered text, not verifiable beyond the still]`
- **Mask-revealing text effect (referenced in the visible chat transcript, not seen running)** — The prompt log in the thumbnail shows the workflow iterating on a 'mask revealing effect' for the About page's 'Our Journey' section plus pixel-precise layout nudges (move 50px, align timeline 20px from edge), showing prompt-driven motion-design iteration. `[Presumably CSS clip-path/mask or overflow-hidden translate reveal; secondhand, from transcript text only]`
- Candidates: `mask-reveal-text` (core/small); `spotlight-product-hero` (loud/medium)
- Lesson: One color focal point wins: a monochrome full-bleed scene with a single warm glow (the turbine) directs the eye harder than any gradient wash — maps directly to ns-ui's 'accent only for interaction' rule.
- Lesson: Oversized two-line headline + tiny uppercase letterspaced eyebrow label above it is a cheap, reliable hierarchy pattern for heroes over imagery.
- Lesson: Motion iteration works in pixel increments: the visible workflow tuned reveals by 20-50px offsets, a reminder to expose fine offset/stagger props on reveal components rather than hardcoding them.

### https://getdesign.md/airtable/design-md
template — getdesign.md is a catalog of DESIGN.md files (plain-language design-system briefs for AI coding agents); this page is the catalog entry for an unofficial Airtable analysis ("spreadsheet-database hybrid, colorful friendly structured-data aesthetic") installable via "npx getdesign@latest add airtable".

- **DESIGN.md distribution model** — Not a visual effect but the site's one genuinely novel idea: shipping a design system as a single markdown context file installed via npx, so AI agents generate on-brand UI. The actual Airtable DESIGN.md content and 'Preview' section are gated behind the install/kit flow, so the page itself shows only a one-line aesthetic summary and install command. `[Static catalog page + npm CLI that drops a DESIGN.md into the project root; no notable CSS/WebGL/scroll craft observed on the page itself]`
- Lesson: A design system can be compressed into one legible sentence (e.g. 'colorful, friendly, structured data aesthetic'); ns-ui's two collections would benefit from equally sharp one-line identity statements ('Geist-dark restraint' vs 'flashy showcase') stated in docs and component descriptions.
- Lesson: Ship a DESIGN.md at the ns-ui repo root encoding the Geist tokens, bans (no orange, no gradient washes in core), and motion rules — the same pattern this site sells — so any AI-assisted contribution to the registry stays on-system.
- Lesson: Distribution ergonomics matter: a single copy-paste npx command as the primary CTA (mirroring shadcn) is the right acquisition surface for a component registry; keep ns-ui's per-component install command front and center on every preview page.

### https://studio.morflax.com/toolset
tool — Morflax Studio's toolset page: a launcher grid for a suite of in-browser 3D design tools (abstract/shape generators, vector-to-3D, device/clothing/branding mockups, icon editor) built on WebGL with keyframe animation and video export.

- **Vector to 3D (Shift)** — Upload an SVG and it becomes an editable, animatable 3D object entirely in the browser — a genuinely magical input-to-output moment for a logo or icon. `[Three.js SVGLoader + ExtrudeGeometry in a WebGL canvas, with material/lighting controls layered on top]`
- **In-browser 3D scene editor with keyframe timeline** — Full move/rotate/scale gizmo modes (T/R/S), keyframe copy/paste, play/pause, and 30fps video export — a Blender-lite living in a web page. `[WebGL (Three.js) scene graph + custom timeline UI; video export likely via canvas frame capture (CCapture/MediaRecorder or server render)]`
- **3D device mockups with animation** — Drop a screenshot onto an iPhone/MacBook model, orbit it, and animate camera + device for marketing video output — screen texture mapped live onto glass-and-metal PBR models. `[WebGL PBR materials with the user's image as an emissive/albedo screen texture; orbit camera via pointer drag]`
- **Universal drag-and-drop upload with auto type detection** — One drop target anywhere on the page routes SVG → vector-to-3D, JPG/PNG/WebP → image mockup, GLB → 3D object — the file type picks the tool, not the user. `[Window-level dragover/drop listeners + MIME/extension sniffing routing to different editor flows]`
- **Keyboard shortcuts overlay (? to open)** — A clean, grouped cheat-sheet modal (Camera / Transform / Animation) with styled kbd chips — pro-tool craft that signals a serious editor. `[Plain CSS modal with <kbd>-styled chips, grouped two-column layout, global '?' key listener]`
- Candidates: `svg-extrude-object` (loud/large); `kbd-shortcuts-overlay` (core/small); `smart-dropzone` (core/medium)
- Lesson: Route by artifact, not by menu: letting the dropped file's type choose the tool removes a whole decision layer — encode this 'input decides the flow' pattern into upload/import components.
- Lesson: Uniform-aspect preview imagery does the selling: the tool launcher is just a plain card grid, but consistent rendered 3D thumbnails at one aspect ratio make it feel premium — invest in the preview asset, not the card chrome.
- Lesson: Pro-tool signals are cheap: a '?' shortcuts overlay with grouped kbd chips and single-letter mode keys (T/R/S) instantly reads as serious software — worth shipping as a default in any editor-like ns-ui demo.

### https://endlesstools.io/
tool — Endless Tools is a browser-based real-time 3D/motion design editor sold via a pure-black landing page whose hero is a masonry wall of looping WebGL template renders (chrome blobs, halftone CRT text, dithered 3D glyphs, interactive eyeballs).

- **Template masonry hero wall** — The fold is not a product screenshot but a full-bleed, mixed-aspect masonry grid of ~20 looping template renders directly under the centered headline; all color on the page lives in these tiles while the UI chrome stays strictly black/white, so each tile reads like a gallery piece. Tiny uppercase pill tags (GRAPHIC, HALFTONE, EMBED) sit on translucent dark scrims over the artwork. `[CSS masonry/column grid of autoplaying muted video or animated-image covers served via next/image from Supabase storage; tags are absolutely positioned pills with translucent backgrounds]`
- **Liquid Metal template** — Chrome-fluid blob with mirror-like distorted reflections that reads as poured mercury; tagged 'interactive', so it deforms in real time in the editor and embeds. `[WebGL/three.js reflective material with HDRI environment map plus vertex noise displacement; cover on the landing page is a pre-rendered loop]`
- **System Error / Digital Knight halftone renders** — Blackletter text and a 3D knight rendered entirely as CRT halftone/LED dot-matrix on saturated blue and black, converting 3D scenes into retro monitor artifacts. Distinctive because the halftone is applied as a stackable real-time post effect over any scene, not baked into an image. `[WebGL post-processing pass: luminance sampled through a dot/LED grid shader (halftone screen-space effect), stackable with bloom]`
- **Digital Artifact eroded glyph** — A 3D letterform that looks noise-eroded/disintegrating, part solid part static-dither, monochrome on white — 'contrast' as a material rather than a color choice. `[3D extruded vector with a noise-threshold dissolve/dither shader (screen-door style alpha erosion) on the surface]`
- **Eyeball interactive embed** — A hyperreal 3D eyeball on acid green, tagged 'interactive/embed' — the product ships cursor-tracking 3D objects as one-line website embeds, turning a gimmick into a distributable component. `[react-three-fiber/three.js scene in an iframe embed; eye rotation lerped toward cursor raycast position]`
- Candidates: `halftone-text` (loud/medium); `gaze-object` (loud/medium); `showcase-card` (core/small)
- Lesson: Pure-black UI chrome as a gallery frame: keep every interface element monochrome (white text, gray translucent pills, white primary button) and let saturated WebGL/media content be the only source of color — contrast does the branding, matching ns-ui core's restraint rule.
- Lesson: Metadata over media via scrim pills: tiny uppercase tag pills with translucent dark backgrounds stay legible over any artwork without darkening the whole image — a reusable pattern for preview/registry cards.
- Lesson: Motion as content, not decoration: the landing page has no scroll gimmicks; all animation lives inside the template tiles themselves (looping renders), so the page feels alive while layout and typography stay static and calm.

### https://javii.tools/
tool — Suite of tiny one-click generator apps (TextLab, Instatag, StampLab, FolderLab, PixelLab, etc.) that produce pixel-accurate transparent-PNG social/content assets, wrapped in a playful pastel sticker-scrapbook marketing site.

- **Sticker-scatter hero** — Headline 'all in one for content' surrounded by physically-tilted real artifacts the tools produce — a blue iMessage 'hello world!!' bubble, receipt strips, a postage stamp — with the word 'content' set per-letter in alternating brand colors (blue/green/yellow/pink). The props ARE the product demo; hero doubles as portfolio. `[Absolutely-positioned, rotated DOM/SVG elements with CSS transforms and drop shadows over a soft pink-to-lavender radial wash; per-letter color via span-split text]`
- **'Built entirely with SVG' blueprint section** — Components shown as engineering drawings: the iMessage bubble with dimension lines (W=22u, H=12u, r=22 CSS, tail vb=17x21) and control-point dots, the circular stamp with its parametric spec (circularPostagePath, n=24 perforations, θ=360°/n), all sitting on graph-paper cards over a perspective-receding grid floor. Turns implementation detail into a brand flex. `[Inline SVG with annotation layers (dashed dimension lines, anchor dots) on CSS-grid-paper backgrounds; floor is a perspective-transformed grid]`
- **Parametric perforated stamp edge (StampLab)** — Postage-stamp perforation border in four shapes (square/vertical/horizontal/circle) generated from a single parametric path formula, staying crisp at 2K transparent export. `[Runtime-generated SVG path (arc-scalloped edge computed from n and θ), composited with pattern/tint overlays]`
- **Overflowing tool-preview cards** — Grid of tool cards where each preview prop breaks the card boundary — a macOS folder pokes over the top edge, a phone corner juts out — over quiet radial-gradient pastel fields. Creates depth and playfulness without heavy shadows or 3D. `[Card with overflow:visible child positioned partially outside bounds, negative margins/absolute positioning, soft radial-gradient CSS backgrounds]`
- **Dotted-arc horizon divider + ghost footer wordmark** — Hero ends in a wide dashed arc suggesting a planet horizon; footer closes with a giant near-invisible JAVIITOOLS wordmark in barely-raised gray on black. Cheap tricks, strong spatial rhythm. `[SVG dashed elliptical arc path; oversized text with very-low-contrast color and overflow clipping]`
- Candidates: `blueprint-card` (core/medium); `sticker-scatter` (loud/medium); `stamp-frame` (loud/small)
- Lesson: Document the math in the UI: exposing a component's parametric spec (n=24 perforations, θ=360°/n, r=22) as visible blueprint annotations turns engineering into brand identity — highly transferable to a component registry's preview pages.
- Lesson: Depth via boundary-breaking, not shadows: letting preview props overflow their card edges (folder peeking over the top) reads as playful dimensionality while backgrounds stay flat radial washes.
- Lesson: Keep the chrome neutral, put color only inside the artifact: page shell is grayscale with pill nav and black CTAs; saturated color appears exclusively in product output previews and one per-letter accent word, so every colored pixel signals 'this is what you make'.

### https://www.ultramock.io/?template=cmpjnzwv3000004i99zmcbg2d
tool — Ultramock is a browser-based WebGL editor that turns product screenshots into animated 3D device-mockup videos, with a keyframable camera rig, shot-based timeline, and a razor-sharp mono/Swiss editor UI.

- **WebGL device-mockup stage with cinematic camera rig** — The template opens on an extreme close-up of a 3D laptop (FOV 18, zoom 2.9, tilt -19/42) floating in a soft blue-pink gradient sky environment. The low FOV plus tight crop plus environment lighting makes a flat screenshot read as a premium product film frame. Camera params (tilt X/Y, roll, FOV, zoom, pan, rotate) are all directly draggable and keyframable, with a Blur (depth-of-field) section selling scale. `[three.js/WebGL scene with a GLTF device model, perspective camera rig driven by UI-bound uniforms, gradient environment map, post-processing DoF blur]`
- **Inline-hint parameter sliders** — Every slider row IS the control: uppercase Geist-mono label sits inside the track, the gray track fill encodes the value, a mono numeric readout sits flush right, and small kbd-style chips ("DRAG", "SCROLL", "SPACE DRAG") are embedded inside the track to teach the gesture without tooltips. Densest, calmest parameter UI I have seen outside Figma. `[CSS: full-width row with layered background-size fill for value, absolutely positioned label + chip elements, pointer-capture drag handling]`
- **Shot-based keyframe timeline with easing editor** — A full mini after-effects timeline: multiple shots as segments, orange diamond keyframe markers next to any animated property in the side panel, tick ruler, orange playhead, easing/preset controls. The orange diamonds beside sliders double as "this property is animated" state indicators, tying panel and timeline together. `[DOM/SVG timeline with absolutely positioned markers, scrubber via pointer drag, requestAnimationFrame playback driving the WebGL camera]`
- **Metallic chrome UPGRADE pill** — Among otherwise flat monochrome controls, the upgrade button is a brushed-silver chrome pill (vertical metallic gradient with light-edge highlights), making the single monetization CTA feel like a physical premium object rather than a colored button. `[CSS multi-stop linear gradient + inset box-shadow highlights, possibly a subtle animated sheen]`
- **Dark pill toast with embedded CTA** — Onboarding nudge ("Upload media to get started — or paste / drop") floats over the canvas as a high-contrast near-black pill with a white UPLOAD button nested inside it. One element carries message + action, anchored to the artwork rather than a corner. `[CSS: fixed-position flex pill, radius-full, backdrop shadow; likely spring entrance via transform/opacity]`
- Candidates: `device-stage` (loud/large); `hint-slider` (core/medium); `chrome-button` (core/small)
- Lesson: Accent color as semantics, not decoration: the entire editor is grayscale; orange appears only on keyframe diamonds, the playhead, and the active shot — so one hue alone communicates 'this is animated/active'. Maps directly to ns-ui's rule of blue #006bff for interaction only.
- Lesson: Embed affordances in the control surface: kbd-style hint chips (DRAG / SCROLL / SPACE DRAG) living inside slider tracks teach gestures at a glance, killing tooltips and onboarding copy — a pattern worth standardizing in any ns-ui interactive/3D component.
- Lesson: Cinematic 3D framing formula: low FOV (~18) + zoom past 2x + slight compound tilt + soft gradient environment + DoF blur makes even a plain rectangle feel premium; encode these as default camera presets for any ns-ui 3D stage component.

### https://app.ditther.com/
tool — Ditther is a browser-based pixel-art editor that transforms images/video into dithering, halftone, ASCII, LEGO, LED, cross-stitch and voxel renders in real time, all locally via HTML5 Canvas, wrapped in a polished near-black three-panel editor UI.

- **Real-time LEGO mosaic renderer** — The canvas re-renders a photo as a grid of glossy LEGO studs, each cell keeps sampled color but gets its own specular highlight and shadow, so a coarse 40px grid still reads as premium and tactile rather than lo-fi. `[HTML5 Canvas: downsample image via ImageData, then stamp a pre-shaded stud sprite (or radial-gradient draw) per cell tinted with the sampled color]`
- **Live-canvas What's New modal** — The changelog modal's left half is not a video, it's the actual dither engine running: an ASCII-dithered portrait subtly animating, then a particle-dissolve blob on cobalt blue, cycling as slides. The product demos itself inside its own chrome. `[Canvas render loop mounted inside a modal, slide state swaps source + effect params; glassy dark modal with split media/content layout]`
- **Dither engine with duotone ink/paper grading** — Floyd-Steinberg / Atkinson / Bayer algorithms run live on video at 60fps, and a Duotone panel maps the result onto paired ink/paper swatches, turning a retro algorithm into an art-direction tool. `[Per-pixel error-diffusion / ordered-matrix threshold on Canvas ImageData (likely WebGL for video speed), then two-color LUT remap]`
- **Animation presets on still images (Breathe, Drift, Echo, Sweep, Flow)** — Ten named motion presets synthesize movement from a static photo, then export as 60fps MP4, motion as a one-click parameter rather than a timeline. `[Canvas transform/displacement loops (scale oscillation, offset drift, trail buffers) recorded via WebCodecs/MediaRecorder]`
- **Looks preset grid + Shuffle/Remix** — 45+ serialized parameter states shown as vivid live thumbnails (Prism, Acid Rain, Darkroom, Nova Burst), with Shuffle/Remix pill buttons that constrain-randomize the whole parameter space, exploration as a first-class UI verb. `[JSON parameter snapshots rendered at thumbnail scale by the same engine; seeded constrained randomization]`
- Candidates: `dither-image` (core/medium); `reeded-glass` (core/medium); `led-grid-hover` (loud/medium)
- Lesson: A single acid accent used in tiny doses (Ditther's lime appears only in the pixel logo and a mono version string like 'ditther.com · v1.4') brands an otherwise neutral near-black UI without any color wash, a pattern that maps directly onto Geist-blue discipline.
- Lesson: Preview chrome should run the real engine: preset thumbnails and even the changelog modal render the actual effect live at small scale instead of static images, so every surface doubles as a demo. ns-ui component cards could self-render the same way.
- Lesson: Coarse pixel effects stay premium only when each cell carries micro-lighting (LEGO stud speculars, LED glow falloff, halftone dot softness), per-cell shading detail is what separates 'craft' from 'lo-fi filter' in any pixelation component.

### https://namethatui.com/
tool — A visual UI dictionary that maps casual descriptions ("the dark see-through layer behind a popup") to formal component/style names, with per-entry implementation recipes, aliases, accessibility notes, and AI-ready style briefs across ~67 web/macOS elements and 14 design styles.

- **Casual-language lookup + command palette** — The core interaction: you type a vibe-description and get the canonical name plus a code-ready spec. Turns naming ambiguity itself into the product. `[Client-side search index over alias lists per entry, surfaced through a cmd-K palette]`
- **Double-click-any-word definitions** — Every word on the page is a live glossary entry; double-click pops a plain-English definition inline. Rare, delightful reading-layer interaction. `[JS selection/dblclick listener resolving the word against a glossary, rendered as an anchored popover]`
- **Liquid Glass vs Glassmorphism comparison page** — Precisely distinguishes Apple's 2025 material from generic frosted glass with four defining signals (control-layer-only glass, edge lensing, adaptive self-tinting, capsule concentric radii) and gives the exact CSS approximation: backdrop-filter blur(14px) saturate(1.6) + rgba white 8% fill + inset shadows for edge highlights. `[Side-by-side visual comparison with CSS backdrop-filter recipes]`
- **Motion-vocabulary entries (spring, easing, text-scramble)** — Each motion entry ships failure-mode checklists, e.g. text-scramble: per-character settle deadlines, tabular-nums to kill width jitter, real text in aria-label with churning spans aria-hidden; spring: never set duration, retarget from current velocity, watch overflow:hidden clipping overshoot. `[requestAnimationFrame charset churn / spring stiffness+damping documentation with framework-specific code]`
- **AI style-brief blocks** — Every style page includes a copy-paste 'style brief' prompt engineered for coding agents, acknowledging that design vocabulary now has to round-trip through LLMs. `[Static prompt-text blocks per style entry]`
- Candidates: `liquid-glass-toolbar` (core/medium); `text-scramble` (core/small); `define-popover` (core/medium)
- Lesson: Character-cycling text animations must use tabular-nums or a monospace charset so glyph churn never shifts layout, and must keep the final string in aria-label with the animating spans aria-hidden plus an instant prefers-reduced-motion path.
- Lesson: Liquid glass reads as premium only when reserved for a floating control layer over opaque content, with lensing from inset edge-highlight shadows and saturate() in the backdrop-filter; glass-everywhere collapses into generic glassmorphism.
- Lesson: Springs should never carry an explicit duration: tune stiffness/damping, retarget from current velocity on interruption instead of snapping, and audit overflow:hidden ancestors that would clip the overshoot.

### https://valessa.riotters.com/
tool — Valessa is Riotters' in-browser 3D product visualizer: an R&D editor app where you load logo/GLB models, dial in physically-based glass materials (transmission, dispersion, iridescence, clearcoat), pick shader/video backgrounds, add 3D text, and export image/video/GLB.

- **Physically-based glass material stack** — The default hero object is a chunky glass arrow with transmission 0.98, IOR 2.01, spectral Dispersion (rainbow edge splitting), cyan Attenuation Color that tints thick regions, plus a full Iridescence layer (intensity, IOR, thickness min/max 236-249nm) and Clearcoat. That is the real MeshPhysicalMaterial/MeshTransmissionMaterial parameter set, exposed raw, and it looks genuinely premium rather than faked frosted-glass CSS. `[WebGL via react-three-fiber, drei MeshTransmissionMaterial (transmission + chromatic dispersion + attenuation) layered with iridescence thin-film and clearcoat on MeshPhysicalMaterial]`
- **Momentum drag + tilt interaction system** — An 'Interactions' panel exposes Momentum and Tilt Amplitude (0.15) as user-tunable params: the object keeps spinning with inertia after a drag and tilts subtly toward the cursor. Making interaction feel like a material property you dial in, not hardcoded, is the clever part. `[r3f pointer events feeding spring/damped velocity state (useFrame lerp or maath.damp), angular velocity carried after pointerup for momentum]`
- **Swappable background layer: solid / shader / image / video behind a transmissive object** — Backgrounds include animated shader gradients and looping videos rendered behind the glass model, so the transmission and dispersion refract live moving content. Video-through-glass with fit/loop/muted/opacity controls is rarely seen and instantly sells the material quality. `[Fullscreen shader plane or VideoTexture plane behind the model in the same WebGL scene, so the transmission buffer samples it during refraction]`
- **3D typography with live font controls** — A Text section places extruded/planar text into the 3D scene with font family, weight, letter-spacing and line-height controls, positioned in world space (X/Y/Z) so glass objects refract the type behind them. `[drei Text (troika-three-text SDF rendering) with runtime font swapping]`
- **Dark editor chrome around a live viewport** — Near-black panels (#0a-ish) with pill sliders that double as value readouts (label centered inside the slider fill, value right-aligned in muted gray), uppercase letter-spaced group headers (BASE, GLASS / TRANSMISSION, IRIDESCENCE), and thumbnail grids for models/materials/backgrounds. Dense pro-tool UI that stays calm and legible. `[CSS: filled-track range inputs styled as full-width pills, 12px radius cards, thumbnail buttons with 1px borders and subtle active rings]`
- Candidates: `dispersion-glass-object` (core/large); `inertia-drag` (core/medium); `value-pill-slider` (core/small)
- Lesson: Refraction sells realism only when there is something behind it to refract: put animated shader gradients or video behind transmissive materials so dispersion and attenuation act on moving content, not a flat color.
- Lesson: Expose interaction feel (momentum, tilt amplitude, damping) as first-class props with sane defaults, the same way material roughness is a prop; it makes physics-based motion tunable per install instead of baked in.
- Lesson: Dense control panels stay calm by merging label, track, and value into one pill per row (label centered in the fill, value right-aligned muted) with uppercase letter-spaced section headers, so 20+ controls fit without visual noise on a near-black surface.

### https://saveweb2zip.com/en
tool — A free single-purpose utility that downloads any website's files (HTML, CSS/JS, images, fonts) into a ZIP archive from one URL input.

- **Live download progress counter** — The one moment of delight on an otherwise plain page: a templated "Downloading {n} files" counter that ticks up in real time while the archive builds, turning a boring wait into visible work. `[Client-side polling/websocket updating a text node; a reactive template binding ({{downloadedFiles}}), no fancy rendering]`
- **Single-input hero CTA** — The entire product is compressed into one URL field + Save button with option checkboxes beneath, zero navigation friction; a textbook utility-tool hero. `[Plain HTML form, flexbox layout, no notable animation]`
- Candidates: `progress-button` (core/small)
- Lesson: Show work, not spinners: a concrete ticking count ("142 files") reads as trustworthy progress where an indeterminate spinner reads as stalled. Any ns-ui loading state should surface a real number when one exists.
- Lesson: One-input products earn the right to a huge, centered input: when a component's job is a single action, strip all secondary chrome and let the field + button own the viewport.

### https://designmd.cc/
tool — DesignMD is a URL-to-DESIGN.md extraction tool that measures a live site's DOM/CSSOM and outputs an AI-agent-ready design-system spec, with benchmark specimen pages for Stripe/Vercel/Linear/etc.

- **Editorial mixed-typeface hero** — Large geometric sans headline with the phrase 'design DNA' set in italic serif and tinted the rust accent — a single typographic swap that gives a dev tool an editorial, print-like voice on a warm near-black background. `[Pure CSS: inline <em>/<span> with a serif italic font-family and accent color inside the sans headline; warm dark palette with subtle radial glow behind the input card.]`
- **Bracket-chip example buttons** — Suggested URLs rendered as monospace chips literally wrapped in square brackets ('[ apple.com ]'), reading like CLI arguments — perfectly on-theme for a tool whose output is markdown for coding agents. `[CSS: mono font, thin border, bracket glyphs as ::before/::after pseudo-elements (easy to animate apart on hover).]`
- **Benchmark 'measured design specimen' pages** — Each benchmark page presents an extracted palette as labeled hex swatches, an 'Aa Bb 123' type specimen with detected font names, and a live-site preview thumbnail — a design system displayed as a lab specimen, with serif page titles ('Vercel', 'A measured design specimen of vercel.com'). `[Static grid layout populated from extraction JSON; swatch tiles with mono hex captions, iframe/screenshot preview panel.]`
- **Mono microlabel system** — All meta-information (eyebrows like 'FEATURED ANALYSES', 'EXTRACTED PALETTE', stats like '5,267 DESIGN.md generated · ~12s') is uppercase letterspaced monospace, cleanly separating chrome/data from editorial serif+sans content. `[CSS utility: mono font, ~0.08em letter-spacing, uppercase, muted color; live counter likely a simple fetch + count-up.]`
- **Download button with embedded filename** — The primary CTA fuses the action ('Download') with a mono filename token ('vercel-design-system-analysis.md') in one pill, making the deliverable tangible before you click. `[Flex button with two text segments in different typefaces/opacities inside one accent-filled rounded rect.]`
- Candidates: `token-specimen-card` (core/medium); `bracket-chip` (core/small); `filename-button` (core/small)
- Lesson: A single italic-serif word inside a sans headline (plus accent tint) is a cheap, high-impact way to inject editorial personality without breaking a system font stack — transferable to ns-ui hero/demo headers using a serif display face against Geist Sans.
- Lesson: Route ALL meta-text (eyebrows, stats, captions, filenames) through one uppercase letterspaced mono style: the strict content-vs-chrome typographic split makes both layers read cleaner, and Geist Mono is built for exactly this.
- Lesson: Make abstract data physical: showing tokens as swatches-with-hex, fonts as 'Aa Bb 123' specimens, and files as visible filenames inside buttons turns a spec into an object — good default for any ns-ui docs/registry UI.

### https://glass3d.dev/
tool — A self-demonstrating CSS generator for realistic "3D glass" surfaces: you tune backdrop-filter, tint, and noise-texture params on the live UI (which is itself made of the glass) and copy the resulting CSS.

- **Three-layer glass recipe** — Glass is built as a pseudo-element sandwich: ::before carries backdrop-filter (blur 32px + brightness 0.85 + saturate 2.5) plus an hsl tint overlay, ::after carries the specular rim, and children sit at z-index above both, so content never gets blurred by its own glass. Cleanly parameterized via CSS custom properties (--filter-glass3d, --color-glass3d, --noise-glass3d). `[Pure CSS: backdrop-filter on ::before, box-shadows on ::after, z-index layering, CSS custom properties]`
- **Inset specular edge highlight** — The 'wow' that makes the glass read as 3D: five stacked inset box-shadows on ::after (e.g. inset 2px 2px 1px -3px hsl(205 20% 90% / .8) down to hairline 0 0 0.25px 0.5px washes) simulate a top-left rim light catching a beveled glass edge — no borders, no images. `[CSS multi-value inset box-shadow with negative spread values]`
- **Seven-step graduated drop shadow ramp** — Outer depth uses 7 layered box-shadows with progressively growing offset/blur and increasingly negative spread (0.7px…8px offsets, -0.4px…-2.5px spreads), producing a smooth physically-plausible penumbra instead of one muddy blur — a Josh Comeau-style shadow ramp baked into a copyable snippet. `[Layered CSS box-shadow with negative spread]`
- **Tiled noise texture in the glass** — A repeating ~100px grain texture (rice paper / egg shell / ink jet / coarse / topology options from transparenttextures.com) is composited into the ::before layer on top of the blur, giving the glass a frosted, tactile materiality that flat backdrop-blur glass lacks. `[background-image tile on the backdrop-filter pseudo-element]`
- **Self-demonstrating playground over swappable backdrops** — Every control panel, toggle, and code block IS the glass being configured, and you can flip the backdrop between dark photo, looping video, and light photo to stress-test the recipe — instant proof the effect survives any background. `[Live CSS custom-property updates on the app shell + dark/video/light background switcher]`
- Candidates: `glass-panel` (core/small); `glass-video-hero` (loud/medium)
- Lesson: Convincing glass is a stack of cheap effects, not one filter: backdrop blur + brightness/saturate correction + color tint + tiled noise grain + inset rim highlight + graduated outer shadow. Any single layer alone looks fake; encode the full stack in ns-ui glass components.
- Lesson: Shadow ramps beat single shadows: 5-7 layered box-shadows with growing offsets and increasingly negative spreads (sub-pixel values like 0.7px/-0.4px included) produce smooth, physical penumbras — worth making a --shadow-ramp token in ns-ui.
- Lesson: Put backdrop-filter on a ::before pseudo-element and lift children above it with z-index; applying it to the element itself risks interaction with child stacking, and the pseudo-element pattern lets the whole recipe ship as one drop-in class parameterized by CSS custom properties.

### https://v0.app/
tool — v0 by Vercel is an AI web-app builder whose marketing homepage is a Geist-styled showcase: prompt-box hero, community template gallery, logo marquee, and an agentic workflow diagram.

- **Prompt-box hero ("What do you want to create?")** — The hero is not a headline + CTA but a live-looking AI prompt input with a model badge (v0 Max) and template quick-link chips (Contact Form, Image Editor, Mini Game). The product IS the hero — instant comprehension, zero marketing copy. `[Styled textarea/input with focus ring and chip buttons; likely CSS focus-within glow + subtle border treatment on Geist dark surface]`
- **Integration logo carousel** — 12 tech logos looping horizontally in a seamless band — communicates ecosystem breadth without a single word. `[CSS keyframe marquee (duplicated track, translateX loop), typically with mask-image edge fades]`
- **Agentic workflow diagram (Plan → DB → API → Deploy → LLM)** — Abstracts an invisible agent pipeline into a legible node-and-connector diagram, selling a backend capability visually. `[SVG/flex node diagram; connector lines likely animated via stroke-dashoffset or moving gradient beams (Vercel house style)]`
- **Community template gallery** — Grid of user-generated app cards with thumbnails and view/like counts — social proof rendered as product surface, with hover states per card. `[CSS grid of thumbnail cards, hover elevation/border transitions]`
- **iPhone-frame mobile showcase** — Real generated mobile sites shown inside a device frame with a rotating template gallery, grounding claims in actual output. `[CSS device-frame mockup + screenshot carousel]`
- Candidates: `prompt-hero` (core/medium); `logo-marquee` (core/small); `pipeline-beam` (core/large)
- Lesson: Let the product be the hero: a functional-looking input with suggestion chips communicates faster than any headline + CTA pair; components can embed their own demo affordance.
- Lesson: Motion is used only where it carries meaning (marquee = breadth, beam = data flow); everything static stays static — restraint is what makes the moving parts read.
- Lesson: Edge treatment sells infinite loops: mask-image fades on carousel edges turn a crude repeat into something polished, a tiny detail worth defaulting into any marquee/scroller component.

### https://www.happyhues.co/
tool — Happy Hues is a color-palette inspiration tool where selecting any of 17 palettes live-rethemes the entire site (layout, UI, and illustrations) to show colors in real context.

- **Whole-site live palette swap** — Clicking a palette number recolors literally everything on the page — backgrounds, headlines, buttons, cards, tags — instantly demonstrating the palette in context instead of as dead swatches. The site itself IS the preview. `[Semantic CSS custom properties (--background, --headline, --button, etc.) swapped at the root per palette, with CSS transitions on background-color/color for a smooth crossfade; built in Webflow with JS class/variable toggling]`
- **Theme-bound SVG illustrations** — The hero illustrations recolor along with the UI (stroke, main, highlight, secondary, tertiary roles), proving the palette works for illustration too — rarely seen because most sites use raster art. `[Inline SVG with fills/strokes bound to the same CSS variables (or role-based classes) as the UI, so a single variable swap recolors the artwork]`
- **Click-to-copy hex chips with role labels** — Every color is presented as a labeled role (Background, Headline, Button text, Card tag) rather than an anonymous swatch, and a single click copies the hex — the taxonomy teaches application, not just aesthetics. `[Clipboard API on click over simple labeled chip components; role taxonomy is the design insight more than the code]`
- **Palette/section view toggle** — A toggle switches between seeing the full palette at once and seeing only the colors used in the current scrolled section, tightening the color-to-context mapping. `[State toggle showing/hiding grouped swatch lists per page section, plain JS class switching]`
- Candidates: `theme-morph-panel` (core/medium); `copy-swatch` (core/small)
- Lesson: Bind every color to a semantic role variable (--background, --headline, --button, --card-tag), never raw hexes in components — this is what makes whole-surface live retheming a one-line swap, and it extends to inline SVG fills so artwork rethemes with the UI.
- Lesson: Show colors (and by extension any design token) in composed context, not isolated swatches — a fake mini-UI demonstrating the token in use communicates far more than a grid of values.
- Lesson: A global transition on background-color and color (roughly 300-500ms eased) turns a jarring theme flip into a pleasing crossfade; cheap to add, disproportionate perceived polish.

### https://blush.design/
tool — Blush is an illustration customization tool (by Pablo Stanley et al.) where users mix-and-match parts and colors of artist-made vector illustration systems and export PNG/SVG, with Figma/Sketch plugins.

- **Hero part-swap composer demo** — The hero illustration shows a character with a dashed rounded-rect selection frame over the head and a floating white tray of five swappable hair/face variants, with the selected one outlined in blue — it instantly communicates the entire product mechanic without a word of explanation. `[Layered SVG/PNG character with an absolutely-positioned variant tray overlay; in the live app it's React state swapping SVG component layers; the dashed frame is a simple dashed border with large radius.]`
- **URL-encoded illustration state** — Every customized illustration is deep-linkable: colors and part choices are serialized into the query string (e.g. ?c=Hair_0~3164cf_Skin_0~b02d1c), so any recolored variant is a shareable permalink rather than a saved asset. `[Client-side SVG recoloring driven by parsed URL params; fills mapped to named slots (Hair_0, Skin_0) with hex values.]`
- **Create Random entry point** — The primary CTA is 'Create Random' — a randomizer that composes a fresh illustration from the part/color space on every click, turning the first-touch experience into a toy instead of a browse page. `[Random sampling over the component/color parameter space, rendered as composed SVG layers client-side.]`
- **Community remix grid** — The 'From the community' grid shows user-created variants where each card links back to the exact parameterized state that produced it, plus artist avatar chips — provenance and remixability built into a simple card grid. `[Standard card grid; each card href carries the full customization query string; circular artist avatars via imgix ellipse mask params.]`
- Candidates: `variant-tray` (core/medium); `remix-button` (core/small)
- Lesson: Serialize component customization state into the URL (named slots + hex values in a query param) so every variant of a configurable component demo is a shareable permalink — great pattern for a registry preview site.
- Lesson: A dashed rounded outline plus a floating variant picker is a universally-read affordance for 'this part is editable' — stronger than any label or tooltip.
- Lesson: Make the primary CTA a toy, not a task: 'Create Random' invites play before commitment, lowering the barrier to first interaction with a configurable system.
