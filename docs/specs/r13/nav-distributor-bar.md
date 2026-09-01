> **CUT — do not build.** D5 records that the Linotype distributor mechanic "now leaves the round entirely" after `convert-matrix-return` was cut. A third distributor concept does not revive it.
>
> Spec retained in full below only so the orchestrator can overrule with the
> full argument in hand. See `INDEX-nav.md`.

# distributor-bar — language switcher as a Linotype distributor

## 1. Surface replaced + real process

**Surface:** the **language switcher** in a marketing site's header or footer —
landing-page furniture, not a preferences screen.

**Real process:** the **Linotype distributor** (Mergenthaler, 1886 onward).
After a line of type is cast, the brass **matrices** are lifted to a
**distributor bar** and hung from it by **seven teeth cut into their ears in a
unique combination**. As a matrix is screwed along the bar, the bar's own
profile releases the teeth one at a time; when the last engaged tooth clears,
the matrix falls into **its own channel** of the magazine above the keyboard.
There is no controller and no sensing — **the shape of the thing being sorted
is its address**. Changing typeface or alphabet means swinging a **different
magazine** into the running position on the magazine frame; the same matrix
then falls into a different channel, because the channel map moved.

## 2. Nearest existing slug — why this is not a restyle

Nearest: **`hero-letterpress-lockup`**, **`streaming-token-settle`**,
**`jacquard-card-chain`**, **`punch-patch`**.

`hero-letterpress-lockup` slides headline glyphs in as metal sorts and locks
them up — a **hero type** event whose subject is the headline itself, one-shot
and finished. `streaming-token-settle` sits loose tokens off-baseline and
snaps them into place as text streams. Both are about **setting** type;
neither sorts anything and neither runs at rest.

`jacquard-card-chain` and `punch-patch` use punched-card combinatorics as an
**authority/permission** matrix — a lookup, and both are dashboard-adjacent
surfaces rather than page furniture. The distributor's claim exists in none of
them: a **continuous, controller-free sort where the address is a physical
tooth combination**, and a switch that works by **moving the destination
rather than the item**.

## 3. The mechanic — numbers

Geometry from `S = min(hostW, hostH)`. Assembly `56 x 30` px at `S >= 520`,
`44 x 24` below.

- **Distributor bar:** a 1px horizontal rail, **48 px** long (36 px below
  `S = 520`), with **7 profile steps** along it at 6.9 px spacing — the points
  at which successive teeth are released.
- **Magazine:** below the bar, `L` channels (one per offered language, 4-9),
  each a 1px vertical slot `9 px` tall at `48 / L` px pitch. The **running**
  magazine is drawn solid; the **idle** magazines behind it are two 1px
  outlines offset 2px and 4px up-left on the frame.
- **Matrices:** 4x6 px glyphs with a 3px toothed ear drawn as 2-3 notches.
  They travel the bar at **26.0 px/s**, so a full traverse is **1.846 s**.
  A new matrix enters every **0.86 s**, so 2-3 are on the bar at any time.
- **Drop:** each matrix's tooth combination sets its release point
  `x_i = 6.9 * c_i` where `c_i ∈ [1..7]`. On reaching `x_i` it falls into the
  channel below over **150 ms** with `a = 2*9/0.15² = 800 px/s²`, landing with
  a 0.8 px squash on `k = 760, c = 30, m = 1`.
- **Magazine change (the switch).** Selecting a language:
  1. the running magazine **swings out** — translate 4 px up-left and fade to
     the idle outline over **220 ms**, `cubic-bezier(.4,0,.2,1)`;
  2. the selected magazine **swings in** over **260 ms** with a 1.4 px
     overshoot settling on `k = 420, c = 28, m = 1`;
  3. the **channel pitch re-lays** to the new magazine's channel count over the
     same 260 ms.
  Total **480 ms**. The distributor **does not stop** during the change —
  matrices already on the bar keep travelling and drop into the *new* channel
  map, which is exactly what happens on a real machine and is the whole point.
- **The page's language changes at t = 0 ms**, on activation, before the swing
  starts. The assembly is a readout, never a gate. Making a user wait 480 ms
  for their own language change so an ornament can finish is a defect.

