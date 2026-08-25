"use client";

/**
 * /review — a local-only console for eyeballing this round's work without
 * scrolling the full catalog. Disposable tooling: not in the site nav, does
 * not touch any component or meta.json, reads nothing the catalog reads.
 *
 * Four static groups (see ./data.ts): components just fixed (verify the fix
 * landed), the rest of the first batch nobody has looked at yet, a third
 * batch across three more lanes (multiplayer, reliability, wayfinding), and
 * round 8a's 34 components (flat, no lane). The round a row belongs to
 * (`ReviewItem.round`) is a separate, additive axis from group — the round
 * filter bar only appears once more than one round exists in the data, so
 * adding a round is a data.ts edit, not a page edit. Client-side filter over
 * a static list, no data fetching.
 *
 * "Tested" and a free-text note per row persist to a file on disk via
 * `/api/review-state` (app/api/review-state/route.ts), not localStorage —
 * that route is dev-only (404s in production off-localhost) and writes
 * `.review-state.json` at the repo root, so state survives reloads and is
 * readable outside the browser. Old localStorage "Tested" flags under
 * `ns-review-r7:<slug>` are migrated into the file once on first load, then
 * left alone (never written again) — see `migrateLegacyLocalStorage`.
 *
 * Card previews reuse the catalog's own iframe + mount-cap machinery
 * (`LivePreviewFrame` / `useMountManager`) rather than a second
 * implementation — that machinery is what already answers "won't 36 iframes
 * tank the page": only a bounded, viewport-nearest set is ever mounted.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LivePreviewFrame } from "@/app/_components/live-preview-frame";
import { useMountManager } from "@/app/_components/use-mount-manager";
import { LANE_LABEL, REVIEW_ITEMS, type Lane, type ReviewItem } from "./data";

const LEGACY_STORAGE_PREFIX = "ns-review-r7:";
const MIGRATION_FLAG = "ns-review-r7:migrated-to-file";

const GROUP_LABEL: Record<ReviewItem["group"], string> = {
  fixed: "Re-test — fixed since you flagged it",
  untested: "Still untested from the first batch",
  expansion: "New — three more lanes",
  r8a: "Round 8a — 34 new components",
};

const FIXED_COUNT = REVIEW_ITEMS.filter((i) => i.group === "fixed").length;
const UNTESTED_COUNT = REVIEW_ITEMS.filter((i) => i.group === "untested").length;
const EXPANSION_COUNT = REVIEW_ITEMS.filter((i) => i.group === "expansion").length;
const R8A_COUNT = REVIEW_ITEMS.filter((i) => i.group === "r8a").length;

/** Every round value present in the data, in first-seen order — deriving
 *  this from REVIEW_ITEMS itself (rather than hardcoding a list) is what
 *  makes the round filter "generic over round": a new round is a data edit
 *  in data.ts, never a page edit here. Replaces the old COPY_ROUND_LABEL
 *  manual date string, which could silently go stale. */
const ROUNDS: string[] = Array.from(new Set(REVIEW_ITEMS.map((i) => i.round ?? "r7")));
const ROUND_COUNTS: Record<string, number> = ROUNDS.reduce(
  (acc, r) => ({ ...acc, [r]: REVIEW_ITEMS.filter((i) => (i.round ?? "r7") === r).length }),
  {} as Record<string, number>,
);

const GROUPS: ReviewItem["group"][] = ["fixed", "untested", "expansion", "r8a"];
const LANES: Lane[] = ["identity", "money", "living", "multiplayer", "reliability", "wayfinding"];
const UNTESTED_LANES: Lane[] = ["identity", "money", "living"];
const EXPANSION_LANES: Lane[] = ["multiplayer", "reliability", "wayfinding"];

/** Cards near the viewport get a live iframe; the rest render as a plain
 *  row. Small relative to the catalog's own 12 — this page is a third of
 *  the size and doesn't need the headroom. */
const MOUNT_CAP = 8;
const PRELOAD_MARGIN = 400;

type Verdict = "working" | "flagged";
type RowState = { tested: boolean; note: string; verdict?: Verdict; updatedAt: string };
type StateFile = Record<string, RowState>;

/** The three buckets the filter bar and counts operate on. A note always
 *  reads as "flagged" regardless of the stored verdict — the note is where
 *  something-is-wrong lives, so its presence outranks a stale "working"
 *  click the owner hasn't revisited yet. A bare `tested: true` with no
 *  `verdict` (written by the legacy localStorage migration, or by any old
 *  client) reads as "working" rather than vanishing from the counts. */
