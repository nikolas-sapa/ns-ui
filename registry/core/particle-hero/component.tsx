"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { motion, useReducedMotion, type Variants } from "motion/react";

const COUNT = 6000;
const FIELD = { w: 22, h: 12 };
// cursor influence radius in screen pixels; converted to world units per-frame
// since world-units-per-pixel changes with viewport size
const CURSOR_RADIUS_PX = 120;
// resting cursor position, far outside the field — falloff is ~0 here, so
// easing back to this point on pointer-leave reads as a spring return
const REST = new THREE.Vector2(999, 999);
// constellation filaments: dots inside the cursor falloff link to their
// nearest neighbors. Both counts are hard caps so per-frame cost stays flat.
const MAX_CANDIDATES = 48;
const MAX_SEGMENTS = 110;
const LINKS_PER_DOT = 3;
const SCRATCH = 512;

// All particle motion lives in the vertex shader — zero per-particle CPU work.
// JS only eases the cursor uniform each frame so repulsion trails smoothly,
// and re-derives uColorBase/uColorLift from CSS tokens on theme change.
const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec2 uCursor;
  uniform float uRadius;
  attribute float aSeed;
  varying float vLift;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.4 + aSeed) * 0.3;
    p.y += cos(uTime * 0.32 + aSeed * 1.7) * 0.3;
    vec2 d = p.xy - uCursor;
    float dist = length(d);
    // smooth falloff to 0 at uRadius, 1 at the cursor — displacement, size and
    // brightness all key off this so the reaction reads as one coherent lift
    float falloff = 1.0 - smoothstep(0.0, uRadius, dist);
    vec2 dir = dist > 0.0001 ? d / dist : vec2(0.0);
    p.xy += dir * falloff * uRadius * 0.55;
    vLift = falloff;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (42.0 / -mv.z) * (1.0 + falloff * 1.5);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColorBase;
  uniform vec3 uColorLift;
  varying float vLift;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.15, d) * (0.5 + vLift * 0.5);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(mix(uColorBase, uColorLift, vLift), alpha);
  }
`;

// filaments: thin token-colored lines, per-vertex alpha so each filament
// tapers with its endpoints' proximity to the cursor
const lineVertexShader = /* glsl */ `
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const lineFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    if (vAlpha < 0.01) discard;
    gl_FragColor = vec4(uColor, vAlpha);
  }
