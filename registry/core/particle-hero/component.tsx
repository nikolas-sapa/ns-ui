"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { motion, useReducedMotion, type Variants } from "motion/react";

const COUNT = 6000;
const FIELD = { w: 22, h: 12 };

// All particle motion lives in the vertex shader — zero per-particle CPU work.
// JS only eases the cursor uniform each frame so repulsion trails smoothly.
const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec2 uCursor;
  attribute float aSeed;
  varying float vFade;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.25 + aSeed) * 0.12;
    p.y += cos(uTime * 0.2 + aSeed * 1.7) * 0.12;
    vec2 d = p.xy - uCursor;
    float f = min(1.2 / (dot(d, d) + 0.35), 2.2);
    p.xy += d * f * 0.35;
    vFade = 1.0 - clamp(f * 0.3, 0.0, 0.6); // slightly dim displaced particles
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = 42.0 / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vFade;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.15, d) * 0.55 * vFade;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vec3(0.561), alpha); // #8f8f8f
  }
`;

function Particles({ still }: { still: boolean }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const { viewport, pointer } = useThree();

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
    () => ({ uTime: { value: 0 }, uCursor: { value: new THREE.Vector2(99, 99) } }),
    []
  );

  useFrame(({ clock }) => {
    if (!material.current || still) return;
    material.current.uniforms.uTime.value = clock.elapsedTime;
    // ease cursor toward pointer for a trailing, weighty feel
    const c = material.current.uniforms.uCursor.value as THREE.Vector2;
    c.x += ((pointer.x * viewport.width) / 2 - c.x) * 0.08;
    c.y += ((pointer.y * viewport.height) / 2 - c.y) * 0.08;
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

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      {webgl ? (
        <div className="absolute inset-0" aria-hidden>
          <Canvas camera={{ position: [0, 0, 8], fov: 50 }} dpr={[1, 2]}>
            <Particles still={reduced} />
          </Canvas>
        </div>
      ) : (
        // static fallback when WebGL is unavailable
        <div
          aria-hidden
          className="absolute inset-0 [background-image:radial-gradient(circle,var(--color-border)_1px,transparent_1px)] [background-size:22px_22px]"
        />
      )}
      {/* vignette keeps edges quiet and text legible */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,transparent_30%,var(--color-background)_100%)]"
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
