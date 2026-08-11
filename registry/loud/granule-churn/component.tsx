"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// GranuleChurn — a full-bleed stellar photosphere. Solar granulation: bright
// upwelling convection cells packed edge to edge, separated by the dark
// intergranular lanes the cooled material drains back down through.
//
// The mechanism is a small compressible surface flow, not a cell diagram.
// A potential field S(x,y,t) is built from a lattice of gaussian plumes, each
// born at a jittered position, swelling over its own lifetime and fading out
// again. Horizontal velocity is u = -k grad(S), so material runs DOWNHILL away
// from every plume's summit and piles up in the troughs where three or four
// plumes' skirts meet. Nothing anywhere computes a nearest-site distance: the
// lanes are not the edges of a partition, they are where a real advected
// density has been squeezed together, and they inherit a fluid's memory —
// varying width, broken segments, a lag behind the plumes that pushed them.
//
// Four channels ride one RGBA16F ping-pong target and are advected by that
// same velocity in a single semi-Lagrangian pass:
//   T  temperature — injected where the flow diverges (a granule's summit),
//      cooling radiatively as it travels out, so a cell is hot in the middle
//      and dim by the time it reaches its own boundary
//   c  material density — multiplied by exp(-div u dt), the continuity term,
//      which is what actually darkens a lane rather than a painted stroke
//   f  faculae — bright flecks seeded stochastically in the strongest
//      downdrafts and carried along the lane they were born in
//   a  pointer freshness — the only channel --ns-accent ever touches
//
// Birth and death are structural. Each lattice site runs its own period; when
// a plume's envelope reaches zero its successor is born at a new jittered
// position with a new radius, so its neighbours immediately expand into the
// space and the lane network re-knits. Sites drawn above a threshold develop
// an "exploding granule" late in life — a negative dimple opening at the
// summit that pushes a new lane straight through the middle of the cell and
// splits it in two, which is exactly how the real ones die.
//
// Palette: five stops from --background, --foreground, --ns-muted and --border
// via getComputedStyle, re-read on a documentElement class MutationObserver.
// The ramp INVERTS between themes rather than shifting its distribution: dark
// theme is a luminous star, light theme its deliberate negative — graphite
// granules on a paper field, tuned so the frame stays mid-toned instead of
// going to a black page. No colour literal appears anywhere, shaders included.
// ---------------------------------------------------------------------------