function effectiveStatus(row: RowState | undefined): "working" | "flagged" | "untouched" {
  const note = row?.note?.trim() ?? "";
  if (note.length > 0) return "flagged";
  const verdict = row?.verdict ?? (row?.tested ? "working" : undefined);
  if (verdict === "working") return "working";
  if (verdict === "flagged") return "flagged";
  return "untouched";
}

const STATUS_LABEL: Record<"working" | "flagged" | "untouched", string> = {
  working: "Working",
  flagged: "Flagged",
  untouched: "Untouched",
};
const STATUSES: ("working" | "flagged" | "untouched")[] = ["working", "flagged", "untouched"];

/** Reads whatever the old localStorage scheme left behind, once. Never
 *  written to again after this — the file is the single source of truth
 *  going forward. */
function readLegacyLocalStorage(): Record<string, boolean> | null {
  if (typeof window === "undefined") return null;
  try {
    if (window.localStorage.getItem(MIGRATION_FLAG) === "1") return null;
    const found: Record<string, boolean> = {};
    let any = false;
    for (const item of REVIEW_ITEMS) {
      if (window.localStorage.getItem(LEGACY_STORAGE_PREFIX + item.slug) === "1") {
        found[item.slug] = true;
        any = true;
      }
    }
    return any ? found : {};
  } catch {
    return null;
  }
}

function markLegacyMigrated() {
  try {
    window.localStorage.setItem(MIGRATION_FLAG, "1");
    for (const item of REVIEW_ITEMS) {
      window.localStorage.removeItem(LEGACY_STORAGE_PREFIX + item.slug);
    }
  } catch {
    /* storage unavailable — harmless, just means we re-check next load */
  }
}

