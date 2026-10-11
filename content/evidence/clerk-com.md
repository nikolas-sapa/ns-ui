---
source: https://clerk.com
kind: site
cohort: agent-tools
verdict: mixed
studied: 2026-10-11
context: [hero, nav, features, testimonials, footer]
signals:
  gradient-blob: absent
  three-card-row: present
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: absent
  testimonial-card-row: absent
  indigo-violet-accent: present
  gradient-fill-cta: absent
  scroll-reveal-blank: present
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: absent
  asymmetric-split: present
  single-optical-anchor: absent
  type-scale-high-contrast: absent
  editorial-grid-break: present
  custom-type-pairing: absent
  real-product-screenshot: present
  artifact-not-dashboard: absent
  density-variation: present
  one-accent-discipline: absent
  live-claim-control: absent
materials: [single-theme]
---
Captured at 1440x900; full page 7187px. An achromatic, card-built page whose two
most interesting facts are both negatives: a gradient blob that is declared and
never paints, and a sign-up form that is the product rather than a picture of it.

**The declared blob that renders nothing.** One element on the page carries
`linear-gradient(to right in oklab, rgb(98, 72, 246) 10%, rgb(58, 212, 253) 100%)`
— indigo to cyan, the archetypal palette — at 754x727 with
`border-radius: 3.35e7px`, which makes it a circle, at `opacity: 0.25`, sitting at
y=4447. On the evidence it should be the most visible thing on that screen. It is
not visible at all. Twelve pixel samples across that row at scroll offset 4100
(page y 4140 to 4940) return `#f7f7f8` at every point — not one channel of
deviation from the field. The element is occluded or clipped to nothing.
`gradient-blob` is scored absent on what the page renders, and this is the
clearest case in the cohort of CSS and pixels disagreeing: a source grep would
have scored it present.

The same trap sits on `glass-card-overuse`. A naive count finds sixteen
`backdrop-filter: blur()` surfaces, five above the v3 threshold of three. They
are sixteen 1440x50 `pointer-events-none` strips with blur stepping 1px, 1px,
2px, 2px, 3px, 4px — one progressive-blur mask under the sticky nav, assembled
from stacked bands. One effect, not sixteen glass cards. Absent.

**The product is mounted, not photographed.** The hero's lower half is Clerk's
own `<SignUp />` surface rendered live in the DOM: "Create your account",
"Continue with Google" with a "Last used" tag, "Continue with GitHub", a password
field, all set in `ui-sans-serif` at 17px — Clerk's component default, not the
marketing face. Flanking it at left and right, cropped by the section edges and
dimmed, are a second and third surface (`Sign in to your account`, a user-profile
panel with `chris.walker@example.com`). Further down an Acme, Inc. storefront
renders Clerk's `<PricingTable />` with $9 / $19 plans and then a Checkout drawer
with "Total Due Today USD $14.00", a saved `Visa ··· 4242` and an Apple Pay
button. `real-product-screenshot` is present, but the definition strains: nothing
here is a raster capture. The vocabulary says "shown as a real screenshot" and
the strongest version of the thing it is reaching for is this — the interface
itself, in the page, at real size. Worth a note in v4.

**Hero geometry.** Headline left at x=120, 56px weight 700, `letter-spacing:
-1.96px`, on 64px leading, against an 18px subhead — a 3.1:1 display-to-body
ratio, so `type-scale-high-contrast` is absent. To its right at x≈884 sits a dark
pill carrying "Build with agents" over a mono line,
`Add Clerk auth to my app: clerk.com/SKILL.md`, with a copy button: a prompt
addressed to a coding agent, placed where a product shot usually goes. Two
unequal masses at opposite margins with the right one a third the width of the
left: `asymmetric-split` present, `centered-hero-stack` absent. The only six
centered headings on the entire page are inside the embedded product UI.

