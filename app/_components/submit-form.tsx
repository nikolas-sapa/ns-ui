"use client";

// The `/submit` form itself. Posts to `/api/submit` (browser -> our origin
// -> the GitHub API, mirroring §6.1's browser -> `/api/*` -> Convex shape
// for the parts of this flow that DO touch Convex — the rate-limit/audit
// row only, never the code). Client-side checks below are a UX nicety;
// `lib/submission-validation.ts` run inside the route handler is the real
// enforcement (§6.3's "never trust a single enforcement point" applies here
// even though the enforcement point is a route handler, not a Convex
// function — the route is still reachable by anyone with a session cookie
// and a crafted body, not just by this form).
//
// No version field anywhere in this form
// (docs/decisions/2026-08-03-component-versioning.md) — a contributor
// bumps nothing.
import { useEffect, useState } from "react";

const INPUT =
  "w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-ns-muted focus-visible:ring-2 focus-visible:ring-ns-accent disabled:opacity-60";
const LABEL = "text-xs text-ns-muted";
const CODE_INPUT = `${INPUT} font-mono text-xs whitespace-pre`;

const ERROR_MESSAGES: Record<string, string> = {
  invalid_slug: "Slug must be lowercase letters, digits and single hyphens (2-60 characters).",
  invalid_collection: "Choose core or loud.",
  empty_title: "Title is required.",
  title_too_long: "Title is too long.",
  empty_description: "Description is required.",
  description_too_long: "Description is too long (400 characters max).",
  empty_tags: "Add at least one tag.",
  too_many_tags: "Too many tags (12 max).",
  tag_too_long: "One of the tags is too long.",
  too_many_dependencies: "Too many dependencies listed.",
  dependency_too_long: "One of the dependencies is too long.",
  empty_instruction: "Describe the behavior for the instruction field.",
  instruction_too_long: "Instruction is too long (4000 characters max).",
  empty_component_source: "component.tsx can't be empty.",
  empty_demo_source: "demo.tsx can't be empty.",
  forbidden_new_function: "component/demo source can't call new Function(...).",
  forbidden_eval: "component/demo source can't call eval(...).",
  forbidden_dangerous_html: "component/demo source can't use dangerouslySetInnerHTML.",
  forbidden_dynamic_import: "component/demo source can't use a dynamic import(...).",
  forbidden_webpack_magic_comment: "component/demo source can't contain a webpack magic comment.",
  forbidden_path_traversal: "Slug or source contains a disallowed path sequence.",
  forbidden_null_byte: "Source contains a disallowed character.",
  payload_too_large: "Submission is over the 256KB size limit.",
  empty_dco_name: "Your name is required for the DCO sign-off.",
  dco_name_too_long: "Name is too long.",
  dco_name_invalid_chars: "Name can't contain <, > or @.",
  invalid_dco_email: "A valid email is required for the DCO sign-off.",
  dco_email_too_long: "Email is too long.",
  dco_email_invalid_chars: "Email can't contain < or >.",
  dco_not_agreed: "You must certify the DCO to submit.",
  verify_not_attested: "Confirm you ran npm run verify locally.",
  slug_already_exists: "That slug is already in the registry. Pick a new, descriptive name.",
  rate_limited: "You can only open one submission every 10 minutes. Try again shortly.",
  github_not_connected: "Connect GitHub before submitting.",
  github_not_configured: "The submission portal isn't fully configured on this deployment yet.",
  unauthenticated: "Your session expired. Sign in again.",
  origin_not_allowed: "Request blocked. Reload and try again.",
  invalid_body: "Something in the form didn't parse. Check every field and try again.",
};

function errorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? "Could not submit. Check the form and try again.";
}

