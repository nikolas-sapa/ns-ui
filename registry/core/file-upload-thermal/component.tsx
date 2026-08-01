"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// UpdraftDropzone — file dropzone as a thermal field. Dragging a file over
// the zone spawns rising accent convection wisps on a canvas 2D layer (over
// the control, behind the copy). Accepted drops buoy upward off the drop
// point as DOM chips with damped sway, then squash-land into a docked queue
// rack; rejected files sink 40px and fade. Accept vs reject is felt
// physically, instantly. Direct-DOM rAF that sleeps when every chip is
// docked and every wisp is dead; wisp ink is derived from CSS tokens at
// mount and re-derived live on documentElement class changes.
// ---------------------------------------------------------------------------

// wisps
const SPAWN_RATE = 18; // wisps per second while dragging over
const WISP_CAP = 30; // max live wisps
const WISP_RISE_MIN = 30; // px/s
const WISP_RISE_MAX = 60; // px/s
const WISP_WOBBLE_AMP = 6; // px
const WISP_WOBBLE_PERIOD = 1.2; // s
const WISP_LIFE_MIN = 1.5; // s
const WISP_LIFE_MAX = 2.5; // s
const WISP_ALPHA = 0.12; // peak alpha, from --accent
// accepted-chip flight
const BUOYANCY = 900; // px/s^2 upward boost
const BUOY_T = 0.18; // boost window s
const FLY_K = 70; // spring pull toward dock slot s^-2
const FLY_ZETA = 0.95; // linear drag (near-critical)
const SWAY_AMP = 10; // px
const SWAY_HZ = 2;
const SWAY_DECAY = 6.28; // zeta~0.5 envelope at 2 Hz: exp(-zeta*omega*t)
const SETTLE_DEADLINE = 1.4; // forced-settle per chip s
const STAGGER_MS = 90; // multi-drop launch stagger
// landing squash
const SQUASH_S = 0.88;
const SQUASH_HOLD = 0.12; // s at full squash
const SQUASH_K = 300; // s^-2
const SQUASH_ZETA = 0.6;
// rejected-chip sink
const SINK_G = 600; // px/s^2
const SINK_DIST = 40; // px
const SINK_FADE = 0.5; // s

type Vec3 = readonly [number, number, number];

interface Wisp {
  x: number;
  y: number;
  vy: number;
  phase: number;
  len: number;
  life: number;
  age: number;
}
interface Flight {
  el: HTMLElement;
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  t: number; // negative during stagger wait
  phase: "fly" | "squash";
  squashT: number;
  s: number;
  sv: number;
}
interface SinkState {
  id: string;
  vy: number;
  dy: number;
  age: number;
}

export interface UpdraftFile {
  id: string;
  name: string;
  size: number;
  type: string;
}
interface RejectChip {
  id: string;
  name: string;
  x: number;
  y: number;
}