**Perceptual budget (explicit):** the moving elements are 2-3 matrices at
4x6 px — **72 px²** — inside a 56x30 assembly, i.e. **4.3%** of the assembly
and a rounding error against the header. Peak per-frame luminance change on
any pixel is **0.08 L**. **No text moves at all**: the current language's
label is rendered beside the assembly on a fixed baseline and is never drawn
on a matrix, and matrices carry notch marks rather than letterforms
(letterforms on a moving 4x6 glyph beside body copy would be the exact thing
this slice must not do). The assembly's box is fixed; a magazine change
re-lays channels **inside** it, so nothing reflows.

## 4. t = 0 / 2.5 / 5 s, zero input

Matrices enter at `t = 0, 0.86, 1.72, 2.58, 3.44, 4.30, ...` and travel at
26.0 px/s along a 48 px bar:

- **t=0:** one matrix at **0.0 px** (just entered). Bar otherwise empty.
- **t=2.5:** the `t=0.86` matrix at **42.6 px** — past release step 6, about
  to drop; the `t=1.72` matrix at **20.3 px**, between steps 2 and 3. Two
  matrices, both mid-bar, at different tooth states.
- **t=5:** the `t=4.30` matrix at **18.2 px** and the `t=3.44` matrix at
  **40.6 px**. A different pair, at different positions from t=2.5, with a
  different set of channels already filled below.

Three visibly different configurations. One always-running rAF loop; nothing
gated on hover, focus, open state, or `autoplay`.

## 5. Reduced-motion freeze frame

**`STATIC_TIME = 3.12 s`**, mid-magazine-change (the change is scripted to
begin at 2.90 s in the reduced-motion demo).

At 3.12 s: one matrix is **mid-fall at 5.6 px of its 9 px drop**, aimed at a
channel; a second is **at release step 5** on the bar with two teeth still
engaged; the outgoing magazine is **2.4 px into its 4 px swing-out** and
half-faded to outline while the incoming one is **1.1 px past its overshoot
peak**; both magazines are therefore visible at once, at different depths on
the frame. This is the only frame class showing all four claims together — a
matrix in transit, a tooth release in progress, a drop in flight, and two
magazines on the frame.

t=0 shows a bare bar, one matrix at the origin, and one magazine — a static
diagram of a rail.

All quantities are constants, so the frame is byte-stable. Under reduced
motion the magazine change is instantaneous, matrices do not travel, and the
frozen frame above is what renders.

## 6. Hue carried by luminance, both themes

| element | token | light | dark |
|---|---|---|---|
| distributor bar | `--foreground` @ 0.45 | 0.45 | 0.52 |
| release steps | `--border` | 1px stroke only | 1px stroke only |
| matrix body | `--foreground` @ 0.66 | 0.66 | 0.74 |
| matrix tooth notches | `--background` (cut out) | — | — |
| running magazine channels | `--foreground` @ 0.38, **solid** | 0.38 | 0.45 |
| idle magazines | `--ns-muted`, **1px outline** | 1.0 | 1.0 |
| landed matrix in channel | `--foreground` @ 0.72 | 0.72 | 0.80 |
| current-language label | `--foreground` | 1.0 | 1.0 |

No hue anywhere. Running vs idle magazine is **solid vs outline**, and a
matrix's identity is its **notch pattern cut out of its body** — both
geometric, so they survive greyscale, forced colours, and light theme's low
end. Light theme is checked first: `--foreground @ 0.38` channels on a light
`--background` are the faintest structural element, so each channel carries a
1px `--foreground @ 0.62` cap at its mouth and is never read from its fill
alone. `--ns-accent` appears **only** on the trigger's and options'
`:focus-visible` rings — never on a matrix, bar, channel, or magazine.

## 7. Accessibility

**Pattern.** A **disclosure + listbox with `aria-activedescendant`**, which is
the right shape for 4-9 options (a radiogroup, as used by the sibling theme
switcher, does not scale past three and would cost a header user nine tab
stops).

```html
<button id="lang-btn" aria-haspopup="listbox" aria-expanded="false"
        aria-controls="lang-list">Language: English</button>
<ul id="lang-list" role="listbox" aria-labelledby="lang-btn"
    aria-activedescendant="lang-de" tabindex="-1">
  <li role="option" id="lang-de" lang="de" aria-selected="false">Deutsch</li>
  ...
</ul>
```