export function SubmitForm() {
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null);

  const [slug, setSlug] = useState("");
  const [collection, setCollection] = useState<"core" | "loud">("core");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [dependenciesText, setDependenciesText] = useState("");
  const [instruction, setInstruction] = useState("");
  const [componentSource, setComponentSource] = useState("");
  const [demoSource, setDemoSource] = useState("");
  const [dcoName, setDcoName] = useState("");
  const [dcoEmail, setDcoEmail] = useState("");
  const [dcoAgreed, setDcoAgreed] = useState(false);
  const [verifyAttested, setVerifyAttested] = useState(false);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [prUrl, setPrUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/submit")
      .then((res) => res.json())
      .then((data: { githubConnected?: boolean }) => {
        if (!cancelled) setGithubConnected(data.githubConnected ?? false);
      })
      .catch(() => {
        if (!cancelled) setGithubConnected(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setPrUrl(null);
    setPending(true);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          collection,
          title,
          description,
          tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
          dependencies: dependenciesText.split(",").map((d) => d.trim()).filter(Boolean),
          instruction,
          componentSource,
          demoSource,
          dcoName,
          dcoEmail,
          dcoAgreed,
          verifyAttested,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; prUrl?: string };
      if (!res.ok) {
        if (data.error === "github_not_connected") setGithubConnected(false);
        setError(errorMessage(data.error ?? "unknown"));
        setPending(false);
        return;
      }
      setPrUrl(data.prUrl ?? null);
      setPending(false);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setPending(false);
    }
  };

  if (prUrl) {
    return (
      <div className="mt-8 rounded-sm border border-border bg-surface p-4">
        <p className="text-sm text-foreground">Pull request opened.</p>
        <a
          href={prUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-sm text-ns-accent underline decoration-border underline-offset-2 focus-visible:ring-2 focus-visible:ring-ns-accent"
        >
          {prUrl}
        </a>
        <p className="mt-2 text-xs text-ns-muted">
          Attach your local <code className="font-mono">npm run verify</code> screenshots to the PR. CI runs there, not on this site.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      {githubConnected === false ? (
        <div className="rounded-sm border border-border bg-surface p-3">
          <p className="text-sm text-foreground">Connect GitHub to open pull requests</p>
          <p className="mt-1 text-xs text-ns-muted">
            A separate, narrower consent from sign-in: grants only permission to fork this repo
            and open a PR (<code className="font-mono">public_repo</code> scope), nothing broader.
          </p>
          <a
            href="/api/submit/github/authorize"
            className="mt-2 inline-block rounded-sm border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground outline-none transition-colors hover:border-ns-muted focus-visible:ring-2 focus-visible:ring-ns-accent"
          >
            Connect GitHub
          </a>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="submit-slug" className={LABEL}>
            Slug
          </label>
          <input
            id="submit-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="dropdown-drape-2"
            maxLength={60}
            required
            disabled={pending}
            className={INPUT}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="submit-collection" className={LABEL}>
            Collection
          </label>
          <select
            id="submit-collection"
            value={collection}
            onChange={(e) => setCollection(e.target.value as "core" | "loud")}
            disabled={pending}
            className={INPUT}
          >
            <option value="core">core (restrained)</option>
            <option value="loud">loud (showcase)</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="submit-title" className={LABEL}>
          Title
        </label>
        <input
          id="submit-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          required
          disabled={pending}
          className={INPUT}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="submit-description" className={LABEL}>
          Description
        </label>
        <textarea
          id="submit-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={400}
          rows={2}
          required
          disabled={pending}
          className={INPUT}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="submit-tags" className={LABEL}>
            Tags (comma-separated)
          </label>
          <input
            id="submit-tags"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="hero, cursor, canvas"
            disabled={pending}
            className={INPUT}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="submit-dependencies" className={LABEL}>
            Dependencies (comma-separated, usually empty)
          </label>
          <input
            id="submit-dependencies"
            value={dependenciesText}
            onChange={(e) => setDependenciesText(e.target.value)}
            disabled={pending}
            className={INPUT}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="submit-instruction" className={LABEL}>
          Instruction (a rich paragraph describing the behavior)
        </label>
        <textarea
          id="submit-instruction"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          maxLength={4000}
          rows={5}
          required
          disabled={pending}
          className={INPUT}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="submit-component-source" className={LABEL}>
          component.tsx
        </label>
        <textarea
          id="submit-component-source"
          value={componentSource}
          onChange={(e) => setComponentSource(e.target.value)}
          rows={12}
          required
          disabled={pending}
          spellCheck={false}
          className={CODE_INPUT}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="submit-demo-source" className={LABEL}>
          demo.tsx
        </label>
        <textarea
          id="submit-demo-source"
          value={demoSource}
          onChange={(e) => setDemoSource(e.target.value)}
          rows={8}
          required
          disabled={pending}
          spellCheck={false}
          className={CODE_INPUT}
        />
      </div>

      <div className="rounded-sm border border-border bg-surface p-3">
        <p className="text-xs text-ns-muted">
          Every commit needs a{" "}
          <a
            href="https://github.com/nikolas-sapa/ns-ui/blob/main/DCO"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-border underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent transition-colors"
          >
            Developer Certificate of Origin
          </a>{" "}
          sign-off. This is written into the commit as a{" "}
          <code className="font-mono">Signed-off-by</code> trailer. The checkbox alone is a
          reminder, not the enforcement (CI checks the commit itself).
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="submit-dco-name" className={LABEL}>
              Name
            </label>
            <input
              id="submit-dco-name"
              value={dcoName}
              onChange={(e) => setDcoName(e.target.value)}
              required
              disabled={pending}
              className={INPUT}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="submit-dco-email" className={LABEL}>
              Email
            </label>
            <input
              id="submit-dco-email"
              type="email"
              value={dcoEmail}
              onChange={(e) => setDcoEmail(e.target.value)}
              required
              disabled={pending}
              className={INPUT}
            />
          </div>
        </div>
        <label className="mt-3 flex items-start gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={dcoAgreed}
            onChange={(e) => setDcoAgreed(e.target.checked)}
            disabled={pending}
            className="mt-0.5 size-4 shrink-0 rounded-sm border-border text-ns-accent outline-none focus-visible:ring-2 focus-visible:ring-ns-accent"
          />
          <span>
            I certify the DCO for this contribution and agree it is licensed under the MIT License.
          </span>
        </label>
      </div>

      <label className="flex items-start gap-2 text-xs text-foreground">
        <input
          type="checkbox"
          checked={verifyAttested}
          onChange={(e) => setVerifyAttested(e.target.checked)}
          disabled={pending}
          className="mt-0.5 size-4 shrink-0 rounded-sm border-border text-ns-accent outline-none focus-visible:ring-2 focus-visible:ring-ns-accent"
        />
        {/* The copy has to be ONE element. The label is `flex`, so every child
            is a flex item — and this sentence used to be three of them (text,
            <code>, text). Flex laid them out as three columns, so the label
            rendered as "I" / "npm run" / "locally for this component…" stacked
            beside each other instead of as a sentence. The DCO checkbox above
            escaped it only by having a single text node. */}
        <span>
          I ran <code className="font-mono">npm run verify</code> locally for this component and it
          passed. I&apos;ll attach the screenshots it produced to the PR myself.
        </span>
      </label>

      <button
        type="submit"
        disabled={pending || githubConnected !== true}
        className="rounded-sm border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground outline-none transition-colors hover:border-ns-muted focus-visible:ring-2 focus-visible:ring-ns-accent disabled:pointer-events-none disabled:opacity-60"
      >
        {pending ? "Opening pull request…" : "Open pull request"}
      </button>

      <p aria-live="polite" className="text-xs">
        {error ? <span className="text-[var(--error)]">{error}</span> : null}
      </p>
    </form>
  );
}
