"use client";

import { useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

// ---------------------------------------------------------------------------
// PunchPatch — a role x permission matrix rendered as a Jacquard card where
// authority is asymmetric material. Granting a permission punches a clean
// circular hole through the card stock; revoking never un-punches — it pastes
// a visible patch over the hole instead, leaving the hole's rim peeking 1px
// around the patch and its torn corners permanent for the session. Re-granting
// punches straight through the existing patch (a smaller hole cut through its
// centre), so a cell that was ever revoked stays visibly distinct from one
// that was never touched, forever, regardless of its current state. Inherited
// grants render as sealed eyelets — solid rim + inner ring, non-interactive,
// with a tooltip naming the parent role. Dependencies (grant X requires Y)
// share one punch-bar motion across both cells instead of two animations run
// back to back. Pure DOM + SVG, tokens only, reduced motion swaps instantly.
// ---------------------------------------------------------------------------

export interface PunchPatchRole {
  id: string;
  name: string;
}

export interface PunchPatchPermission {
  id: string;
  name: string;
  /** id of another permission in the same set this one depends on; granting
   *  this one cascades a grant of the dependency first, if it isn't held. */
  requires?: string;
}

export interface PunchPatchGrant {
  roleId: string;
  permissionId: string;
}

export interface PunchPatchInherited extends PunchPatchGrant {
  /** name of the parent role this grant is inherited from */
  from: string;
}

export interface PunchPatchProps {
  /** accessible name for the whole matrix */
  label?: string;
  /** row headers */
  roles: PunchPatchRole[];
  /** column headers */
  permissions: PunchPatchPermission[];
  /** cells punched (granted) at mount */
  defaultGranted?: PunchPatchGrant[];
  /** cells with a punch-then-patch history at mount: currently off, previously granted */
  defaultRevoked?: PunchPatchGrant[];
  /** cells granted via role inheritance — rendered as sealed, non-interactive eyelets */
  inherited?: PunchPatchInherited[];
  /** fires with the current directly-held (non-inherited) grants after any toggle */
  onChange?: (grants: PunchPatchGrant[]) => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

interface CellState {
  granted: boolean;
  /** sticky for the session once true: this cell has been revoked at least once */
  patched: boolean;
}

const key = (roleId: string, permId: string) => `${roleId}::${permId}`;

function useReducedMotion() {
  return useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  ).current;
}

function buildInitialCells(
  granted: PunchPatchGrant[],
  revoked: PunchPatchGrant[],
): Map<string, CellState> {
  const m = new Map<string, CellState>();
  for (const g of granted) m.set(key(g.roleId, g.permissionId), { granted: true, patched: false });
  for (const r of revoked) m.set(key(r.roleId, r.permissionId), { granted: false, patched: true });
  return m;
}

interface PunchBar {
  id: number;
  left: number;
  top: number;
  width: number;
}

export function PunchPatch({
  label = "Role permissions",
  roles,
  permissions,
  defaultGranted = [],
  defaultRevoked = [],
  inherited = [],
  onChange,
  className = "",
}: PunchPatchProps) {
  const reduced = useReducedMotion();
  const baseId = useId();
  const patchedDescId = `${baseId}-patched-desc`;

  const [cells, setCells] = useState<Map<string, CellState>>(() =>
    buildInitialCells(defaultGranted, defaultRevoked),
  );
  const [focusedR, setFocusedR] = useState(0);
  const [focusedP, setFocusedP] = useState(0);
  const [punchBar, setPunchBar] = useState<PunchBar | null>(null);

  const chadEverRef = useRef<Set<string>>(new Set());
  const gridWrapRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const liveRef = useRef<HTMLDivElement>(null);
  const barIdRef = useRef(0);
  const barTimeoutRef = useRef<number | null>(null);

  const inheritedMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of inherited) m.set(key(i.roleId, i.permissionId), i.from);
    return m;
  }, [inherited]);

  const permById = useMemo(() => {
    const m = new Map<string, PunchPatchPermission>();
    for (const p of permissions) m.set(p.id, p);
    return m;
  }, [permissions]);

  const announce = (text: string) => {
    if (liveRef.current) liveRef.current.textContent = text;
  };

  const emitChange = (next: Map<string, CellState>) => {
    if (!onChange) return;
    const out: PunchPatchGrant[] = [];
    for (const role of roles) {
      for (const perm of permissions) {
        if (next.get(key(role.id, perm.id))?.granted) {
          out.push({ roleId: role.id, permissionId: perm.id });
        }
      }
    }
    onChange(out);
  };

  const triggerPunchBar = (roleId: string, fromPermId: string, toPermId: string) => {
    if (reduced) return;
    const wrap = gridWrapRef.current;
    const fromEl = cellRefs.current.get(key(roleId, fromPermId));
    const toEl = cellRefs.current.get(key(roleId, toPermId));
    if (!wrap || !fromEl || !toEl) return;
    const wr = wrap.getBoundingClientRect();
    const fr = fromEl.getBoundingClientRect();
    const tr = toEl.getBoundingClientRect();
    const left = Math.min(fr.left, tr.left) - wr.left;
    const right = Math.max(fr.right, tr.right) - wr.left;
    if (barTimeoutRef.current) window.clearTimeout(barTimeoutRef.current);
    barIdRef.current += 1;
    setPunchBar({
      id: barIdRef.current,
      left,
      top: fr.top - wr.top + fr.height / 2 - 1.5,
      width: right - left,
    });
    barTimeoutRef.current = window.setTimeout(() => setPunchBar(null), 340);
  };

  // Reads `cells` from the render closure rather than a functional setState
  // updater on purpose: toggle only ever runs from a discrete click/keydown,
  // one at a time, each committed before the next can fire — so there's no
  // batching hazard here. That keeps onChange/announce/triggerPunchBar (each
  // itself a state update) out of the updater function, where React would
  // otherwise double-invoke them under StrictMode and warn about setState
  // during another component's render.
  const toggle = (roleId: string, roleName: string, permId: string) => {
    const k = key(roleId, permId);
    if (inheritedMap.has(k)) return;

    const cur = cells.get(k) ?? { granted: false, patched: false };
    const next = new Map(cells);
    const perm = permById.get(permId);
    const permName = perm?.name ?? permId;

    if (cur.granted) {
      next.set(k, { granted: false, patched: true });
      setCells(next);
      announce(`${permName} revoked for ${roleName}. Previously granted.`);
      emitChange(next);
      return;
    }

    next.set(k, { granted: true, patched: cur.patched });
    chadEverRef.current.add(k);

    let cascadeName: string | null = null;
    let cascadeReqId: string | null = null;
    const reqId = perm?.requires;
    if (reqId) {
      const reqKey = key(roleId, reqId);
      const reqCur = cells.get(reqKey) ?? { granted: false, patched: false };
      if (!reqCur.granted) {
        next.set(reqKey, { granted: true, patched: reqCur.patched });
        chadEverRef.current.add(reqKey);
        cascadeName = permById.get(reqId)?.name ?? reqId;
        cascadeReqId = reqId;
      }
    }

    setCells(next);
    if (cascadeReqId) triggerPunchBar(roleId, permId, cascadeReqId);
    announce(
      cascadeName
        ? `${permName} granted for ${roleName}. Also granted: ${cascadeName}.`
        : `${permName} granted for ${roleName}.`,
    );
    emitChange(next);
  };

  const colTemplate = `10rem repeat(${permissions.length}, minmax(3.25rem, 1fr))`;

  const moveFocus = (nr: number, np: number) => {
    const r = Math.min(Math.max(nr, 0), roles.length - 1);
    const p = Math.min(Math.max(np, 0), permissions.length - 1);
    setFocusedR(r);
    setFocusedP(p);
    cellRefs.current.get(key(roles[r].id, permissions[p].id))?.focus();
  };

  const onGridKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        moveFocus(focusedR, focusedP + 1);
        return;
      case "ArrowLeft":
        e.preventDefault();
        moveFocus(focusedR, focusedP - 1);
        return;
      case "ArrowDown":
        e.preventDefault();
        moveFocus(focusedR + 1, focusedP);
        return;
      case "ArrowUp":
        e.preventDefault();
        moveFocus(focusedR - 1, focusedP);
        return;
      case "Home":
        e.preventDefault();
        moveFocus(focusedR, 0);
        return;
      case "End":
        e.preventDefault();
        moveFocus(focusedR, permissions.length - 1);
        return;
      default:
        return;
    }
  };

  return (
    <div className={`ns-pp-root w-full ${className}`}>
      <style>{`
        @keyframes ns-pp-patch-in {
          from { transform: translateX(7px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .ns-pp-patch-in { animation: ns-pp-patch-in 200ms cubic-bezier(0,0,0.2,1) both; }
        @keyframes ns-pp-chad {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(10px); opacity: 0; }
        }
        .ns-pp-chad { animation: ns-pp-chad 200ms cubic-bezier(0.4,0,1,1) both; }
        @keyframes ns-pp-bar {
          from { transform: scaleX(0); opacity: 0.9; }
          65% { opacity: 0.9; }
          to { transform: scaleX(1); opacity: 0; }
        }
        .ns-pp-bar { animation: ns-pp-bar 320ms cubic-bezier(0.16,1,0.3,1) both; transform-origin: left center; }
        @media (prefers-reduced-motion: reduce) {
          .ns-pp-patch-in, .ns-pp-chad, .ns-pp-bar { animation: none !important; }
        }
      `}</style>

      <p className="mb-2 font-mono text-xs tracking-widest text-ns-muted uppercase">{label}</p>

      <div className="w-full overflow-x-auto rounded-md border border-border">
        <div
          ref={gridWrapRef}
          role="grid"
          aria-label={label}
          onKeyDown={onGridKeyDown}
          className="relative min-w-max"
        >
          {punchBar && (
            <div
              key={punchBar.id}
              aria-hidden
              className="ns-pp-bar pointer-events-none absolute z-10 h-[3px] rounded-full bg-ns-accent/50"
              style={{ left: punchBar.left, top: punchBar.top, width: punchBar.width }}
            />
          )}

          <div role="row" className="grid border-b border-border" style={{ gridTemplateColumns: colTemplate }}>
            <div role="columnheader" className="border-r border-border">
              <span className="sr-only">Role</span>
            </div>
            {permissions.map((perm) => (
              <div
                key={perm.id}
                role="columnheader"
                className="border-r border-border px-2 py-2 text-center font-mono text-[10px] leading-tight tracking-wide text-ns-muted uppercase last:border-r-0"
              >
                {perm.name}
              </div>
            ))}
          </div>

          {roles.map((role, r) => (
            <div
              key={role.id}
              role="row"
              className="grid border-b border-border last:border-b-0"
              style={{ gridTemplateColumns: colTemplate }}
            >
              <div
                role="rowheader"
                className="flex items-center border-r border-border px-3 py-2 text-sm text-foreground"
              >
                {role.name}
              </div>
              {permissions.map((perm, p) => {
                const k = key(role.id, perm.id);
                const from = inheritedMap.get(k);
                const isInherited = from !== undefined;
                const cell = cells.get(k) ?? { granted: false, patched: false };
                const isTabbable = r === focusedR && p === focusedP;
                const tipId = `${baseId}-tip-${role.id}-${perm.id}`;
                const showChad = !reduced && cell.granted && chadEverRef.current.has(k);

                if (isInherited) {
                  return (
                    <div
                      key={perm.id}
                      role="gridcell"
                      className="border-r border-border last:border-r-0"
                    >
                      <button
                        ref={(el) => {
                          if (el) cellRefs.current.set(k, el);
                          else cellRefs.current.delete(k);
                        }}
                        type="button"
                        role="checkbox"
                        aria-checked="true"
                        aria-disabled="true"
                        aria-label={`${role.name}: ${perm.name}`}
                        aria-describedby={tipId}
                        className="group relative flex h-12 w-full cursor-default items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ns-accent"
                        tabIndex={isTabbable ? 0 : -1}
                        onFocus={() => {
                          setFocusedR(r);
                          setFocusedP(p);
                        }}
                      >
                        <svg width={26} height={26} viewBox="0 0 40 40" aria-hidden className="shrink-0" style={{ pointerEvents: "none" }}>
                          <circle cx={20} cy={20} r={9} fill="var(--background)" stroke="var(--foreground)" strokeWidth={1.5} opacity={0.85} />
                          <circle cx={20} cy={20} r={3} fill="none" stroke="var(--foreground)" strokeWidth={1} opacity={0.5} />
                        </svg>
                        <span
                          id={tipId}
                          role="tooltip"
                          className="pointer-events-none absolute top-full left-1/2 z-20 mt-1 w-max max-w-[9rem] -translate-x-1/2 rounded-sm border border-border bg-background px-1.5 py-1 text-left text-[10px] leading-tight text-foreground opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                        >
                          Inherited from {from}
                        </span>
                      </button>
                    </div>
                  );
                }

                const describedBy = !cell.granted && cell.patched ? patchedDescId : undefined;

                return (
                  <div
                    key={perm.id}
                    role="gridcell"
                    className="border-r border-border last:border-r-0"
                  >
                    <button
                      ref={(el) => {
                        if (el) cellRefs.current.set(k, el);
                        else cellRefs.current.delete(k);
                      }}
                      type="button"
                      role="checkbox"
                      aria-checked={cell.granted}
                      aria-label={`${role.name}: ${perm.name}`}
                      aria-describedby={describedBy}
                      data-pp-idx={r * permissions.length + p}
                      tabIndex={isTabbable ? 0 : -1}
                      onFocus={() => {
                        setFocusedR(r);
                        setFocusedP(p);
                      }}
                      onClick={() => toggle(role.id, role.name, perm.id)}
                      className="flex h-12 w-full items-center justify-center transition-colors duration-150 hover:bg-border/30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ns-accent"
                    >
                      <svg width={26} height={26} viewBox="0 0 40 40" aria-hidden className="shrink-0" style={{ pointerEvents: "none" }}>
                        <circle
                          cx={20}
                          cy={20}
                          r={10}
                          fill="none"
                          stroke="var(--foreground)"
                          strokeWidth={1}
                          strokeDasharray="2.5 3"
                          opacity={0.28}
                        />
                        {cell.patched && (
                          <g className={reduced ? undefined : "ns-pp-patch-in"}>
                            <rect x={12} y={12} width={18} height={18} rx={3} fill="var(--foreground)" opacity={0.22} />
                            <rect x={11} y={11} width={18} height={18} rx={3} fill="var(--ns-muted)" />
                            <path d="M12.5 16 L12.5 12 L16.5 12" fill="none" stroke="var(--foreground)" strokeWidth={1} strokeLinecap="round" opacity={0.4} />
                            <path d="M27.5 24 L27.5 28 L23.5 28" fill="none" stroke="var(--foreground)" strokeWidth={1} strokeLinecap="round" opacity={0.4} />
                          </g>
                        )}
                        <circle
                          data-pp-hole={cell.granted ? "" : undefined}
                          cx={20}
                          cy={20}
                          r={cell.patched ? 6 : 8}
                          fill="var(--background)"
                          // A hole cut in bare card stock is background-on-
                          // background: without an edge, a granted cell renders
                          // pixel-identical to an ungranted one at rest (the
                          // patched case reads only because the patch behind it
                          // is --ns-muted). The rim is what makes the punch a
                          // punch on every cell, not just the patched ones.
                          stroke="var(--foreground)"
                          strokeWidth={1.5}
                          style={{
                            transformBox: "fill-box",
                            transformOrigin: "center",
                            transform: cell.granted ? "scale(1)" : "scale(0)",
                            opacity: cell.granted ? 1 : 0,
                            transition: reduced
                              ? "none"
                              : "transform 160ms cubic-bezier(0.3,0.9,0.4,1), opacity 130ms linear",
                          }}
                        />
                        {showChad && (
                          <circle key="chad" className="ns-pp-chad" cx={20} cy={20} r={3} fill="var(--ns-muted)" />
                        )}
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <span id={patchedDescId} className="sr-only">
        Previously granted, later revoked.
      </span>
      <div ref={liveRef} role="status" aria-live="polite" className="sr-only" />
    </div>
  );
}