export default function ReviewPage() {
  const [query, setQuery] = useState("");
  const [groupsOn, setGroupsOn] = useState<Record<ReviewItem["group"], boolean>>({
    fixed: true,
    untested: true,
    expansion: true,
    r8a: true,
  });
  const [roundsOn, setRoundsOn] = useState<Record<string, boolean>>(
    () => Object.fromEntries(ROUNDS.map((r) => [r, true])),
  );
  const [lanesOn, setLanesOn] = useState<Record<Lane, boolean>>({
    identity: true,
    money: true,
    living: true,
    multiplayer: true,
    reliability: true,
    wayfinding: true,
  });
  // Working rows are hidden from the list by default — a verdict already
  // recorded shouldn't keep taking up screen space. The "Working" filter
  // button doubles as the way back in (requirement 2): flip it on and the
  // judged rows return, collapsed, ready to be re-judged.
  const [statusOn, setStatusOn] = useState<Record<"working" | "flagged" | "untouched", boolean>>({
    working: false,
    flagged: true,
    untouched: true,
  });
  // Server render always starts empty (no file read on the server, and the
  // route is dev-only anyway); real values load in an effect after mount,
  // so hydration never has to reconcile a mismatch — it just re-renders
  // once, checkboxes and notes filling in a beat later.
  const [state, setState] = useState<StateFile>({});
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState<Record<string, "saving" | "saved" | "error">>({});
  const saveStatusTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const flashSaved = useCallback((slug: string, status: "saved" | "error") => {
    setSaveStatus((prev) => ({ ...prev, [slug]: status }));
    clearTimeout(saveStatusTimers.current[slug]);
    saveStatusTimers.current[slug] = setTimeout(() => {
      setSaveStatus((prev) => {
        const next = { ...prev };
        delete next[slug];
        return next;
      });
    }, 1600);
  }, []);

  const persistRow = useCallback(
    async (slug: string, patch: { tested?: boolean; note?: string; verdict?: Verdict | "unset" }) => {
      setSaveStatus((prev) => ({ ...prev, [slug]: "saving" }));
      clearTimeout(saveStatusTimers.current[slug]);
      try {
        const res = await fetch("/api/review-state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, ...patch }),
        });
        if (!res.ok) throw new Error(`review-state PUT ${res.status}`);
        flashSaved(slug, "saved");
      } catch (err) {
        console.error("review: failed to save row", slug, err);
        flashSaved(slug, "error");
      }
    },
    [flashSaved],
  );

  // Load from the file, migrating any legacy localStorage "Tested" flags in
  // first (once) so nothing the owner already checked off gets lost.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const legacy = readLegacyLocalStorage();
      let loaded: StateFile = {};
      try {
        const res = await fetch("/api/review-state");
        if (res.ok) loaded = (await res.json()) as StateFile;
      } catch (err) {
        console.error("review: failed to load state file", err);
      }

      if (legacy && Object.keys(legacy).length > 0) {
        for (const [slug, wasTested] of Object.entries(legacy)) {
          if (wasTested && !loaded[slug]?.tested) {
            loaded = {
              ...loaded,
              [slug]: {
                tested: true,
                note: loaded[slug]?.note ?? "",
                updatedAt: new Date().toISOString(),
              },
            };
            void persistRow(slug, { tested: true });
          }
        }
        markLegacyMigrated();
      }

      if (!cancelled) {
        setState(loaded);
        setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally runs once on mount; persistRow is stable via useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The Working / Needs work pair IS the old "Tested" checkbox, folded into
  // a two-state verdict: clicking either sets tested implicitly (a verdict
  // means the row was judged) without a separate control saying the same
  // thing twice. Clicking the verdict that's already active toggles it back
  // off (untouched) rather than being a dead click.
  const setVerdict = useCallback(
    (slug: string, verdict: Verdict) => {
      setState((prev) => {
        const current = prev[slug]?.verdict ?? (prev[slug]?.tested ? "working" : undefined);
        const nextVerdict = current === verdict ? undefined : verdict;
        const next: StateFile = {
          ...prev,
          [slug]: {
            tested: !!nextVerdict,
            note: prev[slug]?.note ?? "",
            verdict: nextVerdict,
            updatedAt: new Date().toISOString(),
          },
        };
        void persistRow(slug, { tested: !!nextVerdict, verdict: nextVerdict ?? "unset" });
        return next;
      });
    },
    [persistRow],
  );

  const setNote = useCallback((slug: string, note: string) => {
    setState((prev) => ({
      ...prev,
      [slug]: {
        tested: prev[slug]?.tested ?? false,
        note,
        updatedAt: new Date().toISOString(),
      },
    }));
  }, []);

  const commitNote = useCallback(
    (slug: string, note: string) => {
      void persistRow(slug, { note });
    },
    [persistRow],
  );

  const { registerRef, isActive, isOnScreen } = useMountManager({
    mountCap: MOUNT_CAP,
    preloadMargin: PRELOAD_MARGIN,
  });

  const q = query.trim().toLowerCase();
  // Before the state file has loaded, every row would read "untouched" (the
  // default for an empty entry) — filtering on that would show all 59 rows
  // for a beat, mount extra iframes, then yank 51 of them the moment the
  // real verdicts arrive. Hold the list empty until hydrated instead.
  const filtered = useMemo(() => {
    if (!hydrated) return [];
    return REVIEW_ITEMS.filter((item) => {
      if (!groupsOn[item.group]) return false;
      if (!roundsOn[item.round ?? "r7"]) return false;
      if (item.lane && !lanesOn[item.lane]) return false;
      if (!statusOn[effectiveStatus(state[item.slug])]) return false;
      if (!q) return true;
      const haystack = [item.slug, item.change, item.watch, item.note, item.eyeball, state[item.slug]?.note]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [hydrated, q, groupsOn, roundsOn, lanesOn, statusOn, state]);

  const fixedItems = filtered.filter((i) => i.group === "fixed");
  const untestedItems = filtered.filter((i) => i.group === "untested");
  const expansionItems = filtered.filter((i) => i.group === "expansion");
  const r8aItems = filtered.filter((i) => i.group === "r8a");

  const remaining = (group: ReviewItem["group"]) => {
    const items = REVIEW_ITEMS.filter((i) => i.group === group);
    const untested = items.filter((i) => effectiveStatus(state[i.slug]) === "untouched").length;
    return { untested, total: items.length };
  };
  const fixedRemaining = remaining("fixed");
  const untestedRemaining = remaining("untested");
  const expansionRemaining = remaining("expansion");
  const r8aRemaining = remaining("r8a");
  const groupRemaining: Record<ReviewItem["group"], { untested: number; total: number }> = {
    fixed: fixedRemaining,
    untested: untestedRemaining,
    expansion: expansionRemaining,
    r8a: r8aRemaining,
  };

  // Jump index over the currently-filtered set, in list order — lets the
  // owner jump straight to a row without scrolling past everything the
  // filters already excluded.
  const jumpIndex = useMemo(
    () => filtered.map((item) => ({ slug: item.slug, group: item.group })),
    [filtered],
  );

  // Live counts for the working / flagged / untouched filter bar — computed
  // over the whole list (not `filtered`), same as the group counts above,
  // so the numbers on unpressed filter buttons still mean "how many total",
  // not "how many currently visible".
  const statusCounts = useMemo(() => {
    const counts = { working: 0, flagged: 0, untouched: 0 };
    for (const item of REVIEW_ITEMS) counts[effectiveStatus(state[item.slug])]++;
    return counts;
  }, [state]);

  // True only when the empty list is caused by working rows being hidden,
  // not by a search term or a group/lane/status filter narrowing things out
  // — those still fall through to the generic "no match" message.
  const allSettled =
    filtered.length === 0 &&
    q === "" &&
    GROUPS.every((g) => groupsOn[g]) &&
    ROUNDS.every((r) => roundsOn[r]) &&
    LANES.every((l) => lanesOn[l]) &&
    statusOn.flagged &&
    statusOn.untouched &&
    statusCounts.flagged + statusCounts.untouched === 0;

  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const copyStatusTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const copyAllNotes = useCallback(async () => {
    const flagged = REVIEW_ITEMS.filter((i) => effectiveStatus(state[i.slug]) === "flagged");
    const byGroup: Record<ReviewItem["group"], ReviewItem[]> = {
      fixed: [],
      untested: [],
      expansion: [],
      r8a: [],
    };
    for (const item of flagged) byGroup[item.group].push(item);

    const lines: string[] = [
      `Verdict summary: ${statusCounts.working} working, ${statusCounts.flagged} flagged, ${statusCounts.untouched} untouched.`,
      "",
    ];
    for (const g of GROUPS) {
      if (byGroup[g].length === 0) continue;
      lines.push(GROUP_LABEL[g]);
      for (const item of byGroup[g]) {
        const note = state[item.slug]?.note?.trim();
        lines.push(`- ${item.slug}: ${note || "(flagged, no note yet)"}`);
      }
      lines.push("");
    }
    const digest = lines.join("\n").trim();
    if (!digest) return;
    try {
      await navigator.clipboard.writeText(digest);
      setCopyStatus("copied");
    } catch (err) {
      console.error("review: clipboard write failed", err);
      setCopyStatus("error");
    }
    clearTimeout(copyStatusTimer.current);
    copyStatusTimer.current = setTimeout(() => setCopyStatus("idle"), 1600);
  }, [state, statusCounts]);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-32 sm:px-10">
      <header className="pt-20 sm:pt-28">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-ns-muted">
          ns-ui / review — local only
        </p>
        <h1 className="mt-5 text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl">
          Review console.
        </h1>
        <p className="mt-5 max-w-2xl text-[15px] leading-7 text-ns-muted">
          Disposable tooling, not a catalog page: {FIXED_COUNT} fixes to re-verify,{" "}
          {UNTESTED_COUNT} components from the first batch still untested, {EXPANSION_COUNT} across
          three more lanes, and {R8A_COUNT} from round 8a. Each row links to the full component page
          and to its card in isolation; a nearby handful also run live inline. &ldquo;Tested&rdquo; and
          notes persist to a local file (
          <code className="font-mono text-[13px]">.review-state.json</code>) via a dev-only API
          route — never the deployed site.
        </p>
        <p className="mt-3 font-mono text-xs text-ns-muted">
          {hydrated
            ? `${statusCounts.working} working, ${statusCounts.flagged} flagged, ${statusCounts.untouched} untouched of ${REVIEW_ITEMS.length}.`
            : "Loading saved verdicts…"}
        </p>
        <p className="mt-1 font-mono text-xs text-ns-muted">
          By round: {ROUNDS.map((r) => `${r} (${ROUND_COUNTS[r]})`).join(", ")}.
        </p>
      </header>

      {/* Controls */}
      <div className="sticky top-0 z-30 -mx-6 mt-10 border-b border-border bg-background/85 px-6 py-3 backdrop-blur sm:-mx-10 sm:px-10">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <label htmlFor="review-search" className="sr-only">
            Search slug or note
          </label>
          <input
            id="review-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search slug or note"
            autoComplete="off"
            spellCheck={false}
            className="min-h-11 w-full min-w-0 flex-1 rounded-sm border border-border bg-surface px-2.5 py-1 text-sm text-foreground outline-none transition-colors placeholder:text-ns-muted focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none sm:min-h-0 sm:w-56 sm:flex-none"
          />

          <div role="group" aria-label="Filter by group" className="flex items-center gap-1">
            {GROUPS.map((g) => {
              const selected = groupsOn[g];
              const r = groupRemaining[g];
              return (
                <button
                  key={g}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setGroupsOn((p) => ({ ...p, [g]: !p[g] }))}
                  className={`min-h-11 rounded-sm border px-2.5 py-1 text-sm transition-colors sm:min-h-0 ${
                    selected
                      ? "border-ns-accent bg-ns-accent/10 text-foreground"
                      : "border-transparent text-ns-muted hover:text-foreground"
                  }`}
                >
                  {GROUP_LABEL[g]}
                  <span className="ml-1.5 font-mono text-xs text-ns-muted">
                    {r.untested}/{r.total}
                  </span>
                </button>
              );
            })}
          </div>

          {ROUNDS.length > 1 ? (
            <div role="group" aria-label="Filter by round" className="flex items-center gap-1">
              {ROUNDS.map((r) => {
                const selected = roundsOn[r];
                return (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setRoundsOn((p) => ({ ...p, [r]: !p[r] }))}
                    className={`min-h-11 rounded-sm border px-2 py-1 font-mono text-xs uppercase tracking-wider transition-colors sm:min-h-0 ${
                      selected
                        ? "border-ns-accent bg-ns-accent/10 text-foreground"
                        : "border-transparent text-ns-muted hover:text-foreground"
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div role="group" aria-label="Filter by lane" className="flex flex-wrap items-center gap-1">
            {LANES.map((lane) => {
              const selected = lanesOn[lane];
              return (
                <button
                  key={lane}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setLanesOn((p) => ({ ...p, [lane]: !p[lane] }))}
                  className={`min-h-11 rounded-sm border px-2 py-1 text-xs transition-colors sm:min-h-0 ${
                    selected
                      ? "border-ns-accent bg-ns-accent/10 text-foreground"
                      : "border-transparent text-ns-muted hover:text-foreground"
                  }`}
                >
                  {LANE_LABEL[lane]}
                </button>
              );
            })}
          </div>

          <div role="group" aria-label="Filter by verdict" className="flex items-center gap-1">
            {STATUSES.map((s) => {
              const selected = statusOn[s];
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setStatusOn((p) => ({ ...p, [s]: !p[s] }))}
                  className={`min-h-11 rounded-sm border px-2.5 py-1 text-sm transition-colors sm:min-h-0 ${
                    selected
                      ? "border-ns-accent bg-ns-accent/10 text-foreground"
                      : "border-transparent text-ns-muted hover:text-foreground"
                  }`}
                >
                  {STATUS_LABEL[s]}
                  <span className="ml-1.5 font-mono text-xs text-ns-muted">{statusCounts[s]}</span>
                </button>
              );
            })}
          </div>

          {hydrated && statusCounts.working > 0 ? (
            <button
              type="button"
              aria-pressed={statusOn.working}
              onClick={() => setStatusOn((p) => ({ ...p, working: !p.working }))}
              className="min-h-11 shrink-0 rounded-sm border border-border px-2.5 py-1 text-sm text-foreground outline-none transition-colors hover:border-ns-accent focus-visible:ring-2 focus-visible:ring-ns-accent sm:min-h-0"
            >
              {statusOn.working
                ? "Hide working"
                : `Show ${statusCounts.working} working`}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => void copyAllNotes()}
            disabled={statusCounts.working === 0 && statusCounts.flagged === 0}
            className="ml-auto min-h-11 shrink-0 rounded-sm border border-border px-2.5 py-1 text-sm text-foreground outline-none transition-colors hover:enabled:border-ns-accent focus-visible:ring-2 focus-visible:ring-ns-accent disabled:opacity-50 sm:min-h-0"
          >
            {copyStatus === "copied" ? "Copied" : copyStatus === "error" ? "Copy failed" : "Copy all notes"}
          </button>
        </div>
      </div>

      {hydrated && jumpIndex.length > 0 ? (
        <nav aria-label="Jump to row" className="mt-4 flex flex-wrap gap-x-3 gap-y-1">
          {jumpIndex.map(({ slug }) => (
            <a
              key={slug}
              href={`#row-${slug}`}
              className="rounded-sm font-mono text-[11px] text-ns-muted underline-offset-2 outline-none transition-colors hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ns-accent"
            >
              {slug}
            </a>
          ))}
        </nav>
      ) : null}

      {/* Group A */}
      <Section
        title={GROUP_LABEL.fixed}
        remaining={fixedRemaining}
        items={fixedItems}
        state={state}
        hydrated={hydrated}
        onSetVerdict={setVerdict}
        onNoteChange={setNote}
        onNoteCommit={commitNote}
        saveStatus={saveStatus}
        registerRef={registerRef}
        isActive={isActive}
        isOnScreen={isOnScreen}
      />

      {/* Group B, split into lane subsections */}
      <LaneSection
        title={GROUP_LABEL.untested}
        remaining={untestedRemaining}
        items={untestedItems}
        lanes={UNTESTED_LANES}
        state={state}
        hydrated={hydrated}
        onSetVerdict={setVerdict}
        onNoteChange={setNote}
        onNoteCommit={commitNote}
        saveStatus={saveStatus}
        registerRef={registerRef}
        isActive={isActive}
        isOnScreen={isOnScreen}
      />

      {/* Group C, split into lane subsections */}
      <LaneSection
        title={GROUP_LABEL.expansion}
        remaining={expansionRemaining}
        items={expansionItems}
        lanes={EXPANSION_LANES}
        state={state}
        hydrated={hydrated}
        onSetVerdict={setVerdict}
        onNoteChange={setNote}
        onNoteCommit={commitNote}
        saveStatus={saveStatus}
        registerRef={registerRef}
        isActive={isActive}
        isOnScreen={isOnScreen}
      />

      {/* Group D — round 8a, flat (no lane) */}
      <Section
        title={GROUP_LABEL.r8a}
        remaining={r8aRemaining}
        items={r8aItems}
        state={state}
        hydrated={hydrated}
        onSetVerdict={setVerdict}
        onNoteChange={setNote}
        onNoteCommit={commitNote}
        saveStatus={saveStatus}
        registerRef={registerRef}
        isActive={isActive}
        isOnScreen={isOnScreen}
      />

      {hydrated && filtered.length === 0 ? (
        <p className="mt-16 text-sm text-ns-muted">
          {allSettled
            ? `All caught up — ${statusCounts.working} working, nothing flagged or untouched.`
            : "Nothing matches that filter."}
        </p>
      ) : null}
    </main>
  );
}

function Section({
  title,
  remaining,
  items,
  state,
  hydrated,
  onSetVerdict,
  onNoteChange,
  onNoteCommit,
  saveStatus,
  registerRef,
  isActive,
  isOnScreen,
}: {
  title: string;
  remaining: { untested: number; total: number };
  items: ReviewItem[];
  state: StateFile;
  hydrated: boolean;
  onSetVerdict: (slug: string, verdict: Verdict) => void;
  onNoteChange: (slug: string, note: string) => void;
  onNoteCommit: (slug: string, note: string) => void;
  saveStatus: Record<string, "saving" | "saved" | "error">;
  registerRef: (name: string, el: HTMLElement | null) => void;
  isActive: (name: string) => boolean;
  isOnScreen: (name: string) => boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
        <h2 className="text-lg font-medium tracking-[-0.02em] text-foreground">{title}</h2>
        <span className="shrink-0 font-mono text-xs text-ns-muted">
          {remaining.untested}/{remaining.total} untested
        </span>
      </div>
      <div className="mt-4 grid gap-4">
        {items.map((item) => (
          <Row
            key={item.slug}
            item={item}
            entry={hydrated ? state[item.slug] : undefined}
            onSetVerdict={onSetVerdict}
            onNoteChange={onNoteChange}
            onNoteCommit={onNoteCommit}
            saveStatus={saveStatus[item.slug]}
            registerRef={registerRef}
            isActive={isActive}
            isOnScreen={isOnScreen}
          />
        ))}
      </div>
    </section>
  );
}

/** Group B/C: same shell as Section, but split into lane subsections and
 *  skipped entirely (no header, no "0/0 untested") when the group is empty
 *  after filtering — matching Section's own empty behaviour. */
function LaneSection({
  title,
  remaining,
  items,
  lanes,
  state,
  hydrated,
  onSetVerdict,
  onNoteChange,
  onNoteCommit,
  saveStatus,
  registerRef,
  isActive,
  isOnScreen,
}: {
  title: string;
  remaining: { untested: number; total: number };
  items: ReviewItem[];
  lanes: Lane[];
  state: StateFile;
  hydrated: boolean;
  onSetVerdict: (slug: string, verdict: Verdict) => void;
  onNoteChange: (slug: string, note: string) => void;
  onNoteCommit: (slug: string, note: string) => void;
  saveStatus: Record<string, "saving" | "saved" | "error">;
  registerRef: (name: string, el: HTMLElement | null) => void;
  isActive: (name: string) => boolean;
  isOnScreen: (name: string) => boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-16">
      <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
        <h2 className="text-lg font-medium tracking-[-0.02em] text-foreground">{title}</h2>
        <span className="shrink-0 font-mono text-xs text-ns-muted">
          {remaining.untested}/{remaining.total} untested
        </span>
      </div>
      {lanes.map((lane) => {
        const laneItems = items.filter((i) => i.lane === lane);
        if (laneItems.length === 0) return null;
        return (
          <div key={lane} className="mt-8">
            <h3 className="font-mono text-xs uppercase tracking-[0.14em] text-ns-muted">
              {LANE_LABEL[lane]}
            </h3>
            <div className="mt-3 grid gap-4">
              {laneItems.map((item) => (
                <Row
                  key={item.slug}
                  item={item}
                  entry={hydrated ? state[item.slug] : undefined}
                  onSetVerdict={onSetVerdict}
                  onNoteChange={onNoteChange}
                  onNoteCommit={onNoteCommit}
                  saveStatus={saveStatus[item.slug]}
                  registerRef={registerRef}
                  isActive={isActive}
                  isOnScreen={isOnScreen}
                />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

const NOTE_COMMIT_DELAY = 600;

/** Check icon for the Working control / badge — text always accompanies it,
 *  so this is decoration, never the sole accessible signal. */
function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M3 8.5L6.2 11.5L13 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Flag icon for the Needs-work control / badge. */
function FlagIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M4 2v12M4 2.75h7.2c.5 0 .75.5.4.85L9.3 6l2.3 2.4c.35.35.1.85-.4.85H4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Row({
  item,
  entry,
  onSetVerdict,
  onNoteChange,
  onNoteCommit,
  saveStatus,
  registerRef,
  isActive,
  isOnScreen,
}: {
  item: ReviewItem;
  entry: RowState | undefined;
  onSetVerdict: (slug: string, verdict: Verdict) => void;
  onNoteChange: (slug: string, note: string) => void;
  onNoteCommit: (slug: string, note: string) => void;
  saveStatus?: "saving" | "saved" | "error";
  registerRef: (name: string, el: HTMLElement | null) => void;
  isActive: (name: string) => boolean;
  isOnScreen: (name: string) => boolean;
}) {
  const note = entry?.note ?? "";
  const verdict = entry?.verdict ?? (entry?.tested ? "working" : undefined);
  const status = effectiveStatus(entry);
  const hasNote = note.trim().length > 0;
  const noteId = `note-${item.slug}`;

  // Per-row remount, for components whose interesting state isn't the
  // resting one (the curtains: closed by default, only interesting mid-
  // draw). Bumping the counter changes the LivePreviewFrame's `key`, which
  // forces React to tear down and remount the iframe from scratch.
  const [remountCount, setRemountCount] = useState(0);

  // Settled ("working", no open note) rows collapse to a quiet one-liner so
  // the untested ones stay dense on screen. Flagged and untouched rows
  // always show in full — nothing to hide there. Auto-collapses the moment
  // a row newly becomes "working", auto-expands the moment it stops being
  // "working" (flagged or reverted to untouched); a manual expand/collapse
  // in between is left alone.
  const canCollapse = status === "working";
  const [expanded, setExpanded] = useState(!canCollapse);
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current !== status) {
      prevStatus.current = status;
      setExpanded(status !== "working");
    }
  }, [status]);

  // The mount manager only sees a card while it's registered — unregister
  // while collapsed so a settled row can't hold one of the 8 live-preview
  // slots a row the owner still needs to look at wants instead.
  const elRef = useRef<HTMLElement | null>(null);
  const setRef = useCallback((el: HTMLElement | null) => {
    elRef.current = el;
  }, []);
  useEffect(() => {
    registerRef(item.slug, expanded ? elRef.current : null);
    return () => registerRef(item.slug, null);
  }, [expanded, registerRef, item.slug]);

  const commitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handleNoteInput = useCallback(
    (value: string) => {
      onNoteChange(item.slug, value);
      clearTimeout(commitTimer.current);
      commitTimer.current = setTimeout(() => {
        onNoteCommit(item.slug, value);
      }, NOTE_COMMIT_DELAY);
    },
    [item.slug, onNoteChange, onNoteCommit],
  );
  const handleNoteBlur = useCallback(() => {
    clearTimeout(commitTimer.current);
    onNoteCommit(item.slug, note);
  }, [item.slug, note, onNoteCommit]);
  useEffect(() => () => clearTimeout(commitTimer.current), []);

  const detailsId = `details-${item.slug}`;

  return (
    <article
      ref={setRef}
      id={`row-${item.slug}`}
      data-name={item.slug}
      className={`grid gap-3 scroll-mt-24 rounded-md border p-4 transition-colors ${
        status === "flagged"
          ? "border-border border-l-2 border-l-ns-accent"
          : status === "working"
            ? "border-border/60"
            : "border-border"
      } ${expanded ? "sm:grid-cols-[1fr_auto]" : ""}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-mono text-sm font-medium text-foreground">{item.slug}</h3>
          {item.group !== "fixed" && item.lane ? (
            <span className="shrink-0 rounded-sm border border-border px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-ns-muted">
              {item.lane}
            </span>
          ) : null}
          {status === "working" ? (
            <span className="flex shrink-0 items-center gap-1 rounded-sm border border-border px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-ns-muted">
              <CheckIcon />
              Working
            </span>
          ) : null}
          {status === "flagged" ? (
            <span className="flex shrink-0 items-center gap-1 rounded-sm border border-ns-accent/40 px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-foreground">
              <FlagIcon />
              Flagged
            </span>
          ) : null}

          <div role="group" aria-label={`Verdict for ${item.slug}`} className="ml-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-pressed={verdict === "working"}
              onClick={() => onSetVerdict(item.slug, "working")}
              className={`flex min-h-8 items-center gap-1 rounded-sm border px-2 py-1 text-xs transition-colors sm:min-h-0 ${
                verdict === "working"
                  ? "border-ns-accent bg-ns-accent/10 text-foreground"
                  : "border-border text-ns-muted hover:text-foreground"
              }`}
            >
              <CheckIcon />
              Working
            </button>
            <button
              type="button"
              aria-pressed={verdict === "flagged"}
              onClick={() => onSetVerdict(item.slug, "flagged")}
              className={`flex min-h-8 items-center gap-1 rounded-sm border px-2 py-1 text-xs transition-colors sm:min-h-0 ${
                verdict === "flagged"
                  ? "border-ns-accent bg-ns-accent/10 text-foreground"
                  : "border-border text-ns-muted hover:text-foreground"
              }`}
            >
              <FlagIcon />
              Needs work
            </button>
          </div>
        </div>

        {canCollapse && !expanded ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={detailsId}
            onClick={() => setExpanded(true)}
            className="mt-2 rounded-sm text-xs text-ns-muted underline decoration-dotted underline-offset-2 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent"
          >
            Show details
          </button>
        ) : (
          <div id={detailsId}>
            {canCollapse ? (
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={detailsId}
                onClick={() => setExpanded(false)}
                className="mt-1 rounded-sm text-xs text-ns-muted underline decoration-dotted underline-offset-2 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent"
              >
                Hide details
              </button>
            ) : null}

            {item.eyeball ? (
              <p className="mt-2 text-[13px] leading-relaxed text-foreground">
                <span className="text-ns-muted">Eyeball:</span> {item.eyeball}
              </p>
            ) : null}

            {item.group === "fixed" ? (
              <div className="mt-2 space-y-1 text-[13px] leading-relaxed text-ns-muted">
                <p>
                  <span className="text-foreground">Changed:</span> {item.change}
                </p>
                <p>
                  <span className="text-foreground">Look for:</span> {item.watch}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-[13px] leading-relaxed text-ns-muted">{item.note}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <Link
                href={`/components/${item.slug}`}
                className="rounded-sm text-ns-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ns-accent"
              >
                Component page
              </Link>
              <Link
                href={`/preview/${item.slug}?embed=1&autoplay=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-sm text-ns-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ns-accent"
              >
                Card in isolation ↗
              </Link>
              {item.resetLabel ? (
                <button
                  type="button"
                  onClick={() => setRemountCount((c) => c + 1)}
                  className="rounded-sm text-ns-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ns-accent"
                >
                  {item.resetLabel}
                </button>
              ) : null}
              <span
                aria-live="polite"
                className="w-12 shrink-0 font-mono text-[10px] uppercase tracking-wider text-ns-muted"
              >
                {saveStatus === "saving"
                  ? "Saving…"
                  : saveStatus === "saved"
                    ? "Saved"
                    : saveStatus === "error"
                      ? "Error"
                      : ""}
              </span>
            </div>

            <div className="mt-2">
              <label htmlFor={noteId} className="sr-only">
                Note for {item.slug}
              </label>
              <textarea
                id={noteId}
                value={note}
                onChange={(e) => handleNoteInput(e.target.value)}
                onBlur={handleNoteBlur}
                placeholder="What's wrong here…"
                rows={hasNote ? undefined : 1}
                className="max-h-40 min-h-8 w-full resize-y rounded-sm border border-border bg-surface px-2 py-1 text-[13px] leading-relaxed text-foreground outline-none transition-colors placeholder:text-ns-muted focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none"
              />
            </div>
          </div>
        )}
      </div>

      {expanded ? (
        <LivePreviewFrame
          key={remountCount}
          name={item.slug}
          title={item.slug}
          active={isActive(item.slug)}
          onScreen={isOnScreen(item.slug)}
          className="aspect-[16/10] w-full sm:w-56"
        />
      ) : null}
    </article>
  );
}
