"use client";

import { useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// SpreaderBar — a logo wall built as a hanging mobile (Calder, and the
// rigging trade's spreader bar). It replaces the flat grid every other logo
// wall in this registry uses: the tree of arms is not laid out, it is BALANCED.
//
// Each mark's weight is its own measured ink coverage (rasterise once at
// mount, sum alpha, normalise to the set's mean). For every arm in the 4-level
// / 7-arm / 8-mark tree, the fulcrum sits where w_left*d_left = w_right*d_right
// — a heavy mark hangs close to its pivot, a light one hangs far out, and the
// unequal arm offsets you see ARE that equalisation, not a design choice. `d`
// is clamped to [0.18, 0.82] of the arm's span so no mark ever lands on the
// fulcrum itself. This is the one component in the round that handles unequal
// optical weight by physics rather than by grid position — hard-coding a
// layout here would make it pointless, so the geometry is re-solved on every
// ResizeObserver fire and whenever `logos` changes.
//
// Every hanger wire is also a torsional spring, so every arm and every mark is
// a torsional pendulum yawing about its own vertical wire — which is what the
// "rotation" in this component actually is: a mark turned `theta` off frontal
// draws at cos(theta) width (foreshortening), never a swing across the canvas.
// Positions are therefore fixed for good: "nothing translates" is not a
// simplification, it is what a torsional (as opposed to a swinging) pendulum
// looks like from the front. Seven arms carry deliberately incommensurate
// periods (7.3 / 9.1 / 11.6 / 13.9 / 17.2 / 21.5 / 26.8s); eight leaf marks
// spin at their own periods (5.9-8.7s) inherited-and-modulated by their parent
// arm's instantaneous angle, and every arm's period is itself modulated ±4% by
// its children's angle (parent inertia coupling) — which is what stops the
// assembly reading as independent sine waves. Light air damping (Q=180, tau
// ~400s) would eventually let it come to rest, except a 0.037Hz value-noise
// draught torque (up to 0.6% of peak, applied to every arm every frame) never
// lets it: unforced, unbounded, no rest state and no cycle length. Rotation is
// hard-capped at 34° on every mark (cos 34deg = 0.83) — a legibility floor, not
// a taste call.
//
// Everything here is a pure, deterministic function of time and a fixed seed:
// no accumulated rAF state, no Math.random at runtime. prefers-reduced-motion
// (and the pause button) freeze on that same function evaluated once at
// STATIC_TIME, so the still is byte-stable however long the page has been open.
// ---------------------------------------------------------------------------

export interface SpreaderBarLogo {
  id: string;
  /** accessible name; also the DOM list entry's text and the drawn wordmark */
  name: string;
  /** optional link for the DOM list entry */
  href?: string;
  /** wordmark casing/typeface treatment — invented marks only, never a real trademark */
  face?: MarkFace;
  /** optional glyph set beside the wordmark */
  shape?: MarkShape | "none";
}

type MarkShape =
  | "disc"
  | "ring"
  | "square"
  | "cross"
  | "triangle"
  | "diamond"
  | "hex"
  | "dots";

type MarkFace = "sans" | "serif" | "mono";

const SHAPES: MarkShape[] = [
  "disc",
  "ring",
  "square",
  "cross",
  "triangle",
  "diamond",
  "hex",
  "dots",
];

// Fictional marks. Deliberately unequal — a long serif wordmark carries far
// more ink than a five-letter monogram lockup, and that inequality is the
// input the whole balance solve runs on.
const DEFAULT_LOGOS: SpreaderBarLogo[] = [
  { id: "l1", name: "KELVA", face: "sans", shape: "disc" },
  { id: "l2", name: "Palto", face: "serif", shape: "none" },
  { id: "l3", name: "NORVA", face: "mono", shape: "ring" },
  { id: "l4", name: "ZETRIN", face: "sans", shape: "square" },
  { id: "l5", name: "Okalu", face: "serif", shape: "triangle" },
  { id: "l6", name: "MARBO", face: "mono", shape: "none" },
  { id: "l7", name: "Fennow", face: "serif", shape: "diamond" },
  { id: "l8", name: "VYSTRA", face: "sans", shape: "cross" },
];

// -- geometry / physics constants -------------------------------------------
const D_MIN = 0.18; // arm-fraction clamp: fulcrum never touches a tip
const D_MAX = 0.82;
const CHILD_SPAN_FACTOR = 0.55; // each level's arm span vs its parent's
const LEVEL_HEIGHT_FRAC = 0.19; // level gap, fraction of min(w,h)
const LEVEL_HEIGHT_MIN = 34; // px floor

const ARM_AMP_DEG = 16; // root / level-2 / level-3 amplitude
const LEAF_AMP_DEG = 34; // leaf mark amplitude == the legibility cap
const TAU_DECAY = 400; // s — Q=180 amplitude decay time-constant
const COUPLE_FRAC = 0.04; // ±4% parent/child period modulation
const DRAUGHT_HZ = 0.037; // 1D value-noise draught frequency
const DRAUGHT_FRAC = 0.006; // up to 0.6% of peak amplitude, per frame
const STATIC_TIME = 14.6; // s — reduced-motion / paused freeze frame

// Root, level-2 (x2), level-3 (x4) periods — mutually incommensurate.
const ARM_PERIODS = [26.8, 17.2, 21.5, 7.3, 9.1, 11.6, 13.9];
// Eight leaf marks, own-spin periods spread 5.9-8.7s.
const LEAF_PERIODS = [5.9, 6.4, 6.8, 7.3, 7.7, 8.1, 8.4, 8.7];

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
const D2R = Math.PI / 180;

// deterministic hash + value noise: every "random" input here is a pure
// function of its argument, so the draught torque never needs Math.random.
function hash1(n: number) {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}
function valueNoise1D(x: number) {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash1(i);
  const b = hash1(i + 1);
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u; // 0..1
}
function draughtSigned(t: number, seed: number) {
  return valueNoise1D(t * DRAUGHT_HZ + seed) * 2 - 1; // -1..1
}

// -- the tree -----------------------------------------------------------
// 4 levels / 7 arms / 8 marks, built once. Arms 0..6 map onto ARM_PERIODS in
// this order: [root, level2-left, level2-right, level3(0..3)]. Leaves 0..7 map
// onto LEAF_PERIODS in reading order.
type ArmNode = {
  kind: "arm";
  armIndex: number; // into ARM_PERIODS
  left: ArmNode | LeafNode;
  right: ArmNode | LeafNode;
  weight: number; // sum of descendant leaf weights, filled bottom-up
  // static base pose, recomputed on resize/logos change
  fx: number;
  fy: number; // fulcrum
  dLeft: number;
  dRight: number; // px either side of the fulcrum
};
type LeafNode = {
  kind: "leaf";
  leafIndex: number; // into LEAF_PERIODS / logos
  weight: number;
  x: number;
  y: number;
};

function buildTree(): ArmNode {
  const leaf = (i: number): LeafNode => ({ kind: "leaf", leafIndex: i, weight: 1, x: 0, y: 0 });
  const arm = (armIndex: number, left: ArmNode | LeafNode, right: ArmNode | LeafNode): ArmNode => ({
    kind: "arm",
    armIndex,
    left,
    right,
    weight: 1,
    fx: 0,
    fy: 0,
    dLeft: 0,
    dRight: 0,
  });
  const l3a = arm(3, leaf(0), leaf(1));
  const l3b = arm(4, leaf(2), leaf(3));
  const l3c = arm(5, leaf(4), leaf(5));
  const l3d = arm(6, leaf(6), leaf(7));
  const l2left = arm(1, l3a, l3b);
  const l2right = arm(2, l3c, l3d);
  return arm(0, l2left, l2right);
}

function nodeWeight(n: ArmNode | LeafNode): number {
  if (n.kind === "leaf") return n.weight;
  const wL = nodeWeight(n.left);
  const wR = nodeWeight(n.right);
  n.weight = wL + wR;
  return n.weight;
}

// Static layout: solves w_left*d_left = w_right*d_right at every arm, then
// hangs children off the resulting fulcrum offsets. Weights must already be
// filled (nodeWeight) before calling.
function layout(n: ArmNode, cx: number, y: number, span: number, levelH: number) {
  const wL = nodeWeight(n.left);
  const wR = nodeWeight(n.right);
  const total = wL + wR || 1;
  const dLeft = clamp((span * wR) / total, D_MIN * span, D_MAX * span);
  const dRight = span - dLeft;
  n.fx = cx;
  n.fy = y;
  n.dLeft = dLeft;
  n.dRight = dRight;
  const leftX = cx - dLeft;
  const rightX = cx + dRight;
  const childSpan = span * CHILD_SPAN_FACTOR;
  const childY = y + levelH;
  if (n.left.kind === "arm") layout(n.left, leftX, childY, childSpan, levelH);
  else {
    n.left.x = leftX;
    n.left.y = childY;
  }
  if (n.right.kind === "arm") layout(n.right, rightX, childY, childSpan, levelH);
  else {
    n.right.x = rightX;
    n.right.y = childY;
  }
}

function forEachArm(n: ArmNode, fn: (a: ArmNode) => void) {
  fn(n);
  if (n.left.kind === "arm") forEachArm(n.left, fn);
  if (n.right.kind === "arm") forEachArm(n.right, fn);
}
function forEachLeaf(n: ArmNode, fn: (l: LeafNode, parent: ArmNode) => void) {
  if (n.left.kind === "leaf") fn(n.left, n);
  else forEachLeaf(n.left, fn);
  if (n.right.kind === "leaf") fn(n.right, n);
  else forEachLeaf(n.right, fn);
}

// -- ink coverage --------------------------------------------------------
function drawMarkPath(ctx: CanvasRenderingContext2D, shape: MarkShape, s: number) {
  // paths in a [-s, s] square, s = half the mark's drawn size
  ctx.beginPath();
  switch (shape) {
    case "disc":
      ctx.arc(0, 0, s * 0.82, 0, Math.PI * 2);
      ctx.fill();
      return;
    case "ring":
      ctx.lineWidth = s * 0.22;
      ctx.arc(0, 0, s * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      return;
    case "square":
      ctx.rect(-s * 0.68, -s * 0.68, s * 1.36, s * 1.36);
      ctx.fill();
      return;
    case "cross":
      ctx.lineWidth = s * 0.34;
      ctx.lineCap = "round";
      ctx.moveTo(0, -s * 0.8);
      ctx.lineTo(0, s * 0.8);
      ctx.moveTo(-s * 0.8, 0);
      ctx.lineTo(s * 0.8, 0);
      ctx.stroke();
      return;
    case "triangle":
      ctx.lineWidth = s * 0.16;
      ctx.moveTo(0, -s * 0.85);
      ctx.lineTo(s * 0.8, s * 0.6);
      ctx.lineTo(-s * 0.8, s * 0.6);
      ctx.closePath();
      ctx.stroke();
      return;
    case "diamond":
      ctx.moveTo(0, -s * 0.88);
      ctx.lineTo(s * 0.72, 0);
      ctx.lineTo(0, s * 0.88);
      ctx.lineTo(-s * 0.72, 0);
      ctx.closePath();
      ctx.fill();
      return;
    case "hex": {
      ctx.lineWidth = s * 0.16;
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        const px = Math.cos(a) * s * 0.78;
        const py = Math.sin(a) * s * 0.78;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      return;
    }
    case "dots": {
      const r = s * 0.19;
      const off = s * 0.46;
      for (const [dx, dy] of [
        [-off, -off],
        [off, -off],
        [-off, off],
        [off, off],
      ]) {
        ctx.moveTo(dx + r, dy);
        ctx.arc(dx, dy, r, 0, Math.PI * 2);
      }
      ctx.fill();
      return;
    }
  }
}

// -- the wordmark lockup -------------------------------------------------
// A logo wall has to read as logos, so a mark here is a wordmark (its own
// typeface treatment) optionally locked up with a small glyph. That also makes
// the weights honest: a long serif wordmark really does carry three times the
// ink of a five-letter monogram lockup, and the balance solve sees it.
const FACE_STACK: Record<MarkFace, string> = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif',
  serif: 'ui-serif, Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};
const FACE_WEIGHT: Record<MarkFace, number> = { sans: 700, serif: 600, mono: 500 };
const FACE_TRACK: Record<MarkFace, number> = { sans: 0.02, serif: 0, mono: 0.11 };

function markFont(face: MarkFace, px: number) {
  return `${FACE_WEIGHT[face]} ${px}px ${FACE_STACK[face]}`;
}

type LockupMetrics = {
  face: MarkFace;
  textPx: number;
  glyphSize: number;
  glyphW: number;
  track: number;
  total: number;
};

function measureLockup(
  ctx: CanvasRenderingContext2D,
  logo: SpreaderBarLogo,
  unit: number
): LockupMetrics {
  const face = logo.face ?? "sans";
  const textPx = unit * 1.5;
  const glyphSize = unit * 0.52;
  const gap = unit * 0.46;
  const track = FACE_TRACK[face] * textPx;
  ctx.font = markFont(face, textPx);
  let textW = 0;
  for (const ch of logo.name) textW += ctx.measureText(ch).width + track;
  textW = Math.max(0, textW - track);
  const hasGlyph = !!logo.shape && logo.shape !== "none";
  const glyphW = hasGlyph ? glyphSize * 2 + gap : 0;
  return { face, textPx, glyphSize, glyphW, track, total: textW + glyphW };
}

function drawLockup(ctx: CanvasRenderingContext2D, logo: SpreaderBarLogo, unit: number) {
  const m = measureLockup(ctx, logo, unit);
  let x = -m.total / 2;
  if (m.glyphW) {
    ctx.save();
    ctx.translate(x + m.glyphSize, 0);
    drawMarkPath(ctx, logo.shape as MarkShape, m.glyphSize);
    ctx.restore();
    x += m.glyphW;
  }
  ctx.font = markFont(m.face, m.textPx);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  for (const ch of logo.name) {
    ctx.fillText(ch, x, 0);
    x += ctx.measureText(ch).width + m.track;
  }
}

// Rasterise each lockup once at a fixed size, sum alpha, normalise to the
// set's mean. This is what makes the layout earned rather than authored.
function measureWeights(list: SpreaderBarLogo[]): number[] {
  const W = 320;
  const H = 64;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return list.map(() => 1);
  const raw = list.map((logo) => {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.fillStyle = "#000";
    ctx.strokeStyle = "#000";
    drawLockup(ctx, logo, 18);
    ctx.restore();
    const data = ctx.getImageData(0, 0, W, H).data;
    let sum = 0;
    for (let i = 3; i < data.length; i += 4) sum += data[i];
    return sum / (255 * W * H);
  });
  const mean = raw.reduce((a, b) => a + b, 0) / raw.length || 1;
  return raw.map((v) => v / mean);
}

// -- rotation: pure function of time, no accumulated state -----------------
// Bottom-up: leaves' "own spin" feeds their parent arm's period modulation;
// arms feed their own parent's, up to the root. Then a second, top-down pass
// gives each leaf its final angle, its own-spin period further modulated by
// its parent's already-resolved instantaneous angle ("inherit"). A draught
// torque is added to every node last, and every leaf is hard-clamped to the
// 34° legibility cap.
function decay(t: number) {
  return Math.exp(-t / TAU_DECAY);
}
function ownSpinDeg(ampDeg: number, periodS: number, t: number, periodMod: number) {
  const T = periodS * (1 + periodMod);
  return ampDeg * decay(t) * Math.cos((2 * Math.PI * t) / T);
}

function resolveArmAngles(root: ArmNode, t: number, out: Map<number, number>) {
  const visit = (n: ArmNode): number => {
    const childAngle = (c: ArmNode | LeafNode): number => {
      if (c.kind === "leaf") {
        // own-spin only (uncoupled) — used solely as the coupling signal
        return ownSpinDeg(LEAF_AMP_DEG, LEAF_PERIODS[c.leafIndex], t, 0) / LEAF_AMP_DEG;
      }
      return visit(c) / ARM_AMP_DEG;
    };
    const mod = COUPLE_FRAC * ((childAngle(n.left) + childAngle(n.right)) / 2);
    let deg = ownSpinDeg(ARM_AMP_DEG, ARM_PERIODS[n.armIndex], t, mod);
    deg += ARM_AMP_DEG * DRAUGHT_FRAC * draughtSigned(t, n.armIndex * 7.11 + 1);
    deg = clamp(deg, -ARM_AMP_DEG - 4, ARM_AMP_DEG + 4);
    out.set(n.armIndex, deg);
    return deg;
  };
  visit(root);
}

function resolveLeafAngle(leafIndex: number, parentDeg: number, t: number): number {
  const mod = COUPLE_FRAC * (parentDeg / ARM_AMP_DEG);
  let deg = ownSpinDeg(LEAF_AMP_DEG, LEAF_PERIODS[leafIndex], t, mod);
  deg += LEAF_AMP_DEG * DRAUGHT_FRAC * draughtSigned(t, leafIndex * 3.37 + 41);
  return clamp(deg, -LEAF_AMP_DEG, LEAF_AMP_DEG);
}

type RGB = [number, number, number];
function parseHex(raw: string): RGB | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgba([r, g, b]: RGB, a: number) {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export interface SpreaderBarProps {
  /** eight marks, hung two per arm; only the first 8 are used */
  logos?: SpreaderBarLogo[];
  /** heading above the mobile */
  heading?: string;
  className?: string;
}

export function SpreaderBar({
  logos = DEFAULT_LOGOS,
  heading = "Customers",
  className = "",
}: SpreaderBarProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uid = useId();
  const [paused, setPaused] = useState(false);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const logosRef = useRef(logos);
  logosRef.current = logos;

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tree = buildTree();
    let marks: SpreaderBarLogo[] = DEFAULT_LOGOS;
    let markUnit = 12;

    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    let sized = false;

    // ---- tokens: read before anything paints, re-read on theme flip -------
    let fgIsh: RGB = [23, 23, 23];
    let mutedIsh: RGB = [77, 77, 77];
    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      fgIsh = parseHex(cs.getPropertyValue("--foreground")) ?? fgIsh;
      mutedIsh = parseHex(cs.getPropertyValue("--ns-muted")) ?? mutedIsh;
    };
    readTokens(); // NO PAINT BEFORE THIS — every path below runs after it

    const applyLogos = () => {
      const list = (logosRef.current.length ? logosRef.current : DEFAULT_LOGOS).slice(0, 8);
      while (list.length < 8) list.push(DEFAULT_LOGOS[list.length]!);
      marks = list.map((l, i) => ({ ...l, shape: l.shape ?? SHAPES[i % SHAPES.length]! }));
      const weights = measureWeights(marks);
      let i = 0;
      forEachLeaf(tree, (leaf) => {
        leaf.weight = weights[i++] ?? 1;
      });
      nodeWeight(tree);
    };
    applyLogos();

    // The tree is solved in a unit span first: every x offset is linear in the
    // root span, so one pass gives both the tree's half-extent and the tightest
    // gap between adjacent marks. The root span is then the largest one whose
    // outermost arm tip and widest wordmark still sit inside the frame, and the
    // mark size is capped by that tightest gap — the mobile is fitted to the
    // box rather than clipped by it, and no two wordmarks can collide.
    const relayout = () => {
      if (cssW < 40 || cssH < 40) return;
      const ref = Math.min(cssW, cssH);
      const levelH = Math.max(LEVEL_HEIGHT_MIN, LEVEL_HEIGHT_FRAC * ref);
      const pad = 6;

      layout(tree, 0, 0, 1, 0);
      let ext = 0;
      forEachArm(tree, (n) => {
        ext = Math.max(ext, Math.abs(n.fx - n.dLeft), Math.abs(n.fx + n.dRight));
      });
      const leafXs: number[] = [];
      forEachLeaf(tree, (l) => {
        leafXs.push(l.x);
        ext = Math.max(ext, Math.abs(l.x));
      });
      leafXs.sort((a, b) => a - b);
      let gapUnit = Infinity;
      for (let i = 1; i < leafXs.length; i++) gapUnit = Math.min(gapUnit, leafXs[i]! - leafXs[i - 1]!);
      if (!Number.isFinite(gapUnit) || gapUnit <= 0) gapUnit = 0.2;
      if (ext <= 0) ext = 1;

      markUnit = clamp(0.062 * ref, 10, 19);
      let span = 40;
      for (let iter = 0; iter < 6; iter++) {
        let widest = 0;
        for (const m of marks) widest = Math.max(widest, measureLockup(ctx, m, markUnit).total);
        span = Math.max(40, (cssW / 2 - pad - widest / 2) / ext);
        const gapPx = gapUnit * span;
        if (widest <= gapPx * 0.94 || markUnit <= 7) break;
        markUnit = Math.max(7, markUnit * Math.max(0.6, (gapPx * 0.94) / widest));
      }

      const topY = Math.max(16, (cssH - 3 * levelH) / 2 - markUnit * 0.4);
      layout(tree, cssW / 2, topY, span, levelH);
    };

    const armAngles = new Map<number, number>();

    const draw = (t: number) => {
      if (!sized) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      resolveArmAngles(tree, t, armAngles);

      // hangers + arms (line work), then pivots, then marks — so a mark never
      // sits under its own hardware.
      const wireCol = rgba(mutedIsh, 0.5);
      const armCol = rgba(mutedIsh, 0.7);
      const pivotCol = rgba(fgIsh, 0.55);

      forEachArm(tree, (n) => {
        // hanger from parent tip to this fulcrum: implicit, drawn from the
        // parent side below. Draw this arm's rod + pivot dot only.
        const thetaRad = (armAngles.get(n.armIndex) ?? 0) * D2R;
        const cosT = Math.cos(thetaRad);
        ctx.strokeStyle = armCol;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(n.fx - n.dLeft * cosT, n.fy);
        ctx.lineTo(n.fx + n.dRight * cosT, n.fy);
        ctx.stroke();

        // The fulcrum dot sits where the solve put it; a fainter tick marks the
        // arm's geometric centre, so the offset between the two IS the balance,
        // visible on the still rather than only in the code.
        const tipL = n.fx - n.dLeft * cosT;
        const tipR = n.fx + n.dRight * cosT;
        ctx.strokeStyle = armCol;
        ctx.beginPath();
        ctx.moveTo((tipL + tipR) / 2, n.fy - 3);
        ctx.lineTo((tipL + tipR) / 2, n.fy + 3);
        ctx.stroke();

        ctx.fillStyle = pivotCol;
        ctx.beginPath();
        ctx.arc(n.fx, n.fy, 2.2, 0, Math.PI * 2);
        ctx.fill();

        // hangers down to each child's static anchor point
        ctx.strokeStyle = wireCol;
        ctx.beginPath();
        const lx = n.left.kind === "arm" ? n.left.fx : n.left.x;
        const ly = n.left.kind === "arm" ? n.left.fy : n.left.y;
        ctx.moveTo(n.fx - n.dLeft, n.fy);
        ctx.lineTo(lx, ly);
        const rx = n.right.kind === "arm" ? n.right.fx : n.right.x;
        const ry = n.right.kind === "arm" ? n.right.fy : n.right.y;
        ctx.moveTo(n.fx + n.dRight, n.fy);
        ctx.lineTo(rx, ry);
        ctx.stroke();
      });

      forEachLeaf(tree, (leaf, parent) => {
        const parentDeg = armAngles.get(parent.armIndex) ?? 0;
        const deg = resolveLeafAngle(leaf.leafIndex, parentDeg, t);
        const rad = deg * D2R;
        const cosT = Math.cos(rad);
        const shade = clamp(0.06 * Math.sin(rad), -0.06, 0.06);
        const markCol =
          shade >= 0
            ? rgba(mixRGB(fgIsh, [255, 255, 255], shade), 0.82)
            : rgba(mixRGB(fgIsh, [0, 0, 0], -shade), 0.82);
        ctx.save();
        ctx.translate(leaf.x, leaf.y + markUnit * 0.95);
        ctx.scale(Math.max(0.01, cosT), 1);
        ctx.fillStyle = markCol;
        ctx.strokeStyle = markCol;
        drawLockup(ctx, marks[leaf.leafIndex] ?? DEFAULT_LOGOS[leaf.leafIndex]!, markUnit);
        ctx.restore();
      });
    };

    // ---- rAF loop: pure function of clock time, pause/reduce freeze on
    // STATIC_TIME so the frame is byte-stable ------------------------------
    let raf = 0;
    let running = false;
    let staticMode = false;
    const startPerf = performance.now();

    const loop = (now: number) => {
      raf = 0;
      if (!running) return;
      draw((now - startPerf) / 1000);
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (running || staticMode) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const sleep = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const applyBacking = () => {
      if (cssW < 2 || cssH < 2) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pw = Math.round(cssW * dpr);
      const ph = Math.round(cssH * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    };

    const resize = () => {
      const rect = host.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        sized = false;
        return;
      }
      cssW = rect.width;
      cssH = rect.height;
      sized = true;
      applyBacking();
      relayout();
      draw(staticMode ? STATIC_TIME : (performance.now() - startPerf) / 1000);
    };

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMode = () => {
      staticMode = mq.matches || pausedRef.current;
      if (staticMode) {
        sleep();
        draw(STATIC_TIME);
      } else {
        wake();
      }
    };

    readTokens(); // token read #2: guards the ResizeObserver's own paint path
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    let onScreen = true;
    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((e) => e.isIntersecting);
        readTokens(); // token read #3: guards the IntersectionObserver resume path
        if (!onScreen) sleep();
        else applyMode();
      },
      { threshold: 0 }
    );
    io.observe(host);

    const onVis = () => {
      if (document.hidden) sleep();
      else if (onScreen) applyMode();
    };
    document.addEventListener("visibilitychange", onVis);

    const onMq = () => applyMode();
    mq.addEventListener("change", onMq);

    const themeObserver = new MutationObserver(() => {
      readTokens();
      draw(staticMode ? STATIC_TIME : (performance.now() - startPerf) / 1000);
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    applyMode();

    let lastPolledPaused = pausedRef.current;
    let lastLogos = logosRef.current;
    const poll = window.setInterval(() => {
      if (pausedRef.current !== lastPolledPaused) {
        lastPolledPaused = pausedRef.current;
        applyMode();
      }
      if (logosRef.current !== lastLogos) {
        lastLogos = logosRef.current;
        applyLogos();
        relayout();
        draw(staticMode ? STATIC_TIME : (performance.now() - startPerf) / 1000);
      }
    }, 150);

    return () => {
      sleep();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      mq.removeEventListener("change", onMq);
      themeObserver.disconnect();
      window.clearInterval(poll);
    };
  }, []);

  return (
    <div className={`w-full ${className}`}>
      <p className="mb-6 text-center font-mono text-xs uppercase tracking-widest text-ns-muted">{heading}</p>
      <div ref={hostRef} className="relative h-72 w-full sm:h-80">
        <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />
      </div>
      <div className="mt-4 flex items-center justify-center">
        <button
          type="button"
          aria-pressed={paused}
          onClick={() => setPaused((p) => !p)}
          className="rounded-sm border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-ns-muted transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          {paused ? "Resume motion" : "Pause motion"}
        </button>
      </div>
      <ul
        aria-label={heading}
        className="mx-auto mt-5 flex max-w-xl flex-wrap items-center justify-center gap-x-6 gap-y-2"
      >
        {(logos.length ? logos : DEFAULT_LOGOS).slice(0, 8).map((l) => (
          <li key={l.id}>
            {l.href ? (
              <a
                href={l.href}
                className="font-mono text-[11px] uppercase tracking-widest text-ns-muted underline decoration-border underline-offset-4 transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
              >
                {l.name}
              </a>
            ) : (
              <span className="font-mono text-[11px] uppercase tracking-widest text-ns-muted">{l.name}</span>
            )}
          </li>
        ))}
      </ul>
      <span data-spreader-bar={uid} className="sr-only" />
    </div>
  );
}

SpreaderBar.displayName = "SpreaderBar";
