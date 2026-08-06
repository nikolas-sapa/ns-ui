"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

// ---------------------------------------------------------------------------
// ToppleRun — a select-all whose propagation is the interaction model, not a
// cosmetic stagger. Flipping the master checkbox releases a wavefront that
// travels down the list at a fixed rate (14 rows/sec): as the front reaches
// row i, that row's own checkbox commits its new state under a 120ms
// spring-eased transition and the row takes a transient translateY(2px)
// lean toward row i+1 — read as the wave shoving the next domino — handed
// off with a short overlap so consecutive leans read as continuous contact.
// A thin tick travels the list's left edge marking the front's live
// position. Every row commits its state the instant the front passes it, so
// there is nothing to roll back: stopping the run just stops future rows
// from being touched.
//
// INTERRUPTION: the run is spatially interruptible, not just cancelable —
// activating ANY row (pointer or keyboard, since every row stays a fully
// operable checkbox for the run's entire duration) halts the wave
// immediately. Rows the front already passed keep their committed state;
// rows beyond the front are simply untouched, standing exactly as they
// were. Escape halts it too. This is the "all except a few" recovery path:
// watch the run, stop it where you want, no undo needed because nothing
// past that point was ever touched.
//
// A11Y: the master is a real input[type=checkbox] with aria-controls
// pointing at the row list's id; a polite live region announces once at
// the start ("Enabling all…") and once at the end or halt ("Enabled 34 of
// 40, stopped at row 35."). Every row is a real checkbox with its own
// native label association — nothing here is conveyed only by animation.
//
// REDUCED MOTION: there is no wave to catch, so interruption is replaced by
// a straightforward safety net — the master flips every row in a single
// frame and a 5s Undo affordance appears, reverting the whole batch if
// pressed in time.
//
// TOKENS: --foreground for ink (checkbox fill, the traveling tick),
// --border for hairlines, --ns-muted for secondary text, --ns-accent for the
// focus ring only. Pure DOM/CSS, no canvas.
// ---------------------------------------------------------------------------

const ROWS_PER_SEC = 14;
const ROW_H = 56; // px — must match the row wrapper's fixed height
const LEAN_MS = Math.round(1000 / ROWS_PER_SEC) + 40; // ~111ms, overlaps the next row's start
const UNDO_MS = 5000;

export interface ToppleRunItem {
  /** Stable identifier for this row. */
  id: string;
  /** Primary row label — also becomes its checkbox's accessible name. */
  label: string;
  /** Optional secondary line (sender, timestamp, byline...). */
  description?: string;
}