**`lang` on every option — the detail language switchers routinely miss.**
Each `role="option"` carries its own `lang` attribute (`lang="de"`,
`lang="ja"`), so a screen reader switches voice and pronounces **"Deutsch"**
in German rather than reading it as English. The trigger's label carries the
*current* language's `lang` on the language-name span for the same reason.
Without this, the list is a row of mispronounced words — which is precisely
the population this control exists for.

**Focus management.** DOM focus stays on the **trigger** the entire time;
`aria-activedescendant` moves the virtual cursor through the options. There is
therefore **no focus trap to build and none to get wrong**, and Tab always
leaves the control.

**Keyboard.**
- `Enter` / `Space` / `ArrowDown` / `ArrowUp` open the listbox; opening moves
  the active option to the currently selected language.
- `ArrowDown` / `ArrowUp` move the active option (no wrap — wrapping a list of
  languages makes "am I at the end?" unanswerable). `Home` / `End` jump to
  first / last.
- **Type-ahead:** printable characters accumulate for 800 ms and jump to the
  first option whose label starts with the buffer, matching on the option's own
  `lang` text.
- `Enter` / `Space` select and close. `Tab` closes **without** selecting and
  moves on.
- `Escape` closes **without selecting** and returns focus to the trigger.
  Escape when the listbox is shut is a **no-op and is not consumed**.

**aria-live — one case.** Selection itself needs no live region:
`aria-selected` plus the trigger's updated accessible name carry it. The
genuine case is that changing language **changes the page's content under the
user**, which no ARIA state expresses. So one `role="status"`
`aria-live="polite"` message fires on commit — *"Language changed to Deutsch."*
— with `lang="de"` on the message element so it, too, is pronounced correctly.
Nothing about the bar, the matrices, the teeth, the drops, or the magazine
frame is ever announced.

**Document language.** On commit the component sets `document.documentElement.lang`
and, for RTL languages, `dir`. A language switcher that does not update the
document's `lang` is decorative.

**Gate descriptor.** `openBy: "button[aria-haspopup=listbox]"`,
`expect: "[role=option][data-first]"` — a real option, which the closed
control genuinely occludes and the open listbox genuinely exposes. Not the
trigger and not the assembly SVG: both render identically open and shut, which
is the trap `docs/review-workflow.md` records.

**What a screen reader hears, end to end.** "Language: English, button,
collapsed, has pop-up listbox" → Enter → "listbox, English, selected, 1 of 6"
→ ArrowDown → "Deutsch, 2 of 6" *(spoken in German)* → Enter → "Language:
Deutsch, button, collapsed" → "Language changed to Deutsch."

**Contrast.** The trigger label and option labels are `--foreground` on
`--background` (>= 12:1 both themes). The selected option is marked by a 2px
filled leading rule **plus** weight 620 — never by tone alone. Focus ring 2px
`--ns-accent` at 2px offset; options carry 8px padding so the active-descendant
outline never clips.

## 8. Behaviour in a short /preview card viewport

At 400x260: `S = 260`, so the assembly drops to `44 x 24`, the bar to **36 px**
with its 7 release steps at 5.1 px spacing, and the matrices to 3x5 px. Matrix
speed scales with bar length to **19.5 px/s**, holding the 1.846 s traverse and
the 0.86 s entry cadence, so t=0/2.5/5 still resolves to three distinct
configurations at card scale.

The listbox opens **downward inside the card** and is height-capped at
`hostH − triggerBottom − 12` px with internal scrolling and
`scroll-margin-block: 4px` on options, so arrow-key navigation past the fold
scrolls the list rather than the card. Below `hostW = 300` the trigger's label
shortens from "Language: English" to the bare language name **visually**, while
its `aria-label` keeps the full "Language: English" string — the accessible
name is never shortened.

The distributor runs whether the listbox is open or shut, so the card's
t=0/2.5/5 gate passes on the **closed** resting state that `/preview/<name>`
screenshots, with no `autoplay` flag and no pointer input.
