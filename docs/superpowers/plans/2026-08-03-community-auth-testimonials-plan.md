# Community testimonials and save-focused auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework signed-out auth around saving, add an anonymous save hover hint, and ship a moderated `/community` testimonial submission flow with rounded site typography.

**Architecture:** Keep the existing server-side auth boundary and registry behavior. Extract shared testimonial presentation/data shapes, store submissions in Convex with `pending|approved|rejected` moderation state and spam metadata, and expose only approved testimonials publicly. Keep the ASCII terrain as a standalone visual panel with its own ambient animation loop.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS v4, Convex, existing `@convex-dev/auth`, Playwright verification, existing CSS token system.

## Global Constraints

- Desktop auth layout: left form/copy, right ASCII-only visual.
- The ASCII terrain continues idle drift and star motion without pointer input; pointer adds parallax; reduced motion is static.
- Anonymous Save hover and keyboard focus reveal `Sign in to save.` beside the button; clicking routes to `/account`.
- Authenticated save behavior remains unchanged.
- Replace the global sans face with a rounded readable sans; keep monospace for technical labels, metadata, and commands.
- Testimonial submissions require authentication, are never published immediately, and expose only approved records.
- Auto-flag excessive URLs, repeated tokens, phone/email solicitation, crypto/SEO phrases, promotional calls to action, and bot markers.
- Use existing semantic color tokens. No hardcoded component colors, no orange, no emoji.
- Preserve light/dark themes, visible focus, mobile layout, and reduced-motion behavior.
- Do not change registry component APIs or install behavior.

---

### Task 1: Define testimonial data and moderation rules

**Files:**
- Create: `lib/testimonials.ts`
- Create: `lib/testimonial-moderation.ts`
- Test: `scripts/test-testimonial-moderation.ts`

**Interfaces:**
- `TestimonialStatus = "pending" | "approved" | "rejected"`
- `Testimonial` contains `id`, `quote`, `name`, `role`, `company`, `profileUrl`, `photoUrl`, and `status`.
- `scoreSubmission(input): { score: number; flags: string[] }`
- `validateSubmission(input): { ok: true; value: NormalizedSubmission } | { ok: false; code: string }`

- [ ] **Step 1: Write moderation test cases**

  Cover clean copy, more than two URLs, repeated tokens, phone/email solicitation, crypto/SEO promotion, bot markers, quote length limits, unsupported URL protocols, and whitespace normalization. Assert exact flags and that a clean submission scores zero.

- [ ] **Step 2: Run the moderation tests and confirm failure**

  Run: `node scripts/test-testimonial-moderation.ts`

  Expected: FAIL because the moderation module does not exist yet.

- [ ] **Step 3: Implement normalized testimonial types and rules**

  Normalize all text with trim plus collapsed whitespace. Reject empty names, roles, quotes, invalid URLs, quotes over 800 characters, names over 80 characters, and URLs over 240 characters. Use deterministic rule identifiers such as `too_many_urls`, `repeated_tokens`, `contact_solicitation`, `crypto_promotion`, `seo_promotion`, `promotional_cta`, and `bot_marker`. Clamp the final score to 0–100.

- [ ] **Step 4: Run moderation tests**

  Run: `node scripts/test-testimonial-moderation.ts`

  Expected: PASS for all cases, including zero score for the clean Alex fixture.

- [ ] **Step 5: Commit the isolated moderation unit**

  ```bash
  git add lib/testimonials.ts lib/testimonial-moderation.ts scripts/test-testimonial-moderation.ts
  git commit -m "feat: add testimonial moderation rules"
  ```

