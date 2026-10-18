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
  real-product-surface: present
  shows-deliverable: present
  density-variation: present
  one-accent-discipline: absent
  live-claim-control: absent
materials: [single-theme, origin-authored]
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
`backdrop-filter: blur()` surfaces against a threshold of three or more. They
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

**v4 hole-7 deliverable re-pass**

Capture: reused `~/scratch/antislop/s5/clerk-com` (walked 2026-10-16), 11 tiles,
`clamped: false`, `coverage: 1`, `docH_before` 7187 = `docH_after` 7187 (no
drift), stitched to two strips totalling 7187px. The last strip ends in the
footer (Product / SDKs / Resources / Company / Legal columns, `© 2026 Clerk,
Inc.`, social icons). The fixed cookie banner repeats on every tile; it is
walker chrome, not page content. The walker shows the hero on its default tab,
so the other three hero tabs were opened with Playwright and read off the DOM.
The tabs do not auto-rotate: `User Authentication` is still selected after 12s.

Candidates weighed (page y with the relevant tab selected, scrollY 0):

- Hero, `User Authentication` tab (y≈546-1073): the live `<SignUp />`, inside
  product chrome. "Create your account", "Continue with Google" / "Last used",
  "Continue with GitHub", an email field typing `chris.walker@example.com`. A
  doorway. Nothing in it can count against Clerk. The dimmed raster flanks
  (user profile, sign-in, waitlist, organization list, at opacity 0.6) are
  product captures with no adverse entry either.
- Hero, `Enterprise Authentication` tab, default `Enterprise SSO` sub-tab
  (y≈568-1032): "Select your identity provider", Okta Workforce / Microsoft
  Entra / Google Workspace / Custom SAML Provider, "Step 1 of 3". A setup flow
  with no outcome yet.
- **Hero, `Enterprise Authentication` tab, `Directory Sync` sub-tab (sub-tab
  label y=1143; table y≈577-937).** A client-rendered HTML rebuild of Clerk's
  own "Directory Sync (SCIM)" dashboard: product chrome, readable, not
  placeholder. A dimmed raster copy
  (`organization-profile-directory-sync_2x.1b19_bjqbkhd3.webp`) also sits in
  the Agent tab's flank, off-canvas at x=1652. Four rows:
  `Okta - HospitalA` / `HospitalA` / `Active` / `1 hr 30 min ago`;
  `Okta - HospitalB` / `HospitalB` / `Error` / `1 hr 30 min ago`;
  `Okta - HospitalC` / `HospitalC` / `Setup required` / `–`;
  `Acme Corp` / `JumpCloud` / `Disabled` / `3 days ago`.
- Hero, `Agent Authentication` tab (y≈582-1100): an OAuth consent, "Cursor
  would like to access your Acme account", with "Deny" / "Allow". It then
  plays "Access granted" and "Cursor can now act for you in Acme, limited to
  the permissions you approved." Hidden state also carries `scope:
  projects:read` and `expires in 60 min`. Scoped, expiring access is a limit
  the page sells, so it does not count.
- Hero, `Multi-tenancy` tab: Organizations / Members & Invitations / Roles &
  Permissions. The Roles panel carries `2 / 10 used`, a quota counter. It
  narrows no claim on the page. Not relied on.
- Dark bento, Fraud and Abuse Prevention card (y≈2215-2514): "Fraudulent
  sign-ups detected", then `bad_actor+1@example.com` / `Blocked Aug 4 at
  14:09` and three more blocked rows. Every row is the product winning.
  Session Management (y≈2075-2185: "MacBook Pro", "Chrome", "San Francisco,
  CA", "Sign out of device"), the OTP phone ("Security alert", "Your security
  passcode is 764676") and API Keys ("Authenticating...") are features
  shown working. Nothing adverse.
- Acme `<PricingTable />` and Checkout drawer (y≈4308-4832, page canvas
  framing a live product component): `$9` / `$19`, "Total Due Today" `USD`
  `$14.00`, "Payment was successful!", "Your new subscription is all set."
  Every value is the flattering one, and the prices are Acme's, not Clerk's.
- Not artefacts: the body copy "Free for your first 50,000 monthly retained
  users and 100 monthly retained orgs." (y=6184), which is pricing copy, not a
  refusal. The tweet masonry (y≈5826-6400) is reader content. WebDevCody's
  "btw, you don't need to remind me that Laravel has all of this out of the
  box" is a concession inside a testimonial, not in a deliverable.

The entry that could have embarrassed the vendor is `Error` on the
`Okta - HospitalB` row (status badge at y=800, x=758, red), last sync
`1 hr 30 min ago`, in the Directory Sync (SCIM) table. It sits next to
`Setup required` (HospitalC, never synced, `–`) and `Disabled` (Acme Corp /
JumpCloud, `3 days ago`).

Verdict: **present**, flipped from absent. This is the inverse of the cohort's
fail cases: browserbase-com's ledger has `Done` and `Uploading` but no
`Failed`, and modal-com's dashboard has no error row. Clerk's sync ledger
could have shown four `Active` rows, and instead one of its own SCIM syncs is
failing on the page. The data is seeded (fictional hospitals), and it is
scored on what it says. A demo that shows the product erring passes. It is
not a limit the page sells: no copy anywhere sells sync-error reporting. The
weakest point is attribution, since the error plausibly sits on the
customer's Okta side. But railway-com's scanner probe is not Railway's fault
either, and the test is whether the content could count against the vendor.
A failing sync in Clerk's directory-sync product does. The artefact is two
clicks deep (tab, then sub-tab), which is why the original study and the
walker missed it. Per stripe-2014, content on the studied page behind a
non-default slide counts, so this flip corrects a capture miss and is not a
reinterpretation.

Studied-page check: **unchanged.** The Wayback CDX has captures on
2026-10-08 (19:07:34Z) and 2026-10-10 (03:59:15Z, the nearest before
`studied`). The server-rendered visible text of the 2026-10-10 capture and
the live page is 337 lines each with 0 differing lines. The directory-sync
rows are client-rendered, so they were checked in the archived JS: chunk
`1khdk5va03oce.js` at 2026-10-10T03:59:15Z carries the identical four-row
array (`name:"Okta - HospitalB" ... status:"error",lastSync:"1 hr 30 min
ago"`) and the label map `error:"Error"`. The live chunk `2bskjdt6p8rzz.js`
matches. The raster asset hash is identical across both captures and live.
Only rotation differs: the logo strip and the left pull-quote. The prose
names Paul Copplestone and this capture shows Patrick Collison; both quotes
are in all three HTML files. The "Clerk raises $50m Series C" banner, not
mentioned above, is already in the 2026-10-08 capture.
