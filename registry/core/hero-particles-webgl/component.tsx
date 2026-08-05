"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { motion, useReducedMotion, type Variants } from "motion/react";

const COUNT = 6000;
const FIELD = { w: 22, h: 12 };
// repulsion radius in screen pixels; converted to world units per-frame
// since world-units-per-pixel changes with viewport size
const CURSOR_RADIUS_PX = 170;
// peak outward displacement as a fraction of the radius
const PUSH = 0.62;
// resting cursor position, far outside the field — falloff is 0 here, so
// easing back toward it lets every dot relax to its home position
const REST = new THREE.Vector2(999, 999);
// exponential ease factor for the cursor uniform: low enough that dots trail
// the pointer and spring back rather than snapping
const EASE = 0.09;

// All particle motion lives in the vertex shader — zero per-particle CPU work.
// JS only eases the cursor uniform each frame so the repulsion trails smoothly,
// and re-derives uColor from CSS tokens on theme change.
const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec2 uCursor;
  uniform float uRadius;
  uniform float uPush;
  attribute float aSeed;
  void main() {
    vec3 p = position;
    // ambient drift — two desynced sines per dot
    p.x += sin(uTime * 0.4 + aSeed) * 0.3;
    p.y += cos(uTime * 0.32 + aSeed * 1.7) * 0.3;
    // reversed-polarity magnet: displace outward along (dot - cursor),
    // strongest at the pointer, decaying smoothly to zero at uRadius
    vec2 d = p.xy - uCursor;
    float dist = length(d);
    float falloff = 1.0 - smoothstep(0.0, uRadius, dist);
    // ease-out shaping so the shove is soft at the rim and firm at the core
    falloff = falloff * falloff * (3.0 - 2.0 * falloff);
    vec2 dir = dist > 0.0001 ? d / dist : vec2(0.0);
    p.xy += dir * falloff * uRadius * uPush;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = 42.0 / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.15, d) * 0.55;
    if (alpha < 0.01) discard;
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
  const pointerInside = useRef(false);
  // scratch vector for the per-frame ease target — avoids an allocation on
  // every frame the pointer is inside the canvas
  const target = useRef(new THREE.Vector2());
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
      uPush: { value: 0 },
      uColor: { value: new THREE.Vector3(0.561, 0.561, 0.561) },
    }),
    []
  );

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

  // derive dot color from CSS tokens at mount, and again whenever the theme
  // class flips — mirrors the pattern used by other canvas components in
  // this registry (e.g. hero-long-exposure)
  useEffect(() => {
    const derive = () => {
      const u = material.current?.uniforms;
      if (!u) return;
      const cs = getComputedStyle(document.documentElement);
      const base = parseColor(cs.getPropertyValue("--ns-muted")) ?? [0.561, 0.561, 0.561];
      (u.uColor.value as THREE.Vector3).set(...base);
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
    // world-units-per-pixel so the void stays ~170px regardless of
    // viewport size or DPR
    u.uRadius.value = (CURSOR_RADIUS_PX * viewport.width) / size.width;
    if (still) return; // reduced motion: freeze drift and repulsion
    u.uTime.value = clock.elapsedTime;

    const inside = pointerInside.current;
    const t = target.current;
    if (inside) t.set((pointer.x * viewport.width) / 2, (pointer.y * viewport.height) / 2);
    else t.copy(REST);
    // exponential ease toward target — dots swell outward as the pointer
    // approaches and relax home behind it
    const c = u.uCursor.value as THREE.Vector2;
    c.x += (t.x - c.x) * EASE;
    c.y += (t.y - c.y) * EASE;
    // fade the push in on enter / out on leave so nothing pops
    const p = u.uPush as { value: number };
    p.value += ((inside ? PUSH : 0) - p.value) * EASE;
  });

  return (
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
  "inline-flex items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent";

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
          className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted"
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
          className="mx-auto mt-5 max-w-lg text-base text-ns-muted"
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
