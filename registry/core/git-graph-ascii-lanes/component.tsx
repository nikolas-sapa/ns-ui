"use client";

import { useCallback, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// GitGraphAsciiLanes — a commit DAG drawn the way `git log --graph` draws one.
//
// The mechanic is a real lane allocator, not a pretty picture of one: a single
// `active: (string|null)[]` array is walked top-to-bottom over the commit list,
// each commit claiming the slot that already expects it (or the lowest free
// slot, or a new one), freeing every OTHER slot that also expected it (a branch
// converging), and opening a slot per extra parent (a merge fanning out). The
// pairs of lanes that open and close between two commit rows are exactly what
// the `├─┐` / `├─┘` connector rows draw, and any live lane a horizontal run
// crosses becomes `┼`.
//
// The whole grid is one `useMemo` over (commits, collapsedMerges) that starts
// from an EMPTY `active` array every time. Nothing is ever patched in place —
// collapsing a merge's side branch re-derives all of it, which is why the braid
// visibly straightens instead of leaving a stale column behind.
// ---------------------------------------------------------------------------

export interface GitCommit {
  id: string;
  subject: string;
  author: string;
  date: string;
  parents: string[];
  /** Branch name, used only to label a collapsed side branch. */
  branch?: string;
}

export interface GitGraphAsciiLanesProps {
  commits?: GitCommit[];
  /** Commit id HEAD points at. Defaults to the first (newest) commit. */
  head?: string;
  className?: string;
}

const MAX_LANES = 6;

const DEFAULT_COMMITS: GitCommit[] = [
  { id: "4e1b7a2", subject: "Bump lockfile after security audit", author: "nik", date: "2h", parents: ["9d2f014"] },
  { id: "9d2f014", subject: "Merge branch 'feat/router' into main", author: "nik", date: "5h", parents: ["1f8a4c3", "3ad91e0"] },
  { id: "1f8a4c3", subject: "Fix range clamp on resize", author: "dee", date: "1d", parents: ["7c02be9"] },
  { id: "7c02be9", subject: "Merge branch 'fix/hydration' into main", author: "sam", date: "2d", parents: ["b6e5170", "0c9d3f4"] },
  { id: "3ad91e0", subject: "Guard against an empty route table", author: "rui", date: "1d", branch: "feat/router", parents: ["c81ba07"] },
  { id: "c81ba07", subject: "Cache compiled matchers per segment", author: "rui", date: "2d", branch: "feat/router", parents: ["5f47d92"] },
  { id: "5f47d92", subject: "Move param parsing off the hot path", author: "rui", date: "3d", branch: "feat/router", parents: ["e29c1b8"] },
  { id: "e29c1b8", subject: "Sketch the segment router interface", author: "rui", date: "3d", branch: "feat/router", parents: ["b6e5170"] },
  { id: "0c9d3f4", subject: "Drop the client-only theme read", author: "dee", date: "2d", branch: "fix/hydration", parents: ["d4a8e6b"] },
  { id: "d4a8e6b", subject: "Reproduce the hydration mismatch in a test", author: "dee", date: "3d", branch: "fix/hydration", parents: ["f70b25c"] },
  { id: "b6e5170", subject: "Split the token map out of the theme provider", author: "nik", date: "4d", parents: ["f70b25c"] },
  { id: "f70b25c", subject: "Add lane allocation to the history view", author: "sam", date: "5d", parents: ["8ae3c40"] },
  { id: "8ae3c40", subject: "Initial commit", author: "nik", date: "6d", parents: [] },
];

type Cell = { ch: string; owner: string | null; lane: number };

type Row =
  | { kind: "commit"; key: string; commit: GitCommit; lane: number; isMerge: boolean; cells: (Cell | null)[] }
  | { kind: "connector"; key: string; cells: (Cell | null)[] }
  | { kind: "group"; key: string; count: number; branch: string; cells: (Cell | null)[] };

/** Every commit reachable from `start` by walking `parents`. */
function reachable(byId: Map<string, GitCommit>, start: string): Set<string> {
  const seen = new Set<string>();
  const queue = [start];
  while (queue.length) {
    const id = queue.shift() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = byId.get(id);
    if (node) for (const p of node.parents) if (!seen.has(p)) queue.push(p);
  }
  return seen;
}

function buildGrid(commits: GitCommit[], collapsed: ReadonlySet<string>) {
  const byId = new Map(commits.map((c) => [c.id, c]));

  // --- which rows are hidden behind a collapsed merge -----------------------
  const hidden = new Set<string>();
  const groups = new Map<string, { count: number; branch: string }>();
  for (const mergeId of collapsed) {
    const m = byId.get(mergeId);
    if (!m || m.parents.length < 2) continue;
    const mainline = reachable(byId, m.parents[0]);
    const side = new Set<string>();
    for (const p of m.parents.slice(1)) {
      for (const id of reachable(byId, p)) if (!mainline.has(id)) side.add(id);
    }
    if (side.size === 0) continue;
    // A side commit that some OTHER visible commit still points at must stay
    // visible: hiding it would leave the lane expecting it open all the way to
    // the bottom of the graph. Refuse the collapse rather than emit a stray lane.
    let escapes = false;
    for (const other of commits) {
      if (other.id === mergeId || side.has(other.id) || hidden.has(other.id)) continue;
      if (other.parents.some((p) => side.has(p))) {
        escapes = true;
        break;
      }
    }
    if (escapes) continue;
    for (const id of side) hidden.add(id);
    groups.set(mergeId, {
      count: side.size,
      branch: byId.get(m.parents[1])?.branch ?? "side branch",
    });
  }

  // --- the lane allocator ---------------------------------------------------
  const active: (string | null)[] = [];
  let laneCount = 0;
  type Pair = { a: number; b: number; open: boolean };
  const raw: {
    commit: GitCommit;
    lane: number;
    isMerge: boolean;
    snapshot: (string | null)[];
    after: (string | null)[];
    pairs: Pair[];
  }[] = [];

  for (const c of commits) {
    if (hidden.has(c.id)) continue;
    // A collapsed merge is walked as if it had only its first parent, so the
    // side lane is never opened at all — that is what straightens the braid.
    const parents = collapsed.has(c.id) && groups.has(c.id) ? c.parents.slice(0, 1) : c.parents;

    let lane = active.indexOf(c.id);
    if (lane === -1) lane = active.indexOf(null);
    if (lane === -1) lane = active.push(null) - 1;
    active[lane] = c.id;

    const snapshot = active.slice();
    const pairs: Pair[] = [];

    // every OTHER slot expecting this commit is a branch converging here
    for (let i = 0; i < active.length; i++) {
      if (i !== lane && active[i] === c.id) {
        active[i] = null;
        pairs.push({ a: i, b: lane, open: false });
      }
    }

    active[lane] = parents[0] ?? null;

    for (let k = 1; k < parents.length; k++) {
      const p = parents[k];
      let pLane = active.indexOf(p);
      if (pLane === -1) pLane = active.indexOf(null);
      if (pLane === -1) pLane = active.push(null) - 1;
      active[pLane] = p;
      pairs.push({ a: lane, b: pLane, open: true });
    }

    laneCount = Math.max(laneCount, active.length, snapshot.length);
    raw.push({ commit: c, lane, isMerge: c.parents.length > 1, snapshot, after: active.slice(), pairs });
  }

  // --- glyph emission -------------------------------------------------------
  const overflow = laneCount > MAX_LANES;
  const colOf = (lane: number) => Math.min(lane, MAX_LANES - 1) * 2;
  const laneGlyph = (lane: number, ch: string) => (overflow && lane >= MAX_LANES - 1 ? "⋯" : ch);
  const width = Math.min(laneCount, MAX_LANES) * 2 - 1;

  const blank = (): (Cell | null)[] => new Array(Math.max(width, 1)).fill(null);
  const rows: Row[] = [];

  for (const r of raw) {
    // commit row: ● (or ◍ for a merge) at its own lane, │ at every other live lane
    const cells = blank();
    for (let i = 0; i < r.snapshot.length; i++) {
      const owner = r.snapshot[i];
      if (!owner) continue;
      const ch = i === r.lane ? (r.isMerge ? "◍" : "●") : "│";
      cells[colOf(i)] = { ch: laneGlyph(i, ch), owner, lane: i };
    }
    rows.push({ kind: "commit", key: r.commit.id, commit: r.commit, lane: r.lane, isMerge: r.isMerge, cells });

    const group = groups.get(r.commit.id);
    if (group) {
      const gcells = blank();
      for (let i = 0; i < r.after.length; i++) {
        const owner = r.after[i];
        if (owner) gcells[colOf(i)] = { ch: laneGlyph(i, "│"), owner, lane: i };
      }
      rows.push({ kind: "group", key: `${r.commit.id}:group`, count: group.count, branch: group.branch, cells: gcells });
    }

    if (r.pairs.length === 0) continue;

    // connector row: live lanes first, then every open/close pair drawn over them
    const cc = blank();
    for (let i = 0; i < r.after.length; i++) {
      const owner = r.after[i];
      if (owner) cc[colOf(i)] = { ch: laneGlyph(i, "│"), owner, lane: i };
    }
    for (const pair of r.pairs) {
      const lo = Math.min(pair.a, pair.b);
      const hi = Math.max(pair.a, pair.b);
      const cLo = colOf(lo);
      const cHi = colOf(hi);
      cc[cLo] = { ch: "├", owner: r.commit.id, lane: lo };
      for (let x = cLo + 1; x < cHi; x++) {
        const held = cc[x];
        cc[x] = held && held.ch === "│" ? { ...held, ch: "┼" } : { ch: "─", owner: r.commit.id, lane: -1 };
      }
      cc[cHi] = { ch: pair.open ? "┐" : "┘", owner: r.commit.id, lane: hi };
    }
    rows.push({ kind: "connector", key: `${r.commit.id}:conn`, cells: cc });
  }

  return { rows, byId };
}

export function GitGraphAsciiLanes({
  commits = DEFAULT_COMMITS,
  head,
  className = "",
}: GitGraphAsciiLanesProps) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const headId = head ?? commits[0]?.id ?? null;
  const activeId = hoverId ?? pinnedId;

  const { rows, byId } = useMemo(() => buildGrid(commits, collapsed), [commits, collapsed]);

  const ancestors = useMemo(() => {
    if (!activeId) return null;
    return reachable(byId, activeId);
  }, [activeId, byId]);

  const commitRows = rows.filter((r) => r.kind === "commit") as Extract<Row, { kind: "commit" }>[];
  // Collapsing a merge removes rows, so a stale focusIndex could point past the
  // end and leave NO row with tabIndex 0 — Tab would then skip the graph
  // entirely. Clamp at render instead of trusting the stored index.
  const rovingIndex = Math.min(focusIndex, Math.max(0, commitRows.length - 1));
  buttonsRef.current.length = commitRows.length;

  const lit = useCallback(
    (owner: string | null) => !ancestors || (owner !== null && ancestors.has(owner)),
    [ancestors],
  );

  const toneOf = (cell: Cell) => {
    if (ancestors) {
      if (!lit(cell.owner)) return "text-border";
      if (cell.owner === headId && (cell.ch === "●" || cell.ch === "◍")) return "text-ns-accent";
      return "text-foreground";
    }
    if (cell.owner === headId && (cell.ch === "●" || cell.ch === "◍")) return "text-ns-accent";
    // At rest the whole braid must be legible — the trunk reads at full ink and
    // every other lane at --ns-muted. --border is reserved for the DIMMED state
    // above, so "not an ancestor" stays visually distinct from "off-trunk".
    return cell.lane === 0 ? "text-foreground" : "text-ns-muted";
  };

  const glyphs = (cells: (Cell | null)[]) => (
    <span aria-hidden className="whitespace-pre">
      {cells.map((cell, i) =>
        cell ? (
          <span key={i} className={`transition-colors duration-[140ms] motion-reduce:transition-none ${toneOf(cell)}`}>
            {cell.ch}
          </span>
        ) : (
          <span key={i}> </span>
        ),
      )}
    </span>
  );

  const moveFocus = (next: number) => {
    const clamped = Math.max(0, Math.min(commitRows.length - 1, next));
    setFocusIndex(clamped);
    buttonsRef.current[clamped]?.focus();
  };

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const nx = new Set(prev);
      if (nx.has(id)) nx.delete(id);
      else nx.add(id);
      return nx;
    });
  };

  let commitIndex = -1;

  return (
    <div className={`ns-gga font-mono text-[12px] leading-[20px] ${className}`}>
      <style>{CSS}</style>
      <div role="group" aria-label="Commit history graph">
        {rows.map((row) => {
          if (row.kind === "connector") {
            return (
              <div key={row.key} className="ns-gga-line select-none" aria-hidden>
                {glyphs(row.cells)}
              </div>
            );
          }

          if (row.kind === "group") {
            return (
              <div key={row.key} data-commit-group className="ns-gga-line flex items-center gap-3 select-none">
                {glyphs(row.cells)}
                <span className="text-ns-muted">
                  ⋯ {row.count} commits from {row.branch}
                </span>
              </div>
            );
          }

          commitIndex += 1;
          const idx = commitIndex;
          const c = row.commit;
          const dim = ancestors !== null && !ancestors.has(c.id);
          const isHead = c.id === headId;
          const shaTone = dim ? "text-border" : isHead ? "text-ns-accent" : "text-ns-muted";
          const subjectTone = dim ? "text-border" : "text-foreground";
          const metaTone = dim ? "text-border" : "text-ns-muted";

          return (
            <button
              key={row.key}
              type="button"
              ref={(el) => {
                buttonsRef.current[idx] = el;
              }}
              data-commit={c.id}
              {...(row.isMerge ? { "data-commit-merge": "" } : {})}
              tabIndex={idx === rovingIndex ? 0 : -1}
              aria-expanded={row.isMerge ? !collapsed.has(c.id) : undefined}
              aria-label={
                `${c.subject}. Commit ${c.id} by ${c.author}, ${c.date} ago` +
                (isHead ? ", HEAD" : "") +
                (row.isMerge
                  ? `. Merge commit — press Enter to ${collapsed.has(c.id) ? "expand" : "collapse"} the merged branch`
                  : ". Press Enter to hold its ancestor highlight")
              }
              className="ns-gga-row ns-gga-line flex w-full items-center gap-3 text-left"
              onPointerEnter={() => setHoverId(c.id)}
              onPointerLeave={() => setHoverId((cur) => (cur === c.id ? null : cur))}
              onFocus={() => {
                setFocusIndex(idx);
                setHoverId(c.id);
              }}
              onBlur={() => setHoverId((cur) => (cur === c.id ? null : cur))}
              onClick={() => {
                if (row.isMerge) toggleCollapse(c.id);
                else setPinnedId((cur) => (cur === c.id ? null : c.id));
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  moveFocus(idx + 1);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  moveFocus(idx - 1);
                } else if (e.key === "Home") {
                  e.preventDefault();
                  moveFocus(0);
                } else if (e.key === "End") {
                  e.preventDefault();
                  moveFocus(commitRows.length - 1);
                } else if (e.key === "Escape") {
                  setHoverId(null);
                  setPinnedId(null);
                }
              }}
            >
              {glyphs(row.cells)}
              <span className={`shrink-0 transition-colors duration-[140ms] motion-reduce:transition-none ${shaTone}`}>
                {c.id}
              </span>
              <span
                className={`flex-1 truncate transition-colors duration-[140ms] motion-reduce:transition-none ${subjectTone}`}
              >
                {c.subject}
              </span>
              <span
                className={`shrink-0 tabular-nums transition-colors duration-[140ms] motion-reduce:transition-none ${metaTone}`}
              >
                {c.author} · {c.date}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const CSS = `
.ns-gga-line { min-height: 20px; }
.ns-gga-row { cursor: pointer; }
.ns-gga-row:focus-visible { outline: 2px solid var(--ns-accent); outline-offset: -2px; }
`;