function parseColor(raw: string): Vec3 | null {
  const s = raw.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex.slice(0, 1) + hex.slice(0, 1), 16);
      const g = parseInt(hex.slice(1, 2) + hex.slice(1, 2), 16);
      const b = parseInt(hex.slice(2, 3) + hex.slice(2, 3), 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    return null;
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  // non-hex/rgb tokens (oklch(), hsl(), lab(), color(), named colors, …) —
  // let the browser normalize the value instead of regexing every possible
  // CSS color syntax: write it into a throwaway element and read back
  // getComputedStyle(...).color, which browsers always resolve to rgb()/rgba().
  if (typeof document === "undefined") return null;
  const probe = document.createElement("span");
  probe.style.color = s;
  if (!probe.style.color) return null; // invalid value, not just an unhandled format
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  const m2 = resolved.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m2 ? [Number(m2[1]), Number(m2[2]), Number(m2[3])] : null;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function acceptSummary(accept: string[]): string {
  if (accept.length === 0) return "Any file type";
  return accept
    .map((a) => (a.startsWith(".") ? a.slice(1).toUpperCase() : a))
    .join(", ");
}

function typeIconPath(name: string, type: string): ReactNode {
  const lower = name.toLowerCase();
  if (type.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/.test(lower)) {
    return (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.5-3.5a2 2 0 0 0-3 0L6 20" />
      </>
    );
  }
  if (type === "application/pdf" || /\.(pdf|docx?|txt|md|log)$/.test(lower)) {
    return (
      <>
        <path d="M14 3v4a1 1 0 0 0 1 1h4" />
        <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
        <path d="M9 13h6M9 17h4" />
      </>
    );
  }
  return (
    <>
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
    </>
  );
}

export function UpdraftDropzone({
  defaultFiles = [],
  accept = [],
  maxSizeBytes = 8 * 1024 * 1024,
  onFilesChange,
  className = "",
  "aria-label": ariaLabel = "Upload files",
}: {
  /** files shown pre-docked in the queue rack */
  defaultFiles?: { name: string; size: number; type: string }[];
  /** allowed types: extensions (".png") or mime ("image/png", "image/*"); empty = any */
  accept?: string[];
  maxSizeBytes?: number;
  onFilesChange?: (files: UpdraftFile[]) => void;
  className?: string;
  "aria-label"?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chipEls = useRef(new Map<string, HTMLLIElement>());
  const idSeq = useRef(0);
  const dragDepth = useRef(0);
  const reducedRef = useRef(false);
  const pendingRef = useRef<
    { id: string; cx: number; cy: number; delay: number }[]
  >([]);
  const engineRef = useRef<{
    setDrag: (on: boolean) => void;
    dragPoint: (clientX: number) => void;
    fly: (el: HTMLElement, cx: number, cy: number, delayMs: number) => void;
    sink: (el: HTMLElement, id: string) => void;
  } | null>(null);

  const [files, setFiles] = useState<UpdraftFile[]>(() =>
    defaultFiles.map((f, i) => ({ ...f, id: `uf-d${i}` }))
  );
  const [rejects, setRejects] = useState<RejectChip[]>([]);
  const [isOver, setIsOver] = useState(false);
  const [announce, setAnnounce] = useState("");
  const hintId = useId();
  const liveId = useId();

  // -- engine: wisp canvas + chip physics, direct-DOM only ------------------
  useEffect(() => {
    const root = rootRef.current;
    const zone = zoneRef.current;
    const canvas = canvasRef.current;
    if (!root || !zone || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    reducedRef.current = reduced;

    // token-derived ink: read at mount, re-derived on theme class change
    let accentInk: Vec3 = [0, 107, 255];
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      accentInk = parseColor(cs.getPropertyValue("--accent")) ?? accentInk;
    };
    derive();

    // hot-path state: locals only, never React state
    let w = 0;
    let h = 0;
    let dpr = 1;
    let sized = false;
    let raf = 0;
    let last = 0;
    let visible = true;
    let dragging = false;
    let dragLeft = 0; // cached zone rect left while dragging
    let pointerX = -1; // canvas-local, -1 = unknown
    let spawnAcc = 0;
    let inkOn = false; // canvas has pixels that need a final clear
    const wisps: Wisp[] = [];
    const flights = new Map<HTMLElement, Flight>();
    const sinks = new Map<HTMLElement, SinkState>();

    const finishSink = (id: string) =>
      setRejects((rs) => rs.filter((r) => r.id !== id));

    const clearCanvas = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
    };

    const resize = () => {
      const rect = zone.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) {
        sized = false; // zero-size guard — never spawn into nothing
        return;
      }
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      // canvas is a replaced element — inset alone does not size it
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      sized = true;
      clearCanvas();
    };
    resize();

    const settleChip = (f: Flight) => {
      f.el.style.transform = "";
      f.el.style.transformOrigin = "";
      f.el.style.opacity = "";
      f.el.style.zIndex = "";
      f.el.style.willChange = "";
      flights.delete(f.el);
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) {
        last = 0;
        return; // paused offscreen/hidden — wake() resumes
      }
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      let active = false;

      // -- wisps: pruned array, full clear + redraw every frame -------------
      if (sized) {
        if (dragging) {
          spawnAcc += SPAWN_RATE * dt;
          while (spawnAcc >= 1) {
            spawnAcc -= 1;
            if (wisps.length >= WISP_CAP) continue;
            // bias spawn toward the dragged pointer's column
            const cx = pointerX >= 0 ? pointerX : w / 2;
            const x =
              Math.random() < 0.7
                ? Math.min(w - 2, Math.max(2, cx + (Math.random() - 0.5) * 140))
                : Math.random() * w;
            wisps.push({
              x,
              y: h - 2 - Math.random() * 10,
              vy: -(WISP_RISE_MIN + Math.random() * (WISP_RISE_MAX - WISP_RISE_MIN)),
              phase: Math.random() * Math.PI * 2,
              len: 10 + Math.random() * 8,
              life: WISP_LIFE_MIN + Math.random() * (WISP_LIFE_MAX - WISP_LIFE_MIN),
              age: 0,
            });
          }
          active = true;
        }
        if (wisps.length > 0) {
          clearCanvas();
          inkOn = true;
          ctx.lineCap = "round";
          ctx.lineWidth = 1.5;
          for (let i = wisps.length - 1; i >= 0; i--) {
            const wp = wisps[i];
            if (!wp) continue;
            wp.age += dt;
            wp.y += wp.vy * dt;
            if (wp.age >= wp.life || wp.y + wp.len < 0) {
              wisps.splice(i, 1);
              continue;
            }
            const xd =
              wp.x +
              WISP_WOBBLE_AMP *
                Math.sin((wp.age / WISP_WOBBLE_PERIOD) * Math.PI * 2 + wp.phase);
            const a = WISP_ALPHA * Math.sin((Math.PI * wp.age) / wp.life);
            ctx.strokeStyle = `rgba(${accentInk[0]},${accentInk[1]},${accentInk[2]},${a.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(xd, wp.y);
            ctx.quadraticCurveTo(xd + 3, wp.y + wp.len * 0.5, xd, wp.y + wp.len);
            ctx.stroke();
          }
          active = true;
        } else if (inkOn) {
          clearCanvas(); // one explicit final clear, then the layer is inert
          inkOn = false;
        }
      }

      // -- accepted-chip flights: OFFSET transforms toward the dock slot ----
      for (const f of flights.values()) {
        if (!f.el.isConnected) {
          flights.delete(f.el);
          continue;
        }
        active = true;
        f.t += dt;
        if (f.t < 0) continue; // stagger wait, chip hidden at drop offset
        if (f.phase === "fly") {
          if (f.el.style.opacity !== "1") f.el.style.opacity = "1";
          const c = 2 * FLY_ZETA * Math.sqrt(FLY_K);
          const boost = f.t < BUOY_T ? BUOYANCY : 0;
          f.vx += (-FLY_K * f.ox - c * f.vx) * dt;
          f.vy += (-FLY_K * f.oy - c * f.vy - boost) * dt;
          f.ox += f.vx * dt;
          f.oy += f.vy * dt;
          const arrived =
            Math.abs(f.ox) < 1 &&
            Math.abs(f.oy) < 1 &&
            Math.abs(f.vx) + Math.abs(f.vy) < 24;
          if (arrived || f.t >= SETTLE_DEADLINE) {
            // forced-settle deadline — a chip never hovers past 1.4s
            f.phase = "squash";
            f.squashT = 0;
            f.s = SQUASH_S;
            f.sv = 0;
            f.el.style.transformOrigin = "50% 100%";
            f.el.style.transform = `scaleY(${SQUASH_S})`;
          } else {
            const sway =
              SWAY_AMP *
              Math.exp(-SWAY_DECAY * f.t) *
              Math.sin(Math.PI * 2 * SWAY_HZ * f.t);
            f.el.style.transform = `translate3d(${(f.ox + sway).toFixed(2)}px, ${f.oy.toFixed(2)}px, 0)`;
          }
        } else {
          f.squashT += dt;
          if (f.squashT >= SQUASH_HOLD) {
            const c = 2 * SQUASH_ZETA * Math.sqrt(SQUASH_K);
            f.sv += (-SQUASH_K * (f.s - 1) - c * f.sv) * dt;
            f.s += f.sv * dt;
            if (Math.abs(f.s - 1) < 0.004 && Math.abs(f.sv) < 0.08) {
              settleChip(f);
              continue;
            }
          }
          f.el.style.transform = `scaleY(${f.s.toFixed(4)})`;
        }
      }

      // -- rejected-chip sinks ----------------------------------------------
      for (const [el, s] of sinks) {
        if (!el.isConnected) {
          sinks.delete(el);
          continue;
        }
        s.age += dt;
        s.vy += SINK_G * dt;
        s.dy = Math.min(SINK_DIST, s.dy + s.vy * dt);
        el.style.transform = `translate3d(0, ${s.dy.toFixed(2)}px, 0)`;
        el.style.opacity = Math.max(0, 1 - s.age / SINK_FADE).toFixed(3);
        if (s.age >= SINK_FADE) {
          sinks.delete(el);
          finishSink(s.id);
        } else {
          active = true;
        }
      }

      if (active) raf = requestAnimationFrame(loop);
      else last = 0; // sleep — all chips docked, all wisps dead
    };

    const wake = () => {
      if (!raf && !reduced) raf = requestAnimationFrame(loop);
    };

    engineRef.current = {
      setDrag: (on) => {
        if (reduced) return; // static token-border highlight only
        dragging = on;
        if (on) {
          dragLeft = zone.getBoundingClientRect().left;
          spawnAcc = 0;
          wake();
        }
      },
      dragPoint: (clientX) => {
        pointerX = clientX - dragLeft;
      },
      fly: (el, cx, cy, delayMs) => {
        if (reduced) return; // chips appear docked instantly
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return; // zero-size guard — dock instantly
        const f: Flight = {
          el,
          ox: cx - (r.left + r.width / 2),
          oy: cy - (r.top + r.height / 2),
          vx: 0,
          vy: 0,
          t: -delayMs / 1000,
          phase: "fly",
          squashT: 0,
          s: 1,
          sv: 0,
        };
        el.style.willChange = "transform";
        el.style.zIndex = "20";
        el.style.opacity = delayMs > 0 ? "0" : "1";
        el.style.transform = `translate3d(${f.ox.toFixed(2)}px, ${f.oy.toFixed(2)}px, 0)`;
        flights.set(el, f);
        wake();
      },
      sink: (el, id) => {
        if (sinks.has(el)) return;
        sinks.set(el, { id, vy: 0, dy: 0, age: 0 });
        wake();
      },
    };

    const ro = new ResizeObserver(resize);
    ro.observe(zone);
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
    });
    io.observe(root);
    // live theme re-derive: watch documentElement class flips
    const mo = new MutationObserver(derive);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    const onVis = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      wisps.length = 0;
      flights.clear();
      sinks.clear();
      engineRef.current = null;
    };
  }, []);

  // -- landing-card autoplay bridge -----------------------------------------
  // The component's only live interaction is the native HTML5 drag/drop API
  // (dragenter/dragover/dragleave/drop with a real DataTransfer) — there is
  // no pointer/hover/press affordance to synthesize against, so the shared
  // autoplay driver (which only dispatches Pointer/Mouse events) cannot
  // reach it as-is. This bridges the driver's synthetic pointer sweep into
  // the exact same setDrag/dragPoint calls the real dragenter/dragover
  // handlers already make, and — on the synthetic "leave" that closes each
  // sweep — into the exact same processFiles() the real onDrop handler
  // calls, with a File built via the standard constructible DataTransfer.
  // No new animation or state machine: every visual (wisps, border, the
  // buoy-and-dock flight) is the engine that already exists for real drops.
  // Native listeners (not React props) mirror the pattern this repo already
  // uses for driver-driven hover (dock-cursor-magnify's
  // addEventListener("pointerleave", ...)) so the driver's directly-
  // dispatched, non-bubbling pointerleave is caught reliably.
  // Gated on [data-autoplay-root]: the preview route only ever stamps that
  // attribute for `embed=1&autoplay=1` cards, so a real mouse hover on
  // /preview/file-upload-thermal (or plain ?embed=1) never wires this up and
  // behaves exactly as before.
  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone || !zone.closest("[data-autoplay-root]")) return;
    let dragging = false;
    const baseline = () => defaultFiles.map((f, i) => ({ ...f, id: `uf-d${i}` }));
    const onMove = (e: PointerEvent) => {
      if (!dragging) {
        dragging = true;
        setIsOver(true);
        engineRef.current?.setDrag(true);
      }
      engineRef.current?.dragPoint(e.clientX);
    };
    const onLeave = () => {
      if (!dragging) return;
      dragging = false;
      setIsOver(false);
      engineRef.current?.setDrag(false);
      // bound growth: clear the chip the *previous* sweep dropped before
      // adding this sweep's — so a chip stays docked and visible for a
      // full cycle (not just the ~300ms rest beat) and a card left running
      // never accumulates chips.
      setFiles(baseline());
      onFilesChange?.(baseline());
      // demo "drop": a synthetic accepted file rides the same buoy-and-dock
      // flight a real drop uses, via the same processFiles() a real onDrop
      // calls — accept-types validation runs on it exactly as it would on
      // a real file.
      const dt = new DataTransfer();
      dt.items.add(new File(["demo"], "render-log.txt", { type: "text/plain" }));
      processFiles(dt.files, null);
    };
    zone.addEventListener("pointermove", onMove);
    zone.addEventListener("pointerleave", onLeave);
    return () => {
      zone.removeEventListener("pointermove", onMove);
      zone.removeEventListener("pointerleave", onLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultFiles]);

  // launch flights for freshly docked chips — layout effect so the offset
  // transform lands before paint (no flash of the chip already docked)
  useLayoutEffect(() => {
    const pend = pendingRef.current;
    if (pend.length === 0) return;
    pendingRef.current = [];
    for (const p of pend) {
      const el = chipEls.current.get(p.id);
      if (el) engineRef.current?.fly(el, p.cx, p.cy, p.delay);
    }
  }, [files]);

  const validate = (file: File): string | null => {
    if (file.size > maxSizeBytes)
      return `exceeds the ${formatSize(maxSizeBytes)} limit`;
    if (accept.length > 0) {
      const lower = file.name.toLowerCase();
      const ok = accept.some((a) => {
        const s = a.trim().toLowerCase();
        if (s.startsWith(".")) return lower.endsWith(s);
        if (s.endsWith("/*")) return file.type.startsWith(s.slice(0, -1));
        return file.type === s;
      });
      if (!ok) return "file type not accepted";
    }
    return null;
  };

  const processFiles = (
    list: FileList | null,
    point: { x: number; y: number } | null
  ) => {
    if (!list || list.length === 0) return;
    const zr = zoneRef.current?.getBoundingClientRect();
    const px = point?.x ?? (zr ? zr.left + zr.width / 2 : 0);
    const py = point?.y ?? (zr ? zr.top + zr.height / 2 : 0);
    const accepted: UpdraftFile[] = [];
    const newRejects: RejectChip[] = [];
    const messages: string[] = [];
    for (const file of Array.from(list)) {
      const reason = validate(file);
      if (reason === null) {
        accepted.push({
          id: `uf-${idSeq.current++}`,
          name: file.name,
          size: file.size,
          type: file.type,
        });
      } else {
        messages.push(`${file.name} rejected — ${reason}`);
        if (!reducedRef.current && zr) {
          newRejects.push({
            id: `rj-${idSeq.current++}`,
            name: file.name,
            x: Math.min(zr.width - 8, Math.max(8, px - zr.left)),
            y: Math.min(zr.height - 8, Math.max(8, py - zr.top)),
          });
        }
      }
    }
    if (accepted.length > 0) {
      if (!reducedRef.current) {
        pendingRef.current.push(
          ...accepted.map((f, i) => ({
            id: f.id,
            cx: px,
            cy: py,
            delay: i * STAGGER_MS, // stagger so flights never overlap
          }))
        );
      }
      const next = [...files, ...accepted];
      setFiles(next);
      onFilesChange?.(next);
      messages.push(...accepted.map((f) => `${f.name} added`));
    }
    if (newRejects.length > 0) setRejects((rs) => [...rs, ...newRejects]);
    if (messages.length > 0) setAnnounce(messages.join(". "));
  };

  const removeFile = (id: string) => {
    const i = files.findIndex((f) => f.id === id);
    if (i === -1) return;
    const removed = files[i];
    const neighbor = files[i + 1] ?? files[i - 1];
    const next = files.filter((f) => f.id !== id);
    setFiles(next);
    onFilesChange?.(next);
    if (removed) setAnnounce(`${removed.name} removed`);
    queueMicrotask(() => {
      (neighbor
        ? chipEls.current.get(neighbor.id)
        : zoneRef.current
      )?.focus();
    });
  };

  const openPicker = () => inputRef.current?.click();

  const onZoneKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  };
  const dragHasFiles = (e: DragEvent<HTMLDivElement>) =>
    Array.from(e.dataTransfer?.types ?? []).includes("Files");

  const onDragEnter = (e: DragEvent<HTMLDivElement>) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    if (dragDepth.current === 1) {
      setIsOver(true);
      engineRef.current?.setDrag(true);
    }
  };
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    engineRef.current?.dragPoint(e.clientX);
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) {
      setIsOver(false);
      engineRef.current?.setDrag(false);
    }
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setIsOver(false);
    engineRef.current?.setDrag(false);
    processFiles(e.dataTransfer?.files ?? null, {
      x: e.clientX,
      y: e.clientY,
    });
  };

  const hint = `${acceptSummary(accept)} · max ${formatSize(maxSizeBytes)}`;

  return (
    <div ref={rootRef} className={`flex flex-col gap-3 ${className}`}>
      <div
        ref={zoneRef}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-describedby={hintId}
        onClick={openPicker}
        onKeyDown={onZoneKey}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`relative flex min-h-[8.5rem] cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-md border border-dashed px-6 py-8 text-center outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          isOver
            ? "border-accent bg-accent/[0.05]"
            : "border-border bg-surface hover:border-foreground/25"
        }`}
      >
        <canvas
          ref={canvasRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0"
        />
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`relative z-[1] h-5 w-5 transition-colors duration-200 ${
            isOver ? "text-accent" : "text-muted"
          }`}
        >
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M4 20h16" />
        </svg>
        <p className="relative z-[1] text-sm text-foreground">
          Drop files to attach, or{" "}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openPicker();
            }}
            className="rounded-[4px] font-medium text-accent underline-offset-2 outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            browse
          </button>
        </p>
        <p
          id={hintId}
          className="relative z-[1] font-mono text-[11px] tracking-wide text-muted"
        >
          {hint}
        </p>

        {/* rejected files sink and fade inside the zone */}
        {rejects.map((r) => (
          <div
            key={r.id}
            aria-hidden
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: r.x, top: r.y }}
          >
            <div
              ref={(el) => {
                if (el) engineRef.current?.sink(el, r.id);
              }}
              className="flex max-w-[11rem] items-center gap-1.5 rounded-sm border border-border bg-background px-2 py-1 shadow-sm"
            >
              <span className="truncate text-[11px] text-muted line-through">
                {r.name}
              </span>
            </div>
          </div>
        ))}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept.length > 0 ? accept.join(",") : undefined}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(e) => {
          processFiles(e.target.files, null);
          e.target.value = "";
        }}
      />

      {files.length > 0 && (
        <ul role="list" aria-label="Attached files" className="flex flex-wrap gap-2">
          {files.map((f) => (
            <li
              key={f.id}
              ref={(el) => {
                if (el) chipEls.current.set(f.id, el);
                else chipEls.current.delete(f.id);
              }}
              tabIndex={0}
              aria-label={`${f.name}, ${formatSize(f.size)}. Press Delete to remove.`}
              onKeyDown={(e) => {
                if (e.key === "Delete" || e.key === "Backspace") {
                  e.preventDefault();
                  removeFile(f.id);
                }
              }}
              className="relative flex items-center gap-2 rounded-sm border border-border bg-surface py-1.5 pl-2.5 pr-1.5 outline-none transition-colors hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5 shrink-0 text-muted"
              >
                {typeIconPath(f.name, f.type)}
              </svg>
              <span className="max-w-[10rem] truncate text-xs text-foreground">
                {f.name}
              </span>
              <span className="font-mono text-[10px] text-muted">
                {formatSize(f.size)}
              </span>
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => removeFile(f.id)}
                className="rounded-[4px] p-0.5 text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
              >
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  className="h-3 w-3"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p
        id={liveId}
        role="status"
        aria-live="polite"
        className="min-h-4 font-mono text-[11px] text-muted"
      >
        {announce}
      </p>
    </div>
  );
}