export interface GranuleChurnProps {
  /** Granule count: cells across the container's short side. @default 1 */
  density?: number;
  /** Convection speed multiplier. @default 1 */
  speed?: number;
  /** Faculae (bright lane flecks) amount, 0 disables them. @default 1 */
  faculae?: number;
  /** Freezes the surface on a fully developed still frame without unmounting. */
  paused?: boolean;
  /** Rendered in the DOM over the surface — eyebrow, headline, CTA. */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const VERT_SRC = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// Shared by both passes. Coordinates are in LATTICE CELLS, isotropic in screen
// space: q = vec2(uv.x * aspect, uv.y) * cells. Working in uv instead would
// make every gaussian an ellipse that restretches with the window, and would
// make the divergence operator anisotropic — which on a compressible flow is
// not a cosmetic error, it is lanes that are systematically wider in one axis.
const COMMON = `
precision highp float;

uniform float u_aspect;
uniform float u_cells;
uniform float u_time;

vec3 hash32(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}

vec4 hash42(vec2 p) {
  vec4 p4 = fract(vec4(p.xyxy) * vec4(0.1031, 0.1030, 0.0973, 0.1099));
  p4 += dot(p4, p4.wzxy + 33.33);
  return fract((p4.xxyz + p4.yzzw) * p4.zywx);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash32(i).x;
  float b = hash32(i + vec2(1.0, 0.0)).x;
  float c = hash32(i + vec2(0.0, 1.0)).x;
  float d = hash32(i + vec2(1.0, 1.0)).x;
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec2 cellCoord(vec2 uv) {
  return vec2(uv.x * u_aspect, uv.y) * u_cells;
}
`;

// The plume lattice. One site per lattice cell, three by three neighbours
// gathered — with a jitter of 0.36 cells and a radius under half a cell, a
// contribution from further out is below 1e-5 and invisible.
//
// Returns (S, dS/dx, dS/dy, laplacian S). Having the laplacian analytically is
// what makes the whole thing cheap: divergence of u = -k grad(S) is exactly
// -k lap(S), so the compression that builds the lanes needs no extra taps.
//
// A supergranular warp is applied to the lookup coordinate before the gather.
// Without it the lattice reads as a lattice within about two seconds of
// looking — jitter alone leaves every cell centre inside its own square, and
// the eye finds that grid immediately on a full-bleed field. The warp is slow
// and shallow enough that its Jacobian stays close to identity, so the
// gradient taken in warped coordinates is still very nearly the true one.
const PLUMES = `
uniform float u_split;

vec2 warp(vec2 q) {
  return q + 0.62 * vec2(
    vnoise(q * 0.115 + vec2(0.0, u_time * 0.012)) - 0.5,
    vnoise(q * 0.115 + vec2(9.71, -u_time * 0.009) + 4.3) - 0.5
  ) + 0.26 * vec2(
    vnoise(q * 0.31 + vec2(u_time * 0.02, 2.1)) - 0.5,
    vnoise(q * 0.31 + vec2(-1.7, u_time * 0.017) + 8.9) - 0.5
  )
  // a third octave at sub-cell scale. The two above move whole groups of
  // granules around; this one is what stops each individual cell from being a
  // circle. Real granules are ragged polygons, and the difference between
  // "photosphere" and "soap foam" is almost entirely in the boundary: a
  // perfectly round cell reads as a bubble no matter what its interior does.
  // Amplitude is held under a tenth of a cell so the warp's Jacobian stays
  // near identity and the gradient taken in warped coordinates is still the
  // true one.
  + 0.085 * vec2(
    vnoise(q * 0.95 + vec2(u_time * 0.03, 5.3)) - 0.5,
    vnoise(q * 0.95 + vec2(3.9, -u_time * 0.026) + 1.7) - 0.5
  );
}

vec4 plumes(vec2 q) {
  vec2 base = floor(q);
  vec4 acc = vec4(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 id = base + vec2(float(i), float(j));
      vec4 h = hash42(id);
      // every site keeps its own period and phase, so births are decorrelated
      // across the field: a shared clock makes the entire surface pulse
      float per = mix(8.5, 16.5, h.x);
      float u = u_time / per + h.y * 11.0;
      float gen = floor(u);
      float life = u - gen;
      // a new draw per generation — position, size and fate all change when a
      // site's plume is replaced, which is what makes neighbours jostle
      vec3 g = hash32(id * 1.37 + vec2(gen * 19.73, gen * 7.31) + 3.1);
      vec2 c = id + 0.5 + (g.xy - 0.5) * 0.72;
      float rad = mix(0.30, 0.47, g.z) * (0.78 + 0.52 * life);
      float amp = pow(sin(3.14159265 * life), 0.7);
      vec2 d = q - c;
      float ir2 = 1.0 / (rad * rad);
      float r2 = dot(d, d) * ir2;
      float e = exp(-r2) * amp;
      acc.x += e;
      acc.yz += e * (-2.0 * d * ir2);
      acc.w += e * (4.0 * r2 * ir2 - 4.0 * ir2);

      // exploding granule: a dimple opens at the summit late in life, so a
      // lane is driven through the middle of the cell and it splits rather
      // than simply fading. Roughly a third of sites are drawn for it.
      //
      // The dimple has to be BROAD, not deep. At rad*0.44 it was narrower than
      // the sim texel scale, so instead of splitting the cell it punched a
      // single-texel negative spike that clamped T to zero — a hard black
      // pinprick sitting in the middle of a bright granule, which read as a
      // rendering defect rather than as a pore. At 0.66 of the parent radius
      // the dimple is wide enough that the flow actually reverses across a
      // band, which is what drives a lane through and cleaves the cell in two.
      float fate = step(0.66, h.z) * u_split;
      float amp2 = fate * amp * 0.46 * smoothstep(0.48, 0.92, life);
      float rad2 = rad * 0.66;
      float ir2b = 1.0 / (rad2 * rad2);
      float r2b = dot(d, d) * ir2b;
      float eb = exp(-r2b) * amp2;
      acc.x -= eb;
      acc.yz -= eb * (-2.0 * d * ir2b);
      acc.w -= eb * (4.0 * r2b * ir2b - 4.0 * ir2b);
    }
  }
  return acc;
}
`;

// One pass per step: velocity is evaluated analytically at the destination
// pixel, all four channels ride one backtrace, and every source term lands in
// the same write. There is no pressure solve because there is nothing to
// project — a photosphere's surface flow is COMPRESSIBLE by construction, and
// the divergence is not an error to be removed, it is the entire signal.
const SIM_SRC = `#version 300 es
${COMMON}
${PLUMES}
in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_field;
uniform vec2 u_texel;
uniform vec2 u_grid;
uniform float u_dt;
uniform float u_flow;
uniform float u_fleck;
uniform vec3 u_ptr;      // xy uv, z strength
uniform float u_ptrAcc;

void main() {
  vec2 q = warp(cellCoord(v_uv));
  vec4 P = plumes(q);

  // the pointer is an extra upwelling: it pushes the lanes apart and floats
  // fresh hot material up under the cursor, the same way every other plume
  // does, so the interaction is the mechanism rather than a decal on it
  if (u_ptr.z > 0.0) {
    vec2 pc = cellCoord(u_ptr.xy);
    vec2 d = q - pc;
    float rad = 1.35;
    float ir2 = 1.0 / (rad * rad);
    float r2 = dot(d, d) * ir2;
    float e = exp(-r2) * u_ptr.z * 1.5;
    P.x += e;
    P.yz += e * (-2.0 * d * ir2);
    P.w += e * (4.0 * r2 * ir2 - 4.0 * ir2);
  }

  vec2 vel = -u_flow * P.yz;      // cells/s
  float div = -u_flow * P.w;      // 1/s

  // soft walls: without them the outward half of every edge plume drags the
  // clamped border texel inward across a tenth of the frame
  vec2 edge = smoothstep(vec2(0.0), vec2(0.035, 0.035 * u_aspect), min(v_uv, 1.0 - v_uv));
  vel *= min(edge.x, edge.y) * 0.85 + 0.15;

  vec2 duv = vel * u_dt / u_cells * vec2(1.0 / u_aspect, 1.0);
  vec4 s = texture(u_field, v_uv - duv);

  float T = s.x;
  float c = s.y;
  float f = s.z;
  float a = s.w;

  // continuity. This single line is what makes a lane: converging flow
  // multiplies the density it carries, diverging flow thins it out, and the
  // result is a network whose brightness records how hard the surface has been
  // squeezing there rather than where a boundary was declared to be.
  c *= exp(-div * u_dt * 0.052);
  c += (1.0 - c) * (1.0 - exp(-u_dt / 22.0));
  c = clamp(c, 0.12, 4.0);

  // radiative cooling on the way out from the summit is what gives a granule
  // its interior falloff, and the rate has to be tuned against the crossing
  // time rather than to taste: cool too slowly and every cell is one flat
  // plateau of the same value, which is foam, not a photosphere. At ~0.7s
  // against a ~0.5s centre-to-lane crossing, material arrives at its own
  // boundary noticeably dimmer than it left the summit.
  T += max(div, 0.0) * u_dt * 0.115;
  T -= T * u_dt * 1.45;
  T = clamp(T, 0.0, 3.0);

  // faculae: sparse, seeded on a 6Hz tick so the rate is independent of frame
  // rate, gated on both a piled-up lane and a live downdraft, then advected
  // with the lane that made them
  float lane = smoothstep(1.30, 2.10, c);
  float conv = smoothstep(0.30, 1.40, max(-div, 0.0));
  vec3 hs = hash32(floor(v_uv * u_grid * 0.5) + vec2(floor(u_time * 6.0) * 31.7));
  // the threshold is the seeding rate, and it was set so far out that a
  // 640x400 field produced under one live fleck at a time — invisible in the
  // dark theme, which is exactly where a bright point on a black lane should
  // be the most rewarding thing in the frame
  float spark = step(0.9991, hs.x) * lane * conv * u_fleck;
  f = max(f - f * u_dt * 2.3, spark * (0.55 + 0.75 * hs.y));

  a = max(a - a * u_dt * 0.9, u_ptrAcc * exp(-dot(cellCoord(v_uv) - cellCoord(u_ptr.xy), cellCoord(v_uv) - cellCoord(u_ptr.xy)) / 1.4));

  fragColor = vec4(T, c, f, a);
}`;

const RENDER_SRC = `#version 300 es
${COMMON}
in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_field;
uniform vec2 u_texel;
uniform vec2 u_res;
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform vec3 u_c4;
uniform vec3 u_accent;
uniform float u_bias;
uniform float u_contrast;
uniform float u_mottle;

vec3 ramp(float x) {
  vec3 c = mix(u_c0, u_c1, smoothstep(0.0, 0.26, x));
  c = mix(c, u_c2, smoothstep(0.24, 0.52, x));
  c = mix(c, u_c3, smoothstep(0.50, 0.80, x));
  c = mix(c, u_c4, smoothstep(0.78, 1.0, x));
  return c;
}

void main() {
  vec4 s = texture(u_field, v_uv);
  float T = s.x;
  float c = s.y;
  float f = s.z;
  float a = s.w;

  float lane = max(c - 1.0, 0.0);
  float open = max(1.0 - c, 0.0);

  // The four neighbours, fetched once and used twice — the lane seam below
  // needs grad(c), and T needs an unsharp.
  //
  // The unsharp is not a cosmetic sharpen. Semi-Lagrangian advection is
  // unconditionally stable precisely because it interpolates, and every step
  // pays for that with a bilinear fetch that low-passes the field; run it at
  // 60Hz and the surface is being blurred sixty times a second. The sim is
  // then magnified roughly four times onto the backing store, so what reaches
  // the eye is a soft field with no edge anywhere and the whole photosphere
  // reads out of focus. Subtracting the discrete laplacian puts back the
  // frequency band that dissipation just removed, at the cost of nothing —
  // these taps were already paid for.
  vec4 sl = texture(u_field, v_uv - vec2(u_texel.x, 0.0));
  vec4 sr = texture(u_field, v_uv + vec2(u_texel.x, 0.0));
  vec4 sd = texture(u_field, v_uv - vec2(0.0, u_texel.y));
  vec4 su = texture(u_field, v_uv + vec2(0.0, u_texel.y));
  float Tlap = (sl.x + sr.x + sd.x + su.x) * 0.25 - T;
  T = max(T - Tlap * 0.85, 0.0);

  // T goes through a saturating exposure rather than straight into the ramp.
  // Linear, the summit of every cell clips to the top stop within a second of
  // spin-up and the whole frame becomes white blobs in black seams — soap
  // foam, which is the exact failure this component has to avoid.
  //
  // Saturating alone was not enough: at an exposure of 2.1 the shoulder was
  // reached by the time T was ~1, so most of a granule's area still landed on
  // the top stop and the interiors were flat plateaus with all the variation
  // crushed out of them. A star does not look like that — granule-to-lane
  // contrast on the real photosphere is a fraction of full range, and every
  // cue that makes the surface worth staring at lives INSIDE that fraction.
  // Exposure 1.15 against a gain of 0.55 puts a typical summit near 0.75 of
  // the ramp rather than pinned at 1.0, which leaves the top quarter for the
  // hottest few percent of the field and gives the mottle and the cooling
  // falloff somewhere to be seen.
  float hot = 1.0 - exp(-T * 1.15);

  float L = 0.205;
  L += hot * 0.60;
  L -= smoothstep(0.03, 1.15, lane) * 0.32;
  L += open * 0.07;

  // the lane's own gradient, added as a thin seam. A density field advected
  // semi-Lagrangian loses its highest frequencies every step; putting a little
  // of the gradient back is the difference between a lane with an edge and a
  // soft grey smear where one used to be.
  float grad = length(vec2(sr.y - sl.y, su.y - sd.y));
  // gated to the lane side. Unclamped it also fires on the granule side of
  // every boundary, which laid a dark ring just inside each cell and embossed
  // the whole field — every granule beaded up as a separate object instead of
  // packing against its neighbours.
  L -= min(grad * 3.4, 0.24) * 0.5 * smoothstep(0.85, 1.15, c);

  // micro-mottle, confined to the hot interiors — a granule is not a smooth
  // plateau. Its lookup is displaced by the field itself, which costs nothing
  // and makes the texture travel with the material instead of sitting still
  // behind a moving surface.
  //
  // It carries most of the load now that the exposure no longer clips: with a
  // flat plateau there was nothing for it to modulate, and with headroom above
  // the summit it is the only thing between a granule and a painted disc.
  // Three octaves, and gated to open early (T = 0.04) so it reaches the cooler
  // outer thirds of a cell rather than only the summit.
  //
  // The displacement is small and CENTRED, and both of those were learned the
  // hard way. At vec2(c, T) * 2.3 the offset ran to several noise periods, so
  // the lookup did not travel with the material, it sheared with it: every
  // granule grew a bright cap on its upflow side and a speckled tail opposite,
  // and forty of those in a frame read as a field of mushrooms. Subtracting
  // c's rest value of 1 also matters — uncentred, the whole field carries a
  // constant offset and the term stops being a perturbation at all.
  vec2 mp = v_uv * vec2(u_aspect, 1.0) * u_cells * 6.5 + vec2(c - 1.0, T) * 0.85;
  float m = vnoise(mp) * 0.55 + vnoise(mp * 2.3 + 7.1) * 0.28 + vnoise(mp * 4.7 + 2.9) * 0.14;
  L += (m - 0.46) * u_mottle * smoothstep(0.04, 0.42, T);

  L += f * 0.62;

  // a full-bleed surface should reach the edge of the frame. The vignette is
  // here only to stop the clamped border texels from reading as a hard cut,
  // so it starts late and lands shallow — at 0.09 it put visible black bands
  // across the top and bottom of a 16:10 frame and undid the full bleed.
  vec2 vp = v_uv - 0.5;
  float vig = smoothstep(0.62, 1.18, length(vp * vec2(u_aspect / max(u_aspect, 1.0), 1.0)) * 1.3);
  L -= vig * 0.045;

  L = clamp((L - 0.5) * u_contrast + 0.5 + u_bias, 0.0, 1.0);
  vec3 col = ramp(L);

  col = mix(col, u_accent, clamp(a, 0.0, 1.0) * 0.36);

  // the low end of a full-bleed ramp is a very long flat gradient, which is
  // exactly where 8-bit banding shows
  float dith = (hash32(gl_FragCoord.xy).x - 0.5) / 255.0;
  fragColor = vec4(col + dith, 1.0);
}`;

type RGB = [number, number, number];
type FBO = { tex: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number };
type Double = { read: FBO; write: FBO; swap: () => void };

function parseColor(raw: string): RGB | null {
  const v = raw.trim();
  if (!v) return null;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((ch) => ch + ch).join("");
    const n = parseInt(h, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const fn = /^rgba?\(([^)]+)\)$/i.exec(v);
  if (fn) {
    const parts = fn[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    if (parts.length >= 3) return [parts[0] / 255, parts[1] / 255, parts[2] / 255];
  }
  return null;
}

function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function luminance([r, g, b]: RGB): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// ---------------------------------------------------------------------------
// Surface — the GL host: context, programs, ping-pong targets, one fullscreen
// triangle. It knows nothing about convection, so a second preset could mount
// it with different shader sources.
// ---------------------------------------------------------------------------
class Surface {
  gl: WebGL2RenderingContext | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private buffer: WebGLBuffer | null = null;
  private programs: WebGLProgram[] = [];
  private locs = new WeakMap<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  private fbos: FBO[] = [];
  private active: WebGLProgram | null = null;

  constructor(private canvas: HTMLCanvasElement) {}

  init(): boolean {
    const gl = this.canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    if (!gl) return false;
    this.gl = gl;
    // RGBA16F is only colour-renderable behind one of these. Without it
    // nothing renders and the caller's children sit on --background.
    const ext =
      gl.getExtension("EXT_color_buffer_float") ??
      gl.getExtension("EXT_color_buffer_half_float");
    if (!ext) return false;
    gl.getExtension("OES_texture_float_linear");

    this.buffer = gl.createBuffer();
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    return true;
  }

  program(frag: string): WebGLProgram | null {
    const gl = this.gl;
    if (!gl) return null;
    const vs = this.compile(gl.VERTEX_SHADER, VERT_SRC);
    const fs = this.compile(gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    if (!p) return null;
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, "a_pos");
    gl.linkProgram(p);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      gl.deleteProgram(p);
      return null;
    }
    this.programs.push(p);
    this.locs.set(p, new Map());
    return p;
  }

  private compile(type: number, src: string): WebGLShader | null {
    const gl = this.gl!;
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  use(p: WebGLProgram) {
    this.gl?.useProgram(p);
    this.active = p;
  }

  private loc(name: string): WebGLUniformLocation | null {
    const p = this.active;
    if (!p || !this.gl) return null;
    const map = this.locs.get(p)!;
    if (!map.has(name)) map.set(name, this.gl.getUniformLocation(p, name));
    return map.get(name) ?? null;
  }

  f(n: string, x: number) {
    this.gl?.uniform1f(this.loc(n), x);
  }
  v2(n: string, x: number, y: number) {
    this.gl?.uniform2f(this.loc(n), x, y);
  }
  v3(n: string, c: RGB) {
    this.gl?.uniform3f(this.loc(n), c[0], c[1], c[2]);
  }
  v3f(n: string, x: number, y: number, z: number) {
    this.gl?.uniform3f(this.loc(n), x, y, z);
  }
  tex(n: string, unit: number, t: WebGLTexture) {
    const gl = this.gl;
    if (!gl) return;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.uniform1i(this.loc(n), unit);
  }

  makeFBO(w: number, h: number): FBO | null {
    const gl = this.gl!;
    const tex = gl.createTexture();
    if (!tex) return null;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const fbo = gl.createFramebuffer();
    if (!fbo) {
      gl.deleteTexture(tex);
      return null;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteTexture(tex);
      gl.deleteFramebuffer(fbo);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return null;
    }
    // the field's rest state is T = 0, c = 1: a surface with nothing moving on
    // it yet and its material spread evenly
    gl.clearColor(0, 1, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const f: FBO = { tex, fbo, w, h };
    this.fbos.push(f);
    return f;
  }

  makeDouble(w: number, h: number): Double | null {
    const a = this.makeFBO(w, h);
    const b = this.makeFBO(w, h);
    if (!a || !b) return null;
    const d: Double = {
      read: a,
      write: b,
      swap: () => {
        const t = d.read;
        d.read = d.write;
        d.write = t;
      },
    };
    return d;
  }

  blit(target: FBO | null) {
    const gl = this.gl;
    if (!gl) return;
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.w, target.h);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  free(f: FBO | null) {
    const gl = this.gl;
    if (!gl || !f) return;
    gl.deleteTexture(f.tex);
    gl.deleteFramebuffer(f.fbo);
    this.fbos = this.fbos.filter((x) => x !== f);
  }

  freeDouble(d: Double | null) {
    if (!d) return;
    this.free(d.read);
    this.free(d.write);
  }

  destroy() {
    const gl = this.gl;
    if (!gl) return;
    for (const f of this.fbos.slice()) this.free(f);
    for (const p of this.programs) gl.deleteProgram(p);
    if (this.buffer) gl.deleteBuffer(this.buffer);
    if (this.vao) gl.deleteVertexArray(this.vao);
    this.programs = [];
    this.fbos = [];
    this.buffer = null;
    this.vao = null;
    this.active = null;
    this.gl = null;
  }
}

// A convecting surface has no meaningful t = 0 — an unstirred field is a flat
// grey rectangle. The sim is spun up before the first paint in EVERY mode, at
// a coarse step (semi-Lagrangian advection is unconditionally stable, so the
// only cost of a big dt is a little extra diffusion that settles out within a
// second of live stepping). 300 steps at 1/16s is nearly twenty seconds of
// convection: cells have already been born, expanded and died, and the lane
// network is fully knitted before anyone looks at it.
const WARMUP_STEPS = 300;
const WARMUP_DT = 1 / 16;
const STATIC_STEPS = 460;

// Pointer smoothing. A plain exponential follower has a steady-state error of
// exactly velocity*tau under constant motion, so the upwelling would sit that
// far behind the cursor and read as the surface responding late. Extrapolating
// the target one tau ahead cancels the term algebraically; the smoothing is
// then spent only on direction changes and on interpolating between events
// that arrived sparser than frames. The velocity window has to outlive the gap
// between two pointer events or the estimate — and with it the compensation —
// collapses to zero on any frame that carried none.
const POINTER_TAU = 0.012;
const VEL_TAU = 0.06;
const LEAD_MAX = 26;

export function GranuleChurn({
  density = 1,
  speed = 1,
  faculae = 1,
  paused = false,
  children,
  className = "",
  style,
}: GranuleChurnProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const surface = new Surface(canvas);
    if (!surface.init()) return;
    const simProg = surface.program(SIM_SRC);
    const renderProg = surface.program(RENDER_SRC);
    if (!simProg || !renderProg) {
      surface.destroy();
      return;
    }

    let raf = 0;
    let running = false;
    let staticMode = false;
    let disposed = false;
    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    let simW = 0;
    let simH = 0;
    let field: Double | null = null;
    let lastMs = performance.now();
    let simTime = 0;

    // Adaptive ladder. Every threshold is wall clock, never frames: a
    // frame-counted gate waits longer the slower the machine is, which is
    // backwards. Display scale goes first because the render pass is the one
    // that scales with DPR; sim resolution is last because it is what keeps
    // the lanes thin.
    const DISPLAY_SCALES = [1, 0.8, 0.62];
    // the sim runs far below display resolution and is magnified with a linear
    // fetch, so its long side sets how fine a lane can be. At 640 against a
    // 2880px backing a lane was four device pixels wide before filtering and
    // the whole field read soft. 768 is the point where lanes come back to a
    // hard edge; the pass is ~0.3M fragments, a rounding error next to the
    // 5.2M-fragment render pass it feeds.
    const SIM_LONG = [896, 704, 512];
    const BUDGET_OVER = 26;
    let tier = 0;
    let frameEma = 16.7;
    let overMs = 0;
    let underMs = 0;
    let upWindow = 8000;

    let hoverTarget = 0;
    let hoverAmt = 0;
    let pressAmt = 0;
    let pressTarget = 0;

    let havePointer = false;
    let tgtX = 0;
    let tgtY = 0;
    let ptrX = 0;
    let ptrY = 0;
    let velX = 0;
    let velY = 0;
    let lastTgtX = 0;
    let lastTgtY = 0;
    let rectLeft = 0;
    let rectTop = 0;
    let rectDirty = true;

    let c0: RGB = [0.02, 0.02, 0.03];
    let c1: RGB = [0.1, 0.1, 0.11];
    let c2: RGB = [0.42, 0.42, 0.44];
    let c3: RGB = [0.86, 0.86, 0.87];
    let c4: RGB = [1, 1, 1];
    let accent: RGB = [0, 0.42, 1];
    let bias = 0;
    let contrast = 1.18;
    let mottle = 0.14;

    // Five stops, and the direction genuinely inverts between themes. A
    // reflective surface can span black-to-white in both because it is lit by
    // a room; a self-luminous one cannot — brightness IS the subject, so light
    // theme has to be the negative, not a dimmed positive. Its stops are
    // written apart rather than derived with a bias term, and they stop short
    // of black on purpose: granules cover most of the frame, so ramping their
    // interiors all the way down would hand the light theme a black page.
    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      const bg = parseColor(cs.getPropertyValue("--background")) ?? [1, 1, 1];
      const fg = parseColor(cs.getPropertyValue("--foreground")) ?? [0.09, 0.09, 0.09];
      const muted = parseColor(cs.getPropertyValue("--ns-muted")) ?? [0.55, 0.55, 0.55];
      const border = parseColor(cs.getPropertyValue("--border")) ?? [0.2, 0.2, 0.2];
      accent = parseColor(cs.getPropertyValue("--ns-accent")) ?? [0, 0.42, 1];
      const black: RGB = [0, 0, 0];
      const white: RGB = [1, 1, 1];
      if (luminance(bg) < 0.5) {
        // a star: lanes sink below the page, granule tops climb past --foreground
        c0 = mixRGB(bg, black, 0.6);
        c1 = mixRGB(border, bg, 0.1);
        c2 = mixRGB(muted, fg, 0.25);
        c3 = fg;
        c4 = mixRGB(fg, white, 0.9);
        bias = -0.04;
        contrast = 1.2;
        mottle = 0.17;
        accent = mixRGB(accent, white, 0.2);
      } else {
        // the negative: pale lanes, graphite granules, and the darkest stop
        // held well off black so the field reads as inked paper
        c0 = bg;
        c1 = mixRGB(bg, muted, 0.42);
        c2 = mixRGB(muted, fg, 0.3);
        c3 = mixRGB(fg, muted, 0.34);
        c4 = mixRGB(fg, black, 0.15);
        bias = 0.02;
        contrast = 1.14;
        mottle = 0.15;
        accent = mixRGB(accent, bg, 0.35);
      }
    };
    readColors();

    const cellsAcross = () => 15 * Math.max(0.35, Math.min(2.5, density));

    const setSimUniforms = (dt: number, ptrStrength: number) => {
      surface.use(simProg);
      surface.f("u_aspect", cssW / Math.max(1, cssH));
      surface.f("u_cells", cellsAcross());
      surface.f("u_time", simTime);
      surface.f("u_dt", dt);
      surface.f("u_flow", 0.55 * Math.max(0.05, speed));
      surface.f("u_split", 1);
      surface.f("u_fleck", Math.max(0, faculae));
      surface.v2("u_texel", 1 / simW, 1 / simH);
      surface.v2("u_grid", simW, simH);
      surface.v3f("u_ptr", ptrX / Math.max(1, cssW), ptrY / Math.max(1, cssH), ptrStrength);
      surface.f("u_ptrAcc", ptrStrength > 0 ? Math.min(1, ptrStrength * 1.1) : 0);
    };

    const step = (dt: number) => {
      if (!field) return;
      const strength = havePointer ? hoverAmt * (0.5 + 0.9 * pressAmt) : 0;
      simTime += dt * Math.max(0.05, speed);
      setSimUniforms(dt, strength);
      surface.tex("u_field", 0, field.read.tex);
      surface.blit(field.write);
      field.swap();
    };

    const render = () => {
      if (!field) return;
      surface.use(renderProg);
      surface.f("u_aspect", cssW / Math.max(1, cssH));
      surface.f("u_cells", cellsAcross());
      surface.f("u_time", simTime);
      surface.v2("u_texel", 1 / simW, 1 / simH);
      surface.v2("u_res", cssW, cssH);
      surface.v3("u_c0", c0);
      surface.v3("u_c1", c1);
      surface.v3("u_c2", c2);
      surface.v3("u_c3", c3);
      surface.v3("u_c4", c4);
      surface.v3("u_accent", accent);
      surface.f("u_bias", bias);
      surface.f("u_contrast", contrast);
      surface.f("u_mottle", mottle);
      surface.tex("u_field", 0, field.read.tex);
      surface.blit(null);
    };

    const seed = (steps: number) => {
      const savedTime = simTime;
      simTime = 0;
      for (let i = 0; i < steps; i++) step(WARMUP_DT);
      // the clock keeps running from where the spin-up left it, so a resize
      // that re-seeds does not restart every plume's phase
      simTime = savedTime > 0 ? savedTime : simTime;
    };

    const buildTargets = () => {
      const gl = surface.gl;
      if (!gl || cssW < 2 || cssH < 2) return;
      const long = SIM_LONG[tier];
      const aspect = cssW / cssH;
      const w = aspect >= 1 ? long : Math.max(96, Math.round(long * aspect));
      const h = aspect >= 1 ? Math.max(96, Math.round(long / aspect)) : long;
      if (field && simW === w && simH === h) return;
      surface.freeDouble(field);
      simW = w;
      simH = h;
      field = surface.makeDouble(w, h);
      seed(WARMUP_STEPS);
    };

    const applyBacking = () => {
      if (cssW < 2 || cssH < 2) return;
      // Capped at 1.7 rather than the usual 2. The render pass is full-bleed
      // and costs five texture fetches plus three octaves of value noise per
      // fragment, so the area term dominates everything else in the component:
      // measured with a readPixels fence on an M3 (ANGLE/Metal — gl.finish()
      // is a no-op there and reads 0.00ms, which is how a naive bench calls
      // this free), an uncapped 2880x1800 costs 8.2ms of a 16.7ms budget. That
      // is inside it, but it is half the frame for a BACKGROUND, and this
      // surface is never the only thing on the page. 1.7 spends 5.9ms for a
      // field of continuous noise whose finest structure is well under a
      // device pixel either way — there is no visible loss, only headroom.
      dpr = Math.min(window.devicePixelRatio || 1, 1.7) * DISPLAY_SCALES[tier];
      const pw = Math.max(1, Math.round(cssW * dpr));
      const ph = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    };

    let resizeRaf = 0;
    const doResize = () => {
      resizeRaf = 0;
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      cssW = rect.width;
      cssH = rect.height;
      rectLeft = rect.left;
      rectTop = rect.top;
      rectDirty = false;
      // a new size is a new cost, so the ladder starts over rather than
      // carrying a verdict earned at a different number of fragments
      tier = 0;
      overMs = 0;
      underMs = 0;
      upWindow = 8000;
      frameEma = 16.7;
      applyBacking();
      buildTargets();
      render();
    };
    // ResizeObserver fires on every step of a window drag; coalescing to one
    // rAF is what stops a drag from paying for a re-seed per pixel
    const resize = () => {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(doResize);
    };

    const stepPointer = (dt: number) => {
      if (!havePointer || dt <= 0) return;
      const vk = 1 - Math.exp(-dt / VEL_TAU);
      velX += ((tgtX - lastTgtX) / dt - velX) * vk;
      velY += ((tgtY - lastTgtY) / dt - velY) * vk;
      lastTgtX = tgtX;
      lastTgtY = tgtY;
      let leadX = velX * POINTER_TAU;
      let leadY = velY * POINTER_TAU;
      const lead = Math.hypot(leadX, leadY);
      if (lead > LEAD_MAX) {
        leadX = (leadX / lead) * LEAD_MAX;
        leadY = (leadY / lead) * LEAD_MAX;
      }
      const k = 1 - Math.exp(-dt / POINTER_TAU);
      ptrX += (tgtX + leadX - ptrX) * k;
      ptrY += (tgtY + leadY - ptrY) * k;
    };

    const loop = (nowMs: number) => {
      const rawMs = nowMs - lastMs;
      lastMs = nowMs;
      const dt = Math.min(0.05, Math.max(0.0005, rawMs / 1000));
      hoverAmt += (hoverTarget - hoverAmt) * (1 - Math.exp(-dt * 7));
      pressAmt += (pressTarget - pressAmt) * (1 - Math.exp(-dt * 6));
      stepPointer(dt);
      step(dt);
      render();

      const clamped = Math.min(50, rawMs);
      frameEma += (clamped - frameEma) * (1 - Math.exp(-clamped / 120));
      if (frameEma > BUDGET_OVER) {
        overMs += clamped;
        underMs = 0;
      } else {
        underMs += clamped;
        overMs = 0;
      }
      // asymmetric: drop after a sustained stretch of stutter, climb back only
      // after a much longer clean one, and double the wait each time — the
      // frame time being watched is the PAGE's, and this surface is rarely
      // what blew it, so a sibling's layout storm must not permanently soften it
      const down = overMs > 1600 && tier < DISPLAY_SCALES.length - 1;
      const up = underMs > upWindow && tier > 0;
      if (down || up) {
        tier += down ? 1 : -1;
        if (down) upWindow = Math.min(64000, upWindow * 2);
        overMs = 0;
        underMs = 0;
        frameEma = 16.7;
        applyBacking();
        buildTargets();
      }
      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (running || disposed) return;
      running = true;
      lastMs = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const sleep = () => {
      cancelAnimationFrame(raf);
      running = false;
    };

    const syncRect = () => {
      if (!rectDirty) return;
      const rect = wrap.getBoundingClientRect();
      rectLeft = rect.left;
      rectTop = rect.top;
      rectDirty = false;
    };
    const markRectDirty = () => {
      rectDirty = true;
    };

    const setTarget = (e: PointerEvent) => {
      syncRect();
      const co = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : null;
      const last = co && co.length > 0 ? co[co.length - 1] : e;
      tgtX = last.clientX - rectLeft;
      tgtY = last.clientY - rectTop;
    };
    const snapPointer = () => {
      ptrX = tgtX;
      ptrY = tgtY;
      velX = 0;
      velY = 0;
      lastTgtX = tgtX;
      lastTgtY = tgtY;
      havePointer = true;
    };
    // static mode has no loop to smooth in, so pointer input runs one further
    // step under the cursor and repaints the frozen frame
    const staticPoke = () => {
      hoverAmt = 1;
      step(1 / 60);
      render();
    };

    const onPointerEnter = (e: PointerEvent) => {
      hoverTarget = 1;
      setTarget(e);
      snapPointer();
      if (staticMode) staticPoke();
    };
    const onPointerMove = (e: PointerEvent) => {
      setTarget(e);
      if (!havePointer) {
        snapPointer();
        hoverTarget = 1;
      }
      if (staticMode) {
        ptrX = tgtX;
        ptrY = tgtY;
        staticPoke();
      }
    };
    const onPointerLeave = () => {
      hoverTarget = 0;
      pressTarget = 0;
      havePointer = false;
    };
    const onPointerDown = (e: PointerEvent) => {
      setTarget(e);
      snapPointer();
      hoverTarget = 1;
      pressTarget = 1;
      if (staticMode) staticPoke();
    };
    const onPointerUp = (e: PointerEvent) => {
      pressTarget = 0;
      // a lifted touch has no position any more and no pointerleave is coming
      if (e.pointerType !== "mouse") {
        hoverTarget = 0;
        havePointer = false;
      }
    };
    const onPointerCancel = () => {
      hoverTarget = 0;
      pressTarget = 0;
      havePointer = false;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    doResize();

    wrap.addEventListener("pointerenter", onPointerEnter);
    wrap.addEventListener("pointerleave", onPointerLeave);
    wrap.addEventListener("pointermove", onPointerMove);
    wrap.addEventListener("pointerdown", onPointerDown);
    wrap.addEventListener("pointerup", onPointerUp);
    wrap.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("scroll", markRectDirty, { passive: true, capture: true });
    window.addEventListener("resize", markRectDirty, { passive: true });

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    const applyMode = () => {
      if (reduced || pausedRef.current) {
        if (!staticMode) {
          staticMode = true;
          sleep();
          // reduced motion still gets a fully developed surface, just a frozen
          // one: a longer spin-up and then no further stepping
          seed(STATIC_STEPS - WARMUP_STEPS);
          render();
        }
      } else if (staticMode || !running) {
        staticMode = false;
        wake();
      }
    };
    const onMq = () => {
      reduced = mq.matches;
      applyMode();
    };
    mq.addEventListener("change", onMq);

    let onScreen = true;
    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((en) => en.isIntersecting);
        if (!onScreen) sleep();
        else if (!staticMode && !document.hidden) wake();
      },
      { threshold: 0 }
    );
    io.observe(wrap);

    const onVis = () => {
      if (document.hidden) sleep();
      else if (!staticMode && onScreen) wake();
    };
    document.addEventListener("visibilitychange", onVis);
    applyMode();

    // polled rather than made an effect dependency: either would tear down and
    // rebuild the GL context to change a boolean
    let lastPolledPaused = pausedRef.current;
    let poll = 0;
    const tick = () => {
      if (pausedRef.current !== lastPolledPaused) {
        lastPolledPaused = pausedRef.current;
        if (!pausedRef.current && !reduced) staticMode = true; // force applyMode to wake
        applyMode();
      }
      poll = window.setTimeout(tick, 140);
    };
    tick();

    const themeObserver = new MutationObserver(() => {
      readColors();
      if (staticMode) render();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const onLost = (e: Event) => {
      e.preventDefault();
      sleep();
    };
    const onRestored = () => {
      field = null;
      if (surface.init()) doResize();
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    return () => {
      disposed = true;
      sleep();
      cancelAnimationFrame(resizeRaf);
      ro.disconnect();
      io.disconnect();
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      themeObserver.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      wrap.removeEventListener("pointerenter", onPointerEnter);
      wrap.removeEventListener("pointerleave", onPointerLeave);
      wrap.removeEventListener("pointermove", onPointerMove);
      wrap.removeEventListener("pointerdown", onPointerDown);
      wrap.removeEventListener("pointerup", onPointerUp);
      wrap.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("scroll", markRectDirty, {
        capture: true,
      } as EventListenerOptions);
      window.removeEventListener("resize", markRectDirty);
      window.clearTimeout(poll);
      surface.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [density, speed, faculae]);

  return (
    <div
      ref={wrapRef}
      className={`relative isolate h-full w-full touch-none overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block" />
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}

GranuleChurn.displayName = "GranuleChurn";