export interface ToppleRunProps {
  /** Rows the master toggle governs, top to bottom = wave direction. */
  items: ToppleRunItem[];
  /** Label for the master control. @default "Select all" */
  label?: string;
  /** Ids checked on mount. @default [] */
  defaultChecked?: string[];
  /** Fires whenever the checked set changes, including mid-run commits. */
  onChange?: (checkedIds: string[]) => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

interface Row extends ToppleRunItem {
  checked: boolean;
}

export function ToppleRun({
  items,
  label = "Select all",
  defaultChecked = [],
  onChange,
  className = "",
}: ToppleRunProps) {
  const uid = useId();
  const reducedMotion = useReducedMotion();

  const [rows, setRows] = useState<Row[]>(() =>
    items.map((item) => ({
      ...item,
      checked: defaultChecked.includes(item.id),
    }))
  );
  const [running, setRunning] = useState(false);
  const [liveMsg, setLiveMsg] = useState("");
  const [undoAvailable, setUndoAvailable] = useState(false);

  const masterRef = useRef<HTMLInputElement | null>(null);
  const rowElRefs = useRef<(HTMLLIElement | null)[]>([]);
  const tickRef = useRef<HTMLDivElement | null>(null);

  const rafRef = useRef<number | undefined>(undefined);
  const runTokenRef = useRef(0);
  const committedRef = useRef(-1);
  const startTimeRef = useRef(0);
  const targetRef = useRef(true);
  const leanTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const undoSnapshotRef = useRef<Row[] | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  const total = rows.length;
  const checkedCount = rows.reduce((n, r) => (r.checked ? n + 1 : n), 0);
  const allChecked = total > 0 && checkedCount === total;
  const noneChecked = checkedCount === 0;
  const indeterminate = !allChecked && !noneChecked;

  useEffect(() => {
    if (masterRef.current) masterRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    onChange?.(rows.filter((r) => r.checked).map((r) => r.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const clearLeanTimers = useCallback(() => {
    leanTimersRef.current.forEach((t) => clearTimeout(t));
    leanTimersRef.current.clear();
  }, []);

  const commitRow = useCallback((index: number, checked: boolean) => {
    setRows((prev) => {
      if (prev[index]?.checked === checked) return prev;
      const next = prev.slice();
      next[index] = { ...next[index]!, checked };
      return next;
    });
    const el = rowElRefs.current[index];
    if (el) {
      el.style.transform = "translateY(2px)";
      const prevTimer = leanTimersRef.current.get(index);
      if (prevTimer) clearTimeout(prevTimer);
      leanTimersRef.current.set(
        index,
        setTimeout(() => {
          el.style.transform = "";
          leanTimersRef.current.delete(index);
        }, LEAN_MS)
      );
    }
  }, []);

  const endRun = useCallback(
    (committedCount: number, rowTotal: number) => {
      if (rafRef.current !== undefined) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = undefined;
      }
      setRunning(false);
      if (tickRef.current) tickRef.current.style.opacity = "0";
      const verb = targetRef.current ? "Enabled" : "Disabled";
      if (rowTotal === 0) {
        setLiveMsg("");
      } else if (committedCount >= rowTotal) {
        setLiveMsg(`${verb} all ${rowTotal}.`);
      } else {
        setLiveMsg(
          `${verb} ${committedCount} of ${rowTotal}, stopped at row ${
            committedCount + 1
          }.`
        );
      }
    },
    []
  );

  const haltRun = useCallback(() => {
    if (!running) return;
    runTokenRef.current += 1;
    endRun(committedRef.current + 1, total);
  }, [running, endRun, total]);

  const startRun = useCallback(
    (target: boolean) => {
      if (total === 0) return;
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
      clearLeanTimers();

      runTokenRef.current += 1;
      const token = runTokenRef.current;
      targetRef.current = target;
      committedRef.current = -1;
      startTimeRef.current = performance.now();
      setRunning(true);
      setLiveMsg(target ? "Enabling all…" : "Disabling all…");
      if (tickRef.current) {
        tickRef.current.style.opacity = "1";
        tickRef.current.style.transform = "translateY(0px)";
      }

      const step = (now: number) => {
        if (runTokenRef.current !== token) return;
        const elapsedS = (now - startTimeRef.current) / 1000;
        const front = elapsedS * ROWS_PER_SEC;
        if (tickRef.current) {
          tickRef.current.style.transform = `translateY(${
            Math.min(front, total) * ROW_H
          }px)`;
        }
        while (committedRef.current + 1 < total && committedRef.current + 1 <= front) {
          const i = committedRef.current + 1;
          commitRow(i, target);
          committedRef.current = i;
        }
        if (committedRef.current >= total - 1) {
          endRun(total, total);
          return;
        }
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [total, clearLeanTimers, commitRow, endRun]
  );

  // Escape halts a live run from anywhere.
  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") haltRun();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, haltRun]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
      clearLeanTimers();
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, [clearLeanTimers]);

  const handleMasterChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const target = e.target.checked;
      if (total === 0) return;

      if (reducedMotion) {
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        undoSnapshotRef.current = rows.map((r) => ({ ...r }));
        setRows((prev) => prev.map((r) => ({ ...r, checked: target })));
        setLiveMsg(
          target ? `Enabled all ${total}.` : `Disabled all ${total}.`
        );
        setUndoAvailable(true);
        undoTimerRef.current = setTimeout(() => {
          setUndoAvailable(false);
          undoSnapshotRef.current = null;
        }, UNDO_MS);
        return;
      }

      startRun(target);
    },
    [total, reducedMotion, rows, startRun]
  );

  const handleRowChange = useCallback(
    (index: number, checked: boolean) => {
      if (running) haltRun();
      setRows((prev) => {
        const next = prev.slice();
        next[index] = { ...next[index]!, checked };
        return next;
      });
    },
    [running, haltRun]
  );

  const handleUndo = useCallback(() => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    if (undoSnapshotRef.current) {
      const snapshot = undoSnapshotRef.current;
      setRows(snapshot);
      setLiveMsg("Undone.");
    }
    setUndoAvailable(false);
    undoSnapshotRef.current = null;
  }, []);

  const groupId = `checkbox-domino-run-${uid}-group`;
  const liveId = `checkbox-domino-run-${uid}-live`;

  return (
    <div className={`w-full rounded-md border border-border bg-surface ${className}`}>
      <div id={liveId} aria-live="polite" className="sr-only">
        {liveMsg}
      </div>

      <label className="relative flex h-14 cursor-pointer select-none items-center gap-3 border-b border-border px-4">
        <input
          ref={masterRef}
          type="checkbox"
          className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 focus:outline-none"
          checked={allChecked}
          onChange={handleMasterChange}
          aria-controls={groupId}
        />
        <CheckboxVisual
          checked={allChecked}
          indeterminate={indeterminate}
          reducedMotion={reducedMotion}
        />
        <span className="flex-1 text-[13px] font-medium text-foreground">
          {label}
        </span>
        <span aria-hidden="true" className="font-mono text-[11px] text-ns-muted">
          {checkedCount}/{total}
        </span>
      </label>

      <div className="relative">
        <div
          ref={tickRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 z-10 w-[2px] bg-foreground opacity-0"
          style={{ height: ROW_H, willChange: "transform" }}
        />
        <ul id={groupId}>
          {rows.map((row, i) => (
            <li
              key={row.id}
              ref={(el) => {
                rowElRefs.current[i] = el;
              }}
              style={{
                height: ROW_H,
                transition: reducedMotion
                  ? undefined
                  : `transform ${LEAN_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
              }}
              className={i < rows.length - 1 ? "border-b border-border" : ""}
            >
              <label className="relative flex h-full cursor-pointer select-none items-center gap-3 px-4">
                <input
                  type="checkbox"
                  className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 focus:outline-none"
                  checked={row.checked}
                  onChange={(e) => handleRowChange(i, e.target.checked)}
                />
                <CheckboxVisual
                  checked={row.checked}
                  reducedMotion={reducedMotion}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-foreground">
                    {row.label}
                  </span>
                  {row.description && (
                    <span className="block truncate text-[12px] text-ns-muted">
                      {row.description}
                    </span>
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      {undoAvailable && (
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          <span className="text-[12px] text-ns-muted">
            Batch applied — undo within {UNDO_MS / 1000}s.
          </span>
          <button
            type="button"
            onClick={handleUndo}
            className="rounded-sm border border-border px-2.5 py-1 text-[12px] font-medium text-foreground transition-colors duration-150 hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

function CheckboxVisual({
  checked,
  indeterminate = false,
  reducedMotion = false,
}: {
  checked: boolean;
  indeterminate?: boolean;
  reducedMotion?: boolean;
}) {
  const springDuration = reducedMotion ? "0ms" : "120ms";
  const springEase = "cubic-bezier(0.34, 1.56, 0.64, 1)";
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border border-border bg-background peer-checked:border-foreground peer-checked:bg-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ns-accent"
      style={{
        transition: `background-color ${springDuration} ${springEase}, border-color ${springDuration} ${springEase}`,
      }}
    >
      <svg
        viewBox="0 0 16 16"
        className="h-3 w-3 text-background"
        style={{
          opacity: checked && !indeterminate ? 1 : 0,
          transform: checked && !indeterminate ? "scale(1)" : "scale(0.5)",
          transition: `opacity ${springDuration} ${springEase}, transform ${springDuration} ${springEase}`,
        }}
      >
        <path
          d="M3 8.2L6.2 11.4L13 4.4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="absolute h-[2px] w-2.5 rounded-full bg-background"
        style={{
          opacity: indeterminate ? 1 : 0,
          transition: `opacity ${springDuration} ${springEase}`,
        }}
      />
    </span>
  );
}
