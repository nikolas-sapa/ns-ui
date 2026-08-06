"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";

// ---------------------------------------------------------------------------
// VacuumSeal — a file upload zone where progress IS the container, not a
// bar appended to it. Dropping a file spawns a loose dashed SVG rounded-rect
// outline 24px outside the card; as upload progress advances, one
// critically-damped spring per file pulls that outline inward — inset,
// dasharray, and a muted->foreground stroke crossfade all riding the same
// spring parameter — so it visibly breathes toward the card rather than
// stepping. Arrival at 100% is a real end-state: status flips to "sealed"
// and the card plays a one-shot scale(0.99) pucker-and-release. A failed
// upload targets the spring back to its loose, 24px-out rest position with
// light underdamping, so it visibly overshoots and wobbles before settling
// — the same spring engine, just less damped, drawn in --error instead of
// muted/foreground. Direct-DOM per-card rAF loops, one per uploading/sealing
// file, sleep once each has settled; pre-seeded (defaultFiles) entries never
// run the spring at all — their geometry is written once, synchronously,
// before paint.
// ---------------------------------------------------------------------------

const OUTER_GAP = 24; // px — loose outline distance at progress 0
const WOBBLE = 6; // px — extra overshoot room for the fail-relax bounce
const PAD = OUTER_GAP + WOBBLE + 4; // svg overhang each side
const CARD_RADIUS = 12; // matches the card's own rounded-md
const SEAL_K = 90; // spring constant while sealing/uploading (critically damped)
const FAIL_K = 46; // spring constant while relaxing after a failure (underdamped)
const FAIL_ZETA = 0.4;
const PUCKER_MS = 260;

type UploadStatus = "uploading" | "sealed" | "failed";

export interface VacuumSealFile {
  id: string;
  name: string;
  size: number;
  type: string;
}

