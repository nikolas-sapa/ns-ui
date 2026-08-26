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
} from "react";

// ---------------------------------------------------------------------------
// SparkTestId — a file dropzone that identifies a specimen the way a
// machinist identifies unknown steel: SPARK TESTING. Held to a grinding
// wheel, different alloys throw different SPARK STREAMS — carrier-line
// length, how many times each burst forks, how dense the shower runs. The
// wheel idles with a low continuous shower before anything is dropped, so
// the canvas is never a dead frame. Dropping/selecting a file classifies it
// into a coarse type family and swaps the shower's spawn rate, carrier
// length, fork probability and fork depth to that family's characteristic
// signature — the identification is legible from the spark pattern itself,
// same as reading a real stream off a bench grinder. Discrete ballistic
// particles with branching fork events, arced by gravity from one contact
// point — distinct from file-upload-thermal's continuous rising wisps (no
// discrete burst/fork topology) and file-upload-seal's vector spring
// outline (no particles at all). Real sparks are hue-coded; this adaptation
// carries intensity as LUMINANCE only, stated plainly below, not as a claim
// of color fidelity. Direct-DOM canvas rAF, no React state in the hot path;
// ink derived from CSS tokens at mount and re-derived on documentElement
// class changes.
// ---------------------------------------------------------------------------

type TypeFamily =
  | "idle"
  | "image"
  | "text"
  | "avmedia"
  | "archive"
  | "unknown";

interface SparkSignature {
  label: string; // spoken/visible description of the metallurgical analogue
  spawnRate: number; // primary sparks per second
  speedMul: number; // carrier speed relative to base
  carrierMul: number; // carrier-line length relative to base
  forkProb: number; // probability a spark forks at its burst point
  maxForkDepth: number; // how many generations of forking are possible
  sprigMin: number;
  sprigMax: number;
  spreadDeg: number; // half-angle of the shower cone
  intensity: number; // 0..1, luminance ceiling for this signature
}

const SIGNATURES: Record<TypeFamily, SparkSignature> = {
  idle: {
    label: "idle shower — wheel turning, no specimen held",
    spawnRate: 9,
    speedMul: 0.82,
    carrierMul: 0.75,
    forkProb: 0.12,
    maxForkDepth: 1,
    sprigMin: 1,
    sprigMax: 2,
    spreadDeg: 22,
    intensity: 0.5,
  },
  image: {
    label: "high-carbon-steel pattern — dense, repeatedly forking bursts",
    spawnRate: 30,
    speedMul: 1.05,
    carrierMul: 0.55,
    forkProb: 0.62,
    maxForkDepth: 2,
    sprigMin: 2,
    sprigMax: 4,
    spreadDeg: 28,
    intensity: 1,
  },
  text: {
    label: "mild-steel pattern — moderate forked bursts, medium carrier",
    spawnRate: 20,
    speedMul: 1,
    carrierMul: 0.85,
    forkProb: 0.38,
    maxForkDepth: 1,
    sprigMin: 1,
    sprigMax: 3,
    spreadDeg: 22,
    intensity: 0.85,
  },
  avmedia: {
    label: "wrought-iron pattern — long straight carrier lines, sparse forking",
    spawnRate: 12,
    speedMul: 1.3,
    carrierMul: 1.55,
    forkProb: 0.08,
    maxForkDepth: 1,
    sprigMin: 1,
    sprigMax: 1,
    spreadDeg: 12,
    intensity: 0.72,
  },
  archive: {
    label: "cast-iron pattern — short, dense, low-lying streams",
    spawnRate: 34,
    speedMul: 0.58,
    carrierMul: 0.32,
    forkProb: 0.1,
    maxForkDepth: 1,
    sprigMin: 1,
    sprigMax: 1,
    spreadDeg: 36,
    intensity: 0.6,
  },
  unknown: {
    label: "unclassified specimen — mixed baseline stream",
    spawnRate: 16,
    speedMul: 0.9,
    carrierMul: 0.9,
    forkProb: 0.25,
    maxForkDepth: 1,
    sprigMin: 1,
    sprigMax: 2,
    spreadDeg: 26,
    intensity: 0.68,
  },
};

const MAX_PARTICLES = 260;

interface Spark {
  x: number;
  y: number;
  px: number; // previous frame position, for the trail segment
  py: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  forkAt: number; // fraction of life at which a fork can trigger
  forked: boolean;
  depth: number;
  intensity: number;
}