**Type is one grotesque and a numerals face.** Suisse Int'l (`suisse`) sets
everything visible, with `geistNumbers` layered ahead of it in the stack to
substitute figures and `soehneMono` for the command line. That is a deliberate
pairing, but an invisible one — there is no second voice on the page — so
`custom-type-pairing` is absent and `generic-sans-default` is absent. A licensed
Swiss grotesque is the opposite of a system stack.

**The chamfer.** Every dark/light section boundary is cut by a notch: the
rectangle's top edge steps down at x≈130 and x≈1300, producing two small
trapezoids where a straight edge would be. It recurs at three boundaries and is
the page's one piece of non-rectangular geometry. Combined with the testimonial
masonry, which bleeds past its container and fades to nothing at top and bottom
mid-card, `editorial-grid-break` is present — though both devices are edge
treatments on an otherwise rigid three-column grid, not a break in the column
structure itself.

Where the template wins:

**It is cards almost all the way down.** The dark feature section is an
eleven-card bento in three ~395px columns — Multifactor Authentication, Session
Management, Email and SMS one-time passcodes, Fraud and Abuse Prevention, Magic
Links, Social Sign-On, Advanced security, Bot Detection, Passwords, API Keys,
Clerk CLI — each with a near-black fill, a hairline border, 12px radius, a tonal
illustration and a two-line body. Varying heights across the column save it from
being a grid of identical tiles, but one rank of it (Advanced security / Bot
Detection / Passwords) is three equal-width cards at one top and one bottom edge,
and the light bento below repeats the figure. `three-card-row` present.

The artwork inside those cards is the reason `generic-line-icon-set` is absent:
eleven distinct tonal renders — a phone with Phone/SMS/Books/TV app tiles, a
fingerprint pad, a keyhole, three server racks mid-`Authenticating...`, an SSO
provider graph with GitHub, Notion and Dropbox marks — each a different object,
none a stroke glyph. The only repeated glyph on the page is a circled check in a
three-item checklist, which is what a checklist is for.

**Accent sprawl, mild but real.** Five saturated text colours carry meaning:
`rgb(108, 71, 255)` violet on the section eyebrows (Billing, Multi-tenancy),
`rgb(93, 227, 255)` cyan on the Frameworks eyebrow, plus reds, greens and an
orange inside embedded product states. Two of those are marketing chrome and they
are different hues on sibling headings in the same dark section.
`one-accent-discipline` absent.

`single-optical-anchor` is absent on three competing masses in the first
viewport: the 56px near-black headline at left, the dark agent-prompt pill at
right, and a bright white shadowed sign-up card centred below. 88.9% of viewport
pixels are `#f7f7f8` and the page spends its three darkest objects in three
different places.

`scroll-reveal-blank` is present and the number is the worst in this cohort. With
nav, menu and dialog subtrees excluded, 5137 characters of body prose render at
under 8% effective opacity at rest, against 4998 characters visible — more of the
page's text is faded than shown. Much of that is the deliberate depth-fade on the
flanking product panels, which is a design choice rather than a reveal; but 44
text nodes cross from under 8% to visible only after a full scroll walk, so
reveals are firing too, and a reader who does not scroll, or an agent reading the
rendered page, sees roughly half the words at an eighth of their contrast. With
JavaScript off the page yields 8958 of 14893 characters, 60%.

`emoji-as-icon` is absent and the raw scan again lies: the five emoji found
(🥹 🎭 💀 🦞 and a chevron) all sit inside quoted tweets in the testimonial
masonry — reader content, under names like "Drew🎭" and in a list ending
"4) Custom auth (💀)". Not one is standing in for an icon.

`testimonial-card-row` absent: the social-proof block is a two-column
variable-height masonry of tweets fading out at both ends, set beside one
separate pull-quote (Paul Copplestone, Supabase CEO) in the left column.
`gradient-fill-cta` absent — the primary buttons are flat `#131316`.
`badge-pill-spam` absent at one rounded element above the fold, a 40px support
bubble. Single theme, light-native: a dark-scheme render differs by 0.0% of
sampled pixels despite 336 `dark:`-style hooks in source and zero
`prefers-color-scheme` rules.