`;

// halo: a soft radial glow quad that rides the eased cursor position
const haloVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const haloFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.0, d);
    a *= a;
    float alpha = a * uStrength * 0.14;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

// #rrggbb / #rgb -> 0-1 float triple; falls back to muted gray on parse miss
function parseColor(hex: string): [number, number, number] | null {
  const s = hex.trim();
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function Particles({ still, visible }: { still: boolean; visible: RefObject<boolean> }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const lineGeom = useRef<THREE.BufferGeometry>(null);
  const lineMaterial = useRef<THREE.ShaderMaterial>(null);
  const haloMesh = useRef<THREE.Mesh>(null);
  const haloMaterial = useRef<THREE.ShaderMaterial>(null);
  const pointerInside = useRef(false);
  const lastSegments = useRef(0);
  const { viewport, pointer, size, gl } = useThree();

  const { positions, seeds } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const seeds = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * FIELD.w;
      positions[i * 3 + 1] = (Math.random() - 0.5) * FIELD.h;
      positions[i * 3 + 2] = 0;
      seeds[i] = Math.random() * Math.PI * 2;
    }
    return { positions, seeds };
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uCursor: { value: REST.clone() },
      uRadius: { value: 1 },
      uColorBase: { value: new THREE.Vector3(0.561, 0.561, 0.561) },
      uColorLift: { value: new THREE.Vector3(0.929, 0.929, 0.929) },
    }),
    []
  );

  const lineUniforms = useMemo(
    () => ({ uColor: { value: new THREE.Vector3(0.929, 0.929, 0.929) } }),
    []
  );

  const haloUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Vector3(0.929, 0.929, 0.929) },
      uStrength: { value: 0 },
    }),
    []
  );

  // preallocated per-frame workspace — no allocation inside useFrame
  const scratch = useMemo(
    () => ({
      x: new Float32Array(SCRATCH),
      y: new Float32Array(SCRATCH),
      f: new Float32Array(SCRATCH),
      order: new Array<number>(SCRATCH),
      nIdx: new Int32Array(LINKS_PER_DOT),
      nDist: new Float32Array(LINKS_PER_DOT),
      linePositions: new Float32Array(MAX_SEGMENTS * 2 * 3),
      lineAlphas: new Float32Array(MAX_SEGMENTS * 2),
      pairs: new Set<number>(),
    }),
    []
  );

  // filaments start hidden; drawRange grows only while the cursor is active
  useEffect(() => {
    lineGeom.current?.setDrawRange(0, 0);
  }, []);

  // track pointer enter/leave on the canvas element directly — pointer.x/y
  // from useThree freezes at the last in-bounds sample on leave, so without
  // this the cursor uniform would never ease back to rest
  useEffect(() => {
    const el = gl.domElement;
    const enter = () => (pointerInside.current = true);
    const leave = () => (pointerInside.current = false);
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
    };
  }, [gl]);

  // derive dot colors from CSS tokens at mount, and again whenever the theme
  // class flips — mirrors the pattern used by other canvas components in
  // this registry (e.g. solargraph-hero)
  useEffect(() => {
    const derive = () => {
      const u = material.current?.uniforms;
      if (!u) return;
      const cs = getComputedStyle(document.documentElement);
      const base = parseColor(cs.getPropertyValue("--muted")) ?? [0.561, 0.561, 0.561];
      const lift = parseColor(cs.getPropertyValue("--foreground")) ?? [0.929, 0.929, 0.929];
      (u.uColorBase.value as THREE.Vector3).set(...base);
      (u.uColorLift.value as THREE.Vector3).set(...lift);
      // filaments + halo share the foreground token — monochrome discipline
      const lu = lineMaterial.current?.uniforms;
      if (lu) (lu.uColor.value as THREE.Vector3).set(...lift);
      const hu = haloMaterial.current?.uniforms;
      if (hu) (hu.uColor.value as THREE.Vector3).set(...lift);
    };
    derive();
    const mo = new MutationObserver(derive);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);

  useFrame(({ clock }) => {
    if (!material.current || !visible.current) return; // paused while scrolled offscreen
    const u = material.current.uniforms;
    // radius is defined in screen pixels; convert using this frame's
    // world-units-per-pixel so the reaction stays ~120px regardless of
    // viewport size or DPR
    u.uRadius.value = (CURSOR_RADIUS_PX * viewport.width) / size.width;
    if (still) return; // reduced motion: freeze drift, cursor reaction, filaments, halo
    const t = clock.elapsedTime;
    u.uTime.value = t;
    const target = pointerInside.current
      ? new THREE.Vector2((pointer.x * viewport.width) / 2, (pointer.y * viewport.height) / 2)
      : REST;
    // exponential ease toward target — trailing weight when following the
    // cursor, spring-like relaxation back to rest once it leaves
    const c = u.uCursor.value as THREE.Vector2;
    c.x += (target.x - c.x) * 0.08;
    c.y += (target.y - c.y) * 0.08;

    // ---- proximity layer: halo + constellation filaments -------------------
    const R = u.uRadius.value as number;
    const geom = lineGeom.current;
    const halo = haloMaterial.current;
    const haloObj = haloMesh.current;
    if (!geom || !halo || !haloObj) return;

    // halo rides the eased cursor; strength eases in on enter, out on leave
    const hs = halo.uniforms.uStrength;
    hs.value += ((pointerInside.current ? 1 : 0) - hs.value) * 0.1;
    haloObj.position.set(c.x, c.y, -0.1);
    haloObj.scale.setScalar(R * 3.2);

    // idle short-circuit: pointer gone and cursor eased back out of the field
    // — zero the filaments once and skip the particle scan entirely
    const active = pointerInside.current || Math.abs(c.x) < FIELD.w;
    if (!active) {
      if (lastSegments.current !== 0) {
        geom.setDrawRange(0, 0);
        lastSegments.current = 0;
      }
      return;
    }

    // gather dots inside the falloff, mirroring the vertex shader's drift +
    // displacement math so the filament endpoints sit exactly on the dots
    const { x, y, f, order, nIdx, nDist, linePositions, lineAlphas, pairs } = scratch;
    const margin = R + 0.45; // drift amplitude head-room
    const m2 = margin * margin;
    let count = 0;
    for (let i = 0; i < COUNT && count < SCRATCH; i++) {
      const bx = positions[i * 3];
      const by = positions[i * 3 + 1];
      const ddx = bx - c.x;
      const ddy = by - c.y;
      if (ddx * ddx + ddy * ddy > m2) continue;
      const s = seeds[i];
      let px = bx + Math.sin(t * 0.4 + s) * 0.3;
      let py = by + Math.cos(t * 0.32 + s * 1.7) * 0.3;
      const dx = px - c.x;
      const dy = py - c.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const xn = Math.min(dist / R, 1);
      const falloff = 1 - xn * xn * (3 - 2 * xn); // smoothstep complement
      if (falloff < 0.04) continue;
      if (dist > 1e-4) {
        const push = (falloff * R * 0.55) / dist;
        px += dx * push;
        py += dy * push;
      }
      x[count] = px;
      y[count] = py;
      f[count] = falloff;
      count++;
    }

    // keep the strongest candidates when over cap
    for (let i = 0; i < count; i++) order[i] = i;
    let k = count;
    if (count > MAX_CANDIDATES) {
      order.length = count;
      order.sort((a, b) => f[b] - f[a]);
      k = MAX_CANDIDATES;
    }

    // link each candidate to its nearest neighbors, deduped, hard-capped
    const maxLink = R * 0.9;
    const maxLink2 = maxLink * maxLink;
    pairs.clear();
    let seg = 0;
    for (let a = 0; a < k && seg < MAX_SEGMENTS; a++) {
      const ia = order[a];
      // nearest-3 selection scan
      let n0 = -1, n1 = -1, n2 = -1;
      let d0 = maxLink2, d1 = maxLink2, d2 = maxLink2;
      for (let b = 0; b < k; b++) {
        if (b === a) continue;
        const ib = order[b];
        const dx = x[ib] - x[ia];
        const dy = y[ib] - y[ia];
        const d = dx * dx + dy * dy;
        if (d >= d2) continue;
        if (d < d0) {
          d2 = d1; n2 = n1;
          d1 = d0; n1 = n0;
          d0 = d; n0 = ib;
        } else if (d < d1) {
          d2 = d1; n2 = n1;
          d1 = d; n1 = ib;
        } else {
          d2 = d; n2 = ib;
        }
      }
      nIdx[0] = n0; nIdx[1] = n1; nIdx[2] = n2;
      nDist[0] = d0; nDist[1] = d1; nDist[2] = d2;
      for (let n = 0; n < LINKS_PER_DOT && seg < MAX_SEGMENTS; n++) {
        const ib = nIdx[n];
        if (ib < 0) continue;
        const key = ia < ib ? ia * SCRATCH + ib : ib * SCRATCH + ia;
        if (pairs.has(key)) continue;
        pairs.add(key);
        const taper = 1 - Math.sqrt(nDist[n]) / maxLink;
        const o = seg * 6;
        linePositions[o] = x[ia];
        linePositions[o + 1] = y[ia];
        linePositions[o + 2] = 0;
        linePositions[o + 3] = x[ib];
        linePositions[o + 4] = y[ib];
        linePositions[o + 5] = 0;
        lineAlphas[seg * 2] = f[ia] * taper * 0.6;
        lineAlphas[seg * 2 + 1] = f[ib] * taper * 0.6;
        seg++;
      }
    }

    geom.setDrawRange(0, seg * 2);
    if (seg > 0 || lastSegments.current > 0) {
      geom.attributes.position.needsUpdate = true;
      geom.attributes.aAlpha.needsUpdate = true;
    }
    lastSegments.current = seg;
  });

  return (
    <group>
      {/* soft cursor halo — foreground token at very low alpha, behind everything */}
      <mesh ref={haloMesh} position={[999, 999, -0.1]} renderOrder={-2}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          ref={haloMaterial}
          vertexShader={haloVertexShader}
          fragmentShader={haloFragmentShader}
          uniforms={haloUniforms}
          transparent
          depthWrite={false}
        />
      </mesh>
      {/* constellation filaments — nearest-neighbor links inside the falloff */}
      <lineSegments frustumCulled={false} renderOrder={-1}>
        <bufferGeometry ref={lineGeom}>
          <bufferAttribute
            attach="attributes-position"
            args={[scratch.linePositions, 3]}
            usage={THREE.DynamicDrawUsage}
          />
          <bufferAttribute
            attach="attributes-aAlpha"
            args={[scratch.lineAlphas, 1]}
            usage={THREE.DynamicDrawUsage}
          />
        </bufferGeometry>
        <shaderMaterial
          ref={lineMaterial}
          vertexShader={lineVertexShader}
          fragmentShader={lineFragmentShader}
          uniforms={lineUniforms}
          transparent
          depthWrite={false}
        />
      </lineSegments>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={material}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
        />
      </points>
    </group>
  );
}

function useWebGLSupport() {
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    const canvas = document.createElement("canvas");
    setSupported(!!(canvas.getContext("webgl2") || canvas.getContext("webgl")));
  }, []);
  return supported;
}

const reveal: Variants = {
  hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { delay: 0.15 + i * 0.12, type: "spring", stiffness: 90, damping: 16 },
  }),
};

const ctaClasses =
  "inline-flex items-center justify-center rounded-sm bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const revealProps = (reduced: boolean, i: number) =>
  ({ variants: reveal, initial: reduced ? false : "hidden", animate: "show", custom: i }) as const;

export function ParticleHero({
  eyebrow = "ns-ui",
  headline = "Interfaces with gravity.",
  subline = "A registry of components built one at a time, each earning its place.",
  cta = "Browse components",
  ctaHref,
  onCtaClick,
}: {
  eyebrow?: string;
  headline?: string;
  subline?: string;
  cta?: string;
  ctaHref?: string;
  onCtaClick?: () => void;
}) {
  const webgl = useWebGLSupport();
  const reduced = useReducedMotion() ?? false;
  const sectionRef = useRef<HTMLElement>(null);
  const visible = useRef(true);

  // pause the rAF-driven drift/cursor work while the hero is scrolled offscreen
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background"
    >
      {webgl ? (
        <div className="absolute inset-0" aria-hidden>
          <Canvas camera={{ position: [0, 0, 8], fov: 50 }} dpr={[1, 2]}>
            <Particles still={reduced} visible={visible} />
          </Canvas>
        </div>
      ) : (
        // static fallback when WebGL is unavailable
        <div
          aria-hidden
          className="absolute inset-0 [background-image:radial-gradient(circle,var(--color-border)_1px,transparent_1px)] [background-size:22px_22px]"
        />
      )}
      {/* vignette keeps edges quiet and text legible; pointer-events-none so
          the cursor reaches the canvas underneath (it blocked all hover) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,transparent_30%,var(--color-background)_100%)]"
      />
      <div className="relative z-10 mx-auto max-w-2xl px-6 text-center">
        <motion.p
          className="font-mono text-xs uppercase tracking-[0.2em] text-muted"
          {...revealProps(reduced, 0)}
        >
          {eyebrow}
        </motion.p>
        <motion.h1
          className="mt-4 text-5xl font-semibold tracking-tight sm:text-6xl"
          {...revealProps(reduced, 1)}
        >
          {headline}
        </motion.h1>
        <motion.p
          className="mx-auto mt-5 max-w-lg text-base text-muted"
          {...revealProps(reduced, 2)}
        >
          {subline}
        </motion.p>
        <motion.div
          className="mt-8"
          {...revealProps(reduced, 3)}
        >
          {ctaHref ? (
            <a href={ctaHref} className={ctaClasses}>
              {cta}
            </a>
          ) : (
            <button onClick={onCtaClick} className={ctaClasses}>
              {cta}
            </button>
          )}
        </motion.div>
      </div>
    </section>
  );
}