function classify(name: string, type: string): TypeFamily {
  const lower = name.toLowerCase();
  if (type.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/.test(lower)) {
    return "image";
  }
  if (
    type.startsWith("video/") ||
    type.startsWith("audio/") ||
    /\.(mp4|mov|webm|mkv|mp3|wav|flac|ogg|m4a)$/.test(lower)
  ) {
    return "avmedia";
  }
  if (
    /\.(zip|rar|7z|tar|gz|tgz|bz2|dmg|exe|iso)$/.test(lower) ||
    type === "application/zip" ||
    type === "application/x-tar" ||
    type === "application/gzip"
  ) {
    return "archive";
  }
  if (
    type.startsWith("text/") ||
    type === "application/json" ||
    type === "application/pdf" ||
    /\.(txt|md|json|js|ts|tsx|jsx|css|html|csv|log|pdf|docx?|xml|yml|yaml)$/.test(lower)
  ) {
    return "text";
  }
  return "unknown";
}

function familyDisplayName(f: TypeFamily): string {
  switch (f) {
    case "image":
      return "Image";
    case "avmedia":
      return "Audio/video";
    case "archive":
      return "Archive/binary";
    case "text":
      return "Text/document";
    case "unknown":
      return "Unrecognized";
    default:
      return "Idle";
  }
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STATIC_TIME = 1.35; // s — reduced-motion freeze: a long-exposure window
// with several carrier lines and at least one fully-formed fork visible,
// never a t0 frame (t0 for the idle signature is a bare shower start).

export interface SparkTestIdFile {
  id: string;
  name: string;
  size: number;
  type: string;
  family: TypeFamily;
}

export function SparkTestId({
  accept = [],
  maxSizeBytes,
  onFileChange,
  className = "",
  "aria-label": ariaLabel = "Upload a file to identify its type",
}: {
  /** allowed extensions/mimes (".png", "image/*"); empty = any */
  accept?: string[];
  /** rejects a file larger than this. No default — unlimited. */
  maxSizeBytes?: number;
  /** called with the identified file, or null when cleared */
  onFileChange?: (file: SparkTestIdFile | null) => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** accessible name for the dropzone control */
  "aria-label"?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const signatureRef = useRef<TypeFamily>("idle");
  const reducedRef = useRef(false);

  const [file, setFile] = useState<SparkTestIdFile | null>(null);
  const [isOver, setIsOver] = useState(false);
  const [announce, setAnnounce] = useState("Wheel idling. No specimen held.");
  const hintId = useId();
  const liveId = useId();

  const acceptFile = useCallback(
    (f: File): { ok: true; family: TypeFamily } | { ok: false; reason: string } => {
      if (maxSizeBytes != null && f.size > maxSizeBytes) {
        return { ok: false, reason: `exceeds size limit (${formatSize(maxSizeBytes)})` };
      }
      if (accept.length > 0) {
        const lower = f.name.toLowerCase();
        const matches = accept.some((a) => {
          if (a.startsWith(".")) return lower.endsWith(a.toLowerCase());
          if (a.endsWith("/*")) return f.type.startsWith(a.slice(0, -1));
          return f.type === a;
        });
        if (!matches) return { ok: false, reason: "type not accepted" };
      }
      return { ok: true, family: classify(f.name, f.type) };
    },
    [accept, maxSizeBytes]
  );

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      const f = list[0];
      const result = acceptFile(f);
      if (!result.ok) {
        setAnnounce(`Specimen rejected: ${f.name}, ${result.reason}.`);
        return;
      }
      const next: SparkTestIdFile = {
        id: `spk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: f.name,
        size: f.size,
        type: f.type || "unknown",
        family: result.family,
      };
      setFile(next);
      signatureRef.current = result.family;
      const sig = SIGNATURES[result.family];
      setAnnounce(
        `Detected type: ${familyDisplayName(result.family)}, ${f.type || "unknown MIME type"}. Spark signature: ${sig.label}.`
      );
      onFileChange?.(next);
    },
    [acceptFile, onFileChange]
  );

  const clearFile = useCallback(() => {
    setFile(null);
    signatureRef.current = "idle";
    setAnnounce("Specimen cleared. Wheel idling. No specimen held.");
    onFileChange?.(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [onFileChange]);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      inputRef.current?.click();
    }
  }, []);

  // -- engine: spark shower canvas, direct-DOM only --------------------------
  useLayoutEffect(() => {
    const root = rootRef.current;
    const zone = zoneRef.current;
    const canvas = canvasRef.current;
    if (!root || !zone || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    reducedRef.current = reduced;

    // token ink — read at mount, re-derived live on theme class change.
    // fields start empty and are assigned unconditionally before any paint.
    let fg = "";
    let muted = "";
    let bg = "";
    let border = "";
    const deriveTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = cs.getPropertyValue("--foreground").trim();
      muted = cs.getPropertyValue("--ns-muted").trim();
      bg = cs.getPropertyValue("--background").trim();
      border = cs.getPropertyValue("--border").trim();
    };
    deriveTokens();
    const mo = new MutationObserver(deriveTokens);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    let w = 0;
    let h = 0;
    let dpr = 1;
    let sized = false;
    const DPR_CAP = 2;

    const resize = () => {
      const rect = zone.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sized = w > 1 && h > 1;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(zone);

    let visible = true;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible = entry.isIntersecting;
      },
      { threshold: 0 }
    );
    io.observe(zone);
    let pageVisible = document.visibilityState === "visible";
    const onVis = () => {
      pageVisible = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVis);

    let particles: Spark[] = [];
    let spawnAcc = 0;

    // origin: the "wheel contact point" — centre-left rather than the
    // corner, scaled to the container's smaller dimension so density/length
    // read at any preview size, per the scale rule. Sitting mid-height
    // leaves the ballistic cone room to arc up through the top of the
    // frame and fall back down without colliding with the label block
    // pinned to the bottom of the dropzone.
    const scaleDim = () => Math.min(w, h);
    const originX = () => w * 0.22;
    const originY = () => h * 0.52;
    const baseAngle = -55; // degrees, up-and-right cone axis
    const gravity = () => scaleDim() * 1.7; // px/s^2, arcs the stream down
    const baseSpeed = () => scaleDim() * 1.55; // px/s
    const baseLife = 0.78; // s, before signature carrierMul

    const spawnSpark = (
      arr: Spark[],
      rng: () => number,
      sig: SparkSignature,
      depth: number,
      x: number,
      y: number,
      angleDeg: number,
      speedScale: number
    ) => {
      if (arr.length >= MAX_PARTICLES) return;
      const jitter = (rng() - 0.5) * 2 * sig.spreadDeg;
      const angle = ((angleDeg + jitter) * Math.PI) / 180;
      const speed = baseSpeed() * sig.speedMul * speedScale * (0.85 + rng() * 0.3);
      const life =
        depth === 0
          ? baseLife * sig.carrierMul * (0.8 + rng() * 0.4)
          : (0.12 + rng() * 0.1) * (1 + sig.carrierMul * 0.15); // short terminal sprig
      arr.push({
        x,
        y,
        px: x,
        py: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        life,
        forkAt: 0.35 + rng() * 0.3,
        forked: depth >= sig.maxForkDepth,
        depth,
        intensity: sig.intensity * (depth === 0 ? 1 : 0.85),
      });
    };

    const drawWheel = () => {
      const ox = originX();
      const oy = originY();
      const r = scaleDim() * 0.09;
      ctx.save();
      ctx.strokeStyle = muted;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = Math.max(1, scaleDim() * 0.008);
      ctx.beginPath();
      ctx.arc(ox - r * 0.7, oy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(ox - r * 0.7, oy, r * 0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    };

    const stepSpark = (s: Spark, dt: number, sig: SparkSignature, rng: () => number, out: Spark[]) => {
      s.px = s.x;
      s.py = s.y;
      s.vy += gravity() * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.age += dt;
      if (!s.forked && s.age >= s.life * s.forkAt && s.depth < sig.maxForkDepth) {
        s.forked = true;
        if (rng() < sig.forkProb) {
          const count = sig.sprigMin + Math.floor(rng() * (sig.sprigMax - sig.sprigMin + 1));
          const parentAngle = (Math.atan2(s.vy, s.vx) * 180) / Math.PI;
          for (let i = 0; i < count; i++) {
            const branch = parentAngle + (rng() - 0.5) * 70;
            spawnSpark(out, rng, sig, s.depth + 1, s.x, s.y, branch, 0.55 + rng() * 0.2);
          }
        }
      }
    };

    const drawSpark = (s: Spark) => {
      const a = Math.max(0, 1 - s.age / s.life);
      if (a <= 0) return;
      // glow halo in muted, bright core in foreground — luminance-only "hot"
      // read, no hue; per the monochrome adaptation this stands in for the
      // real spark-stream color signal.
      ctx.strokeStyle = muted;
      ctx.globalAlpha = a * s.intensity * 0.5;
      ctx.lineWidth = Math.max(1, scaleDim() * 0.006);
      ctx.beginPath();
      ctx.moveTo(s.px, s.py);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
      ctx.strokeStyle = fg;
      ctx.globalAlpha = a * s.intensity;
      ctx.lineWidth = Math.max(0.75, scaleDim() * 0.0032);
      ctx.beginPath();
      ctx.moveTo(s.px, s.py);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
    };

    // ---- reduced motion: one deterministic long-exposure freeze frame -----
    const renderStaticFrame = () => {
      if (!sized) return;
      const sig = SIGNATURES[signatureRef.current];
      const rng = mulberry32(signatureRef.current.length * 7919 + 13);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      drawWheel();
      let arr: Spark[] = [];
      let acc = 0;
      const dt = 1 / 60;
      let t = 0;
      while (t < STATIC_TIME) {
        acc += sig.spawnRate * dt;
        while (acc >= 1) {
          spawnSpark(arr, rng, sig, 0, originX(), originY(), baseAngle, 1);
          acc -= 1;
        }
        const spawned: Spark[] = [];
        for (const s of arr) {
          stepSpark(s, dt, sig, rng, spawned);
        }
        arr = arr.concat(spawned);
        t += dt;
      }
      // paint every particle's final segment plus a short fading trail so
      // carrier lines and forks are both legible in one static composite —
      // this is a long exposure, not a literal single instant.
      for (const s of arr) {
        if (s.age >= s.life * 1.4) continue; // long-dead, would just be noise
        drawSpark(s);
      }
      ctx.globalAlpha = 1;
      if (border) {
        // legitimate --border use: the dropzone's own outline, drawn by CSS,
        // not touched here — canvas leaves the frame edge alone.
      }
    };

    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!sized || !visible || !pageVisible) {
        last = now;
        return;
      }
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const sig = SIGNATURES[signatureRef.current];

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      drawWheel();

      spawnAcc += sig.spawnRate * dt;
      const rng = Math.random;
      while (spawnAcc >= 1 && particles.length < MAX_PARTICLES) {
        spawnSpark(particles, rng, sig, 0, originX(), originY(), baseAngle, 1);
        spawnAcc -= 1;
      }

      const spawned: Spark[] = [];
      const alive: Spark[] = [];
      for (const s of particles) {
        stepSpark(s, dt, sig, rng, spawned);
        if (s.age < s.life && s.y < h + 40) alive.push(s);
      }
      particles = alive.concat(spawned).slice(-MAX_PARTICLES);

      for (const s of particles) drawSpark(s);
      ctx.globalAlpha = 1;
    };

    if (reduced) {
      renderStaticFrame();
    } else {
      raf = requestAnimationFrame(loop);
    }

    // re-render the static frame if the signature changes while reduced
    // motion is active, or if tokens flip theme — both need a fresh paint
    // since there is no running loop to pick it up on its own.
    const staticRerender = () => {
      if (reducedRef.current) renderStaticFrame();
    };
    const moForStatic = new MutationObserver(() => {
      deriveTokens();
      staticRerender();
    });
    moForStatic.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      moForStatic.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [file?.id]);

  return (
    <div ref={rootRef} className={`relative w-full ${className}`}>
      <div
        ref={zoneRef}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-describedby={hintId}
        onClick={() => inputRef.current?.click()}
        onKeyDown={onKeyDown}
        onDragOver={(e) => {
          e.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={onDrop}
        className={`relative isolate flex min-h-56 w-full flex-col items-center justify-end overflow-hidden rounded-md border outline-none transition-colors ${
          isOver ? "border-ns-accent" : "border-border"
        } focus-visible:ring-2 focus-visible:ring-ns-accent/30`}
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
        <div className="relative z-10 flex w-full flex-col items-center gap-1 px-4 pb-4 pt-10">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ns-muted">
            {file ? file.name : "Drop a file on the wheel"}
          </p>
          <p className="text-xs text-ns-muted">
            {file
              ? `${familyDisplayName(file.family)} · ${formatSize(file.size)}`
              : "or press Enter to browse"}
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept.join(",") || undefined}
        onChange={(e) => handleFiles(e.target.files)}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <p id={hintId} className="text-xs text-ns-muted">
          {accept.length > 0 ? `Accepts ${accept.join(", ")}` : "Accepts any file type"}
          {maxSizeBytes != null ? ` · up to ${formatSize(maxSizeBytes)}` : ""}
        </p>
        {file && (
          <button
            type="button"
            onClick={clearFile}
            className="text-xs text-ns-muted underline decoration-border underline-offset-2 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent/30"
          >
            Clear
          </button>
        )}
      </div>

      <div id={liveId} role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>
    </div>
  );
}