### Task 2: Add Convex testimonial storage and secure public reads

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/testimonials.ts`
- Modify: `convex/_generated/` through the repository's Convex codegen command

**Interfaces:**
- Table `testimonials`: `userId`, `name`, `role`, `company`, `profileUrl`, `photoUrl`, `quote`, `status`, `spamScore`, `spamFlags`, `createdAt`, `reviewedAt`.
- `testimonials.approved` query: public, returns only approved records.
- `testimonials.submit` mutation: authenticated, validates and stores `pending`.

- [ ] **Step 1: Add schema table and indexes**

  Add indexes for `status` and `userId`; keep spam score and flags server-only by excluding them from the public query return shape.

- [ ] **Step 2: Implement the authenticated submit mutation**

  Derive `userId` with `getAuthUserId(ctx)`, call the shared validator, score the normalized input, enforce one pending submission per user in a 24-hour window, and insert `status: "pending"` with moderation metadata. Reject failed validation with stable `ConvexError` codes.

- [ ] **Step 3: Implement the approved-only query**

  Query the status index for `approved`, sort newest first, and return only display fields. Never return pending or rejected rows.

- [ ] **Step 4: Generate Convex types and typecheck the backend**

  Run `npx convex dev --once` to regenerate `convex/_generated`, then `npm run typecheck`.

- [ ] **Step 5: Commit the storage unit**

  ```bash
  git add convex/schema.ts convex/testimonials.ts convex/_generated
  git commit -m "feat: store moderated testimonials"
  ```

### Task 3: Make ASCII terrain background-only and ambient

**Files:**
- Modify: `registry/loud/hero-ascii-terrain/component.tsx`
- Modify: `app/_components/account-signed-out.tsx`
- Test: focused Playwright check for `/account`

**Interfaces:**
- `ScarpHorizon` continues to accept `children` for its registry demo, but the auth surface passes no children.

- [ ] **Step 1: Add a focused visual assertion**

  On `/account`, assert the right visual panel contains a canvas and zero text nodes, while the left panel contains `Sign in to save.` and Alex's attribution.

- [ ] **Step 2: Confirm the existing idle loop path**

  Verify the rAF loop runs with `draw(t, cursor.x, cursor.y, t * IDLE_DRIFT)` at rest. If it is already active, preserve it and only remove auth copy from the visual panel. If it is not active in the deployed auth composition, start the loop after `document.fonts.ready` without pointer input.

- [ ] **Step 3: Render the auth visual with no children**

  Keep terrain-specific text only in the registry demo if needed. The auth page renders `<ScarpHorizon className="..." />` with no overlay content.

- [ ] **Step 4: Run the focused check in both themes and reduced motion**

  Assert canvas presence, no visual-panel text, changing canvas pixels at rest under normal motion, and stable static output under reduced motion.

- [ ] **Step 5: Commit the visual unit**

  ```bash
  git add registry/loud/hero-ascii-terrain/component.tsx app/_components/account-signed-out.tsx
  git commit -m "feat: simplify ambient auth terrain"
  ```

### Task 4: Apply rounded global typography and rebuild auth layout

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `app/_components/account-signed-out.tsx`
- Create or reuse: `lib/testimonials.ts` display fixture

**Interfaces:**
- Global body uses the selected rounded sans variable; `font-mono` remains unchanged.
- `AccountSignedOut` consumes the shared Alex testimonial shape and renders left form/copy, right ASCII-only visual.

- [ ] **Step 1: Add a typography smoke assertion**

  In a browser check, assert body computed `font-family` includes the selected rounded family and a monospace utility still resolves to the Geist mono family.

- [ ] **Step 2: Wire the rounded sans globally**

  Update `--font-sans` and the body stack to `ui-rounded, "Avenir Next Rounded", "Arial Rounded MT Bold", "Nunito Sans", sans-serif`. Keep `--font-mono` untouched. Do not add a runtime font dependency or remove the existing Geist font preload until the rounded fallback stack is confirmed in the production browser check.

- [ ] **Step 3: Recompose signed-out account**

  Put the sign-in heading, description, auth form, Alex testimonial, LinkedIn URL, and Spawn Partners URL in the left column. Put only the `<ScarpHorizon />` canvas in the right column. Stack left first on mobile.

- [ ] **Step 4: Verify auth behavior**

  Confirm GitHub, Google, email-code request, and email-code verification controls remain the same components and retain `/account` redirects.

- [ ] **Step 5: Commit the auth unit**

  ```bash
  git add app/layout.tsx app/globals.css app/_components/account-signed-out.tsx lib/testimonials.ts
  git commit -m "feat: refresh auth typography and layout"
  ```

### Task 5: Add anonymous Save hover popover

**Files:**
- Create: `app/_components/sign-in-save-popover.tsx`
- Modify: `app/_components/save-button.tsx`
- Test: focused Playwright save-button interaction check

**Interfaces:**
- `SignInSavePopover` accepts `open: boolean` and renders an anchored `/account` link.
- `SaveButton` keeps its existing props and click behavior.

- [ ] **Step 1: Add interaction assertions**

  For `authenticated === false`, assert hover reveals the popover, keyboard focus reveals it, clicking the link reaches `/account`, and authenticated/signed-out pending states do not show it unexpectedly.

- [ ] **Step 2: Implement hover/focus state**

  Track pointer hover and focus-visible state locally. Render the popover adjacent to the button with absolute positioning, `aria-describedby`, a visible focus style, and no focus trap. Use `pointerenter`/`pointerleave` and `focus`/`blur`; add a short close delay so the pointer can cross into the popover without flicker.

- [ ] **Step 3: Preserve anonymous click behavior**

  Keep the current `router.push("/account")` path when the bookmark button itself is clicked.

- [ ] **Step 4: Run the interaction check**

  Run the focused Playwright check at desktop and mobile widths; verify the popover does not change card layout.

- [ ] **Step 5: Commit the popover unit**

  ```bash
  git add app/_components/sign-in-save-popover.tsx app/_components/save-button.tsx
  git commit -m "feat: explain anonymous saves"
  ```

### Task 6: Build public community page and authenticated submission form

**Files:**
- Create: `app/community/page.tsx`
- Create: `app/_components/community-testimonials.tsx`
- Create: `app/_components/testimonial-form.tsx`
- Modify: `lib/nav-data.ts` or the project navigation source used by `SiteShell`
- Modify: `app/_components/site-shell.tsx` only if navigation registration requires it

**Interfaces:**
- Public page reads `api.testimonials.approved` and renders only approved records.
- `TestimonialForm` submits `{ name, role, company, profileUrl, photoUrl, quote }` through the Convex mutation and shows pending/success/error states.

- [ ] **Step 1: Add page-level rendering assertions**

  Assert `/community` renders the page heading, approved Alex testimonial, contribution links, and form for authenticated users; anonymous users see the page and a link to sign in before submission.

- [ ] **Step 2: Build the public testimonial list**

  Render the approved query results with plain text quote content, safe external links, optional optimized images, and an empty state that explains how to submit the first experience.

- [ ] **Step 3: Build the authenticated form**

  Use labeled inputs, quote length feedback, URL validation, `aria-live` status, disabled pending state, and a success message that says the submission is awaiting review.

- [ ] **Step 4: Add navigation entry**

  Add `Community` to the existing site navigation without changing preview routes or registry navigation.

- [ ] **Step 5: Run page and form checks**

  Verify anonymous access, authenticated submission, pending invisibility, approved visibility, invalid URL rejection, spam flagging, and rate-limit response.

- [ ] **Step 6: Commit the community unit**

  ```bash
  git add app/community app/_components/community-testimonials.tsx app/_components/testimonial-form.tsx lib/nav-data.ts app/_components/site-shell.tsx
  git commit -m "feat: add moderated community testimonials"
  ```

### Task 7: Full verification and production handoff

**Files:**
- Modify: only files required by failing checks.

- [ ] **Step 1: Run unit and static checks**

  ```bash
  node scripts/test-testimonial-moderation.ts
  npm run typecheck
  git diff --check
  ```

- [ ] **Step 2: Run production build**

  Run: `npm run build`

  Expected: registry generation, typecheck, and Next production build complete successfully.

- [ ] **Step 3: Run focused browser verification**

  Check `/account`, `/community`, homepage Save hover/focus, both themes, mobile width, normal motion, and reduced motion. Confirm no console errors and inspect screenshots.

- [ ] **Step 4: Run the existing registry gate**

  Run the production-server-backed `npm run verify` workflow without changing generated files by hand.

- [ ] **Step 5: Review staged diff and commit any verification fixes**

  ```bash
  git status --short
  git diff --check
  git log -5 --oneline
  ```

- [ ] **Step 6: Push and verify live production**

  Push through the protected-branch PR flow, wait for GitHub/Vercel checks, merge to `main`, then verify `/account`, `/community`, homepage save popover, and a representative component URL on the live origin.