interface FileEntry extends VacuumSealFile {
  status: UploadStatus;
  progress: number; // 0..1
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

function statusText(f: FileEntry): string {
  const size = formatSize(f.size);
  if (f.status === "sealed") return `${size} · sealed`;
  if (f.status === "failed") return `upload failed · ${size}`;
  return `uploading ${size}… ${Math.round(f.progress * 100)}%`;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// ---------------------------------------------------------------------------
// SealOutline — the per-card spring engine. Drives an SVG rect (or two, for
// the muted/foreground crossfade) via direct attribute writes, never React
// state. `dp` is a generalized "seal progress" spring variable: 0 = loose
// outline 24px out, 1 = flush/taut. For status "failed" the spring target is
// 0 with light underdamping, so dp is allowed to swing slightly negative —
// that alone produces the relax-with-wobble, no separate keyframe needed.
// ---------------------------------------------------------------------------
function useSealOutline(
  wrapRef: RefObject<HTMLDivElement | null>,
  svgRef: RefObject<SVGSVGElement | null>,
  mutedRef: RefObject<SVGRectElement | null>,
  fgRef: RefObject<SVGRectElement | null>,
  errRef: RefObject<SVGRectElement | null>,
  status: UploadStatus,
  progress: number,
  reduced: boolean,
  frozen: boolean // pre-seeded entries: write geometry once, never spring
) {
  const dpRef = useRef(status === "sealed" ? 1 : status === "failed" ? 0 : progress);
  const vRef = useRef(0);
  const wRef = useRef(0);
  const hRef = useRef(0);
  const rafRef = useRef(0);
  const lastRef = useRef(0);

  const applyGeom = useCallback(() => {
    const w = wRef.current;
    const h = hRef.current;
    if (w < 1 || h < 1) return;
    const dp = dpRef.current;
    const offset = clamp(OUTER_GAP * (1 - dp), 0, OUTER_GAP + WOBBLE);
    const rx = CARD_RADIUS + offset * 0.55;
    const x = PAD - offset;
    const y = PAD - offset;
    const rw = Math.max(0, w + offset * 2);
    const rh = Math.max(0, h + offset * 2);
    const svg = svgRef.current;
    if (svg) {
      svg.setAttribute("width", String(w + PAD * 2));
      svg.setAttribute("height", String(h + PAD * 2));
    }
    const pC = clamp(dp, 0, 1);
    const dashLen = (8 - 7 * pC).toFixed(2);
    const gapLen = (4 - 4 * pC).toFixed(2);
    for (const r of [mutedRef.current, fgRef.current, errRef.current]) {
      if (!r) continue;
      r.setAttribute("x", x.toFixed(2));
      r.setAttribute("y", y.toFixed(2));
      r.setAttribute("width", rw.toFixed(2));
      r.setAttribute("height", rh.toFixed(2));
      r.setAttribute("rx", rx.toFixed(2));
    }
    if (mutedRef.current) {
      mutedRef.current.setAttribute("stroke-dasharray", `${dashLen} ${gapLen}`);
      mutedRef.current.style.opacity = String(1 - pC);
    }
    if (fgRef.current) {
      fgRef.current.setAttribute("stroke-dasharray", `${dashLen} ${gapLen}`);
      fgRef.current.style.opacity = String(pC);
    }
    // errRef keeps its fixed loose dasharray (set in markup) — only geometry moves
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // measure + write geometry synchronously before first paint — this is what
  // keeps a pre-seeded (frozen) card static at rest instead of springing in
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => {
      const rect = wrap.getBoundingClientRect();
      wRef.current = rect.width;
      hRef.current = rect.height;
      applyGeom();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (frozen) return; // pre-seeded: geometry already written once, above
    if (reduced) {
      // discrete quartile steps, no spring, no overshoot
      const target = status === "failed" ? 0 : status === "sealed" ? 1 : progress;
      dpRef.current = status === "failed" ? 0 : Math.floor(clamp(target, 0, 1) * 4) / 4;
      vRef.current = 0;
      applyGeom();
      return;
    }
    const target = status === "failed" ? 0 : status === "sealed" ? 1 : progress;
    const k = status === "failed" ? FAIL_K : SEAL_K;
    const zeta = status === "failed" ? FAIL_ZETA : 1;
    const c = 2 * zeta * Math.sqrt(k);

    const loop = (now: number) => {
      const dt = lastRef.current ? Math.min(0.05, (now - lastRef.current) / 1000) : 1 / 60;
      lastRef.current = now;
      const dp = dpRef.current;
      const err = target - dp;
      vRef.current += (k * err - c * vRef.current) * dt;
      dpRef.current = dp + vRef.current * dt;
      applyGeom();
      if (Math.abs(target - dpRef.current) < 0.0025 && Math.abs(vRef.current) < 0.01) {
        dpRef.current = target;
        vRef.current = 0;
        applyGeom();
        rafRef.current = 0;
        lastRef.current = 0;
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    lastRef.current = 0;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [status, progress, reduced, frozen, applyGeom]);
}

function FileCard({
  file,
  reduced,
  frozen,
}: {
  file: FileEntry;
  reduced: boolean;
  frozen: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const mutedRef = useRef<SVGRectElement>(null);
  const fgRef = useRef<SVGRectElement>(null);
  const errRef = useRef<SVGRectElement>(null);
  const prevStatusRef = useRef(file.status);
  const [justSealed, setJustSealed] = useState(false);
  const progId = useId();

  useSealOutline(
    wrapRef,
    svgRef,
    mutedRef,
    fgRef,
    errRef,
    file.status,
    file.progress,
    reduced,
    frozen
  );

  useEffect(() => {
    if (!frozen && !reduced && prevStatusRef.current !== "sealed" && file.status === "sealed") {
      setJustSealed(true);
    }
    prevStatusRef.current = file.status;
  }, [file.status, frozen, reduced]);

  const pct = Math.round((file.status === "sealed" ? 1 : file.progress) * 100);

  return (
    <li className="relative" style={{ margin: `${PAD - 10}px 0` }}>
      <div
        ref={wrapRef}
        data-just-sealed={justSealed || undefined}
        onAnimationEnd={() => setJustSealed(false)}
        className="ns-file-upload-seal-card relative rounded-md border border-border bg-surface"
      >
        <svg
          ref={svgRef}
          aria-hidden
          className="pointer-events-none absolute overflow-visible"
          style={{ left: -PAD, top: -PAD }}
        >
          {file.status !== "failed" ? (
            <>
              <rect
                ref={mutedRef}
                className="text-ns-muted"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              />
              <rect
                ref={fgRef}
                className="text-foreground"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              />
            </>
          ) : (
            <rect
              ref={errRef}
              fill="none"
              strokeWidth={1.5}
              strokeDasharray="8 4"
              style={{ stroke: "var(--error, #ea001d)" }}
            />
          )}
        </svg>

        <div className="relative z-[1] flex items-center gap-3 px-4 py-3">
          <span className="shrink-0 text-ns-muted" aria-hidden>
            {file.status === "sealed" ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-foreground">
                <path d="M4 12.5 9.5 18 20 6" />
              </svg>
            ) : file.status === "failed" ? (
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" style={{ stroke: "var(--error, #ea001d)" }}>
                <path d="M12 9v4M12 16.5v.01" />
                <path d="M10.3 3.9 2.6 17a1.8 1.8 0 0 0 1.55 2.7h15.7a1.8 1.8 0 0 0 1.55-2.7L13.7 3.9a1.8 1.8 0 0 0-3.4 0Z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
              </svg>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-foreground">{file.name}</p>
            <p
              id={progId}
              role="progressbar"
              aria-label={`${file.name} upload progress`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-valuetext={statusText(file)}
              className="font-mono text-[11px] text-ns-muted"
            >
              {statusText(file)}
            </p>
          </div>
        </div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// simulated upload — used whenever a consumer does not pass `uploadFile`.
// Chunky, irregular progress events (not a smooth ramp) are the point: it's
// what gives the spring something to visibly catch up to.
// ---------------------------------------------------------------------------
function simulateUpload(
  onProgress: (p: number) => void,
  onDone: (ok: boolean) => void
): () => void {
  let p = 0;
  const failAt = Math.random() < 0.16 ? 0.25 + Math.random() * 0.55 : 2; // 2 = never
  const id = setInterval(
    () => {
      p = Math.min(1, p + 0.1 + Math.random() * 0.16);
      if (p >= failAt) {
        clearInterval(id);
        onProgress(Math.min(p, 0.97));
        onDone(false);
        return;
      }
      onProgress(p);
      if (p >= 1) {
        clearInterval(id);
        onDone(true);
      }
    },
    170 + Math.random() * 110
  );
  return () => clearInterval(id);
}

export function VacuumSeal({
  defaultFiles = [],
  accept = [],
  maxSizeBytes = 25 * 1024 * 1024,
  uploadFile,
  onFilesChange,
  className = "",
  "aria-label": ariaLabel = "Upload files",
}: {
  /** files rendered already in their final state — sealed, mid-upload, or failed — at mount, with no entrance animation */
  defaultFiles?: {
    name: string;
    size: number;
    type: string;
    status?: UploadStatus;
    progress?: number;
  }[];
  /** allowed types: extensions (".png") or mime ("image/png", "image/*"); empty = any */
  accept?: string[];
  /** rejects any file larger than this. No default — unlimited. */
  maxSizeBytes?: number;
  /** perform the real upload, reporting 0..1 via onProgress; reject to fail the seal. omit to use a built-in simulated upload. */
  uploadFile?: (file: File, onProgress: (p: number) => void) => Promise<void>;
  /** called with the full file list after any add, progress update, or removal */
  onFilesChange?: (files: VacuumSealFile[]) => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** accessible name for the dropzone. Default "Upload files". */
  "aria-label"?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idSeq = useRef(0);
  const dragDepth = useRef(0);
  const cleanupsRef = useRef(new Map<string, () => void>());
  const quartileRef = useRef(new Map<string, number>());
  const frozenIdsRef = useRef(new Set<string>());

  const [files, setFiles] = useState<FileEntry[]>(() =>
    defaultFiles.map((f, i) => {
      const id = `vs-d${i}`;
      frozenIdsRef.current.add(id);
      return {
        id,
        name: f.name,
        size: f.size,
        type: f.type,
        status: f.status ?? "sealed",
        progress: f.progress ?? (f.status === "failed" ? 0 : 1),
      };
    })
  );
  const [isOver, setIsOver] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [announce, setAnnounce] = useState("");
  const hintId = useId();
  const lastNotifyKeyRef = useRef("");

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const cleanups = cleanupsRef.current;
    return () => {
      for (const stop of cleanups.values()) stop();
      cleanups.clear();
    };
  }, []);

  const publicFiles = (list: FileEntry[]): VacuumSealFile[] =>
    list.map(({ id, name, size, type }) => ({ id, name, size, type }));

  // notify from an effect, keyed on the id set (add/remove only, not every
  // progress tick) — never call a consumer's setState from inside a
  // setFiles updater, which runs during this component's own render
  useEffect(() => {
    const pub = publicFiles(files);
    const key = pub.map((f) => f.id).join(",");
    if (key !== lastNotifyKeyRef.current) {
      lastNotifyKeyRef.current = key;
      onFilesChange?.(pub);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  const startUpload = (id: string, name: string, file: File) => {
    const onProgress = (p: number) => {
      setFiles((fs) => fs.map((f) => (f.id === id ? { ...f, progress: p } : f)));
      const bucket = p >= 1 ? 4 : Math.floor(p * 4);
      const prev = quartileRef.current.get(id) ?? 0;
      if (bucket > prev && bucket > 0 && bucket < 4) {
        quartileRef.current.set(id, bucket);
        setAnnounce(`${name} ${bucket * 25}% uploaded`);
      }
    };
    const finalize = (ok: boolean) => {
      cleanupsRef.current.delete(id);
      setFiles((fs) =>
        fs.map((f) =>
          f.id === id ? { ...f, status: ok ? "sealed" : "failed", progress: ok ? 1 : f.progress } : f
        )
      );
      setAnnounce(ok ? `${name} sealed` : `${name} upload failed`);
    };
    if (uploadFile) {
      let live = true;
      uploadFile(file, (p) => live && onProgress(p)).then(
        () => live && finalize(true),
        () => live && finalize(false)
      );
      cleanupsRef.current.set(id, () => {
        live = false;
      });
    } else {
      const stop = simulateUpload(onProgress, finalize);
      cleanupsRef.current.set(id, stop);
    }
  };

  const validate = (file: File): string | null => {
    if (file.size > maxSizeBytes) return `exceeds the ${formatSize(maxSizeBytes)} limit`;
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

  const processFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const accepted: FileEntry[] = [];
    const messages: string[] = [];
    for (const file of Array.from(list)) {
      const reason = validate(file);
      if (reason !== null) {
        messages.push(`${file.name} rejected — ${reason}`);
        continue;
      }
      const id = `vs-${idSeq.current++}`;
      accepted.push({
        id,
        name: file.name,
        size: file.size,
        type: file.type,
        status: "uploading",
        progress: 0,
      });
      startUpload(id, file.name, file);
    }
    if (accepted.length > 0) {
      setFiles((fs) => [...fs, ...accepted]);
      messages.push(...accepted.map((f) => `${f.name} added`));
    }
    if (messages.length > 0) setAnnounce(messages.join(". "));
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
    if (dragDepth.current === 1) setIsOver(true);
  };
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsOver(false);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setIsOver(false);
    processFiles(e.dataTransfer?.files ?? null);
  };

  // -- landing-card autoplay bridge -----------------------------------------
  // Mirrors file-upload-thermal's pattern: the shared pointer-path driver only
  // dispatches Pointer/Mouse events, so a sweep across the zone is bridged
  // into a synthetic drop on its "leave" (sweep-closing) edge, via the exact
  // same processFiles() a real onDrop calls with a File built through the
  // standard constructible DataTransfer. Every visual — outline appearing,
  // spring-tightening, pucker, or fail-wobble — is the real engine above;
  // nothing autoplay-specific is animated. Bounded: the previous demo file
  // is cleared before the next is added, so a card left running never
  // accumulates rows. Gated on [data-autoplay-root], stamped only for
  // embed=1&autoplay=1, so a real hover on /preview/file-upload-seal never wires
  // this up.
  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone || !zone.closest("[data-autoplay-root]")) return;
    let dragging = false;
    let demoId: string | null = null;
    const onEnter = () => {
      dragging = true;
      setIsOver(true);
    };
    const onLeave = () => {
      if (!dragging) return;
      dragging = false;
      setIsOver(false);
      if (demoId) {
        const closing = demoId;
        cleanupsRef.current.get(closing)?.();
        cleanupsRef.current.delete(closing);
        setFiles((fs) => fs.filter((f) => f.id !== closing));
      }
      const dt = new DataTransfer();
      dt.items.add(new File(["demo"], "quarter-report.pdf", { type: "application/pdf" }));
      // idSeq is incremented exactly once per accepted file inside
      // processFiles, synchronously and in order — capturing it just before
      // the call gives the exact id the single dropped file will receive,
      // with no need to diff file lists afterward.
      const nextId = `vs-${idSeq.current}`;
      processFiles(dt.files);
      demoId = nextId;
    };
    zone.addEventListener("pointerenter", onEnter);
    zone.addEventListener("pointerleave", onLeave);
    return () => {
      zone.removeEventListener("pointerenter", onEnter);
      zone.removeEventListener("pointerleave", onLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hint = `${acceptSummary(accept)} · max ${formatSize(maxSizeBytes)}`;

  return (
    <div ref={rootRef} className={`flex flex-col gap-2 ${className}`}>
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
        className={`relative flex min-h-[7rem] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-6 py-7 text-center outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          isOver
            ? "border-ns-accent bg-ns-accent/[0.05]"
            : "border-border bg-surface hover:border-foreground/25"
        }`}
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-5 w-5 transition-colors duration-200 ${isOver ? "text-ns-accent" : "text-ns-muted"}`}
        >
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M9 12h6M12 9v6" />
        </svg>
        <p className="text-sm text-foreground">
          Drop files to seal, or{" "}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openPicker();
            }}
            className="rounded-[4px] font-medium text-ns-accent underline-offset-2 outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            browse
          </button>
        </p>
        <p id={hintId} className="font-mono text-[11px] tracking-wide text-ns-muted">
          {hint}
        </p>
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
          processFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {files.length > 0 && (
        <ul role="list" aria-label="Uploads" className="flex flex-col">
          {files.map((f) => (
            <FileCard key={f.id} file={f} reduced={reduced} frozen={frozenIdsRef.current.has(f.id)} />
          ))}
        </ul>
      )}

      <p role="status" aria-live="polite" className="min-h-4 font-mono text-[11px] text-ns-muted">
        {announce}
      </p>

      <style>{`
        .ns-file-upload-seal-card[data-just-sealed] {
          animation: ns-file-upload-seal-pucker ${PUCKER_MS}ms cubic-bezier(0.32, 1.6, 0.5, 1) both;
        }
        @keyframes ns-file-upload-seal-pucker {
          0% { transform: scale(1); }
          40% { transform: scale(0.99); }
          100% { transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ns-file-upload-seal-card[data-just-sealed] { animation: none; }
        }
      `}</style>
    </div>
  );
}
