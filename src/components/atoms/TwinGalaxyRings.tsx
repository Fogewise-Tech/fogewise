"use client";

import * as React from "react";
import { useEffect, useRef } from "react";
import { useExperienceStore } from "@/store/useExperienceStore";

const RMAX = 1560;
const FOV = 35;
const DPR_CAP = 1.5;
const MOBILE_DPR_CAP = 1;
const TAU = Math.PI * 2;
const VERT = `
precision highp float;

attribute vec2 aPath;
attribute vec3 aOff;
attribute float aHue;

uniform vec2  uRes;
uniform float uFocal;
uniform float uStream;
uniform float uSpin;
uniform float uArms;
uniform float uB;
uniform float uThetaMax;
uniform float uRMin;
uniform float uArmW;
uniform float uArmH;
uniform float uDot;
uniform float uDist;
uniform float uPitchCam;
uniform float uRoll;
uniform vec3  uCols[8];
uniform float uCount;
uniform vec2  uOffset;

varying vec3  vCol;
varying float vA;

void main() {
    float gIn = aOff.x;
    float gOut = aOff.y;
    float bsd = aOff.z;

    float p = fract(aPath.x + uStream);

    float th = p * uThetaMax;
    float r = uRMin * exp(uB * th);

    float a = th + aPath.y * (6.2831853 / uArms) + uSpin;
    float ca = cos(a);
    float sa = sin(a);

    float inv = 1.0 / sqrt(1.0 + uB * uB);
    vec2 nrm = vec2(-(uB * sa + ca), uB * ca - sa) * inv;

    vec2 pos = vec2(r * ca, r * sa) + nrm * gIn * uArmW * mix(0.40, 1.70, p);
    float y = gOut * uArmH;

    float c = cos(uPitchCam);
    float s = sin(uPitchCam);
    float ry = y * c + pos.y * s;
    float rz = uDist - y * s + pos.y * c;

    if (rz < 30.0) {
        gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
        gl_PointSize = 0.0;
        vCol = uCols[0];
        vA = 0.0;
        return;
    }

    float cr = cos(uRoll);
    float sr = sin(uRoll);
    float sx = (pos.x * cr - ry * sr) * uFocal / rz + uOffset.x;
    float sy = (pos.x * sr + ry * cr) * uFocal / rz + uOffset.y;
    gl_Position = vec4(sx / (uRes.x * 0.5), sy / (uRes.y * 0.5), 0.0, 1.0);

    float szv = 0.55 + bsd * 1.70;
    gl_PointSize = clamp(uDot * uFocal / rz * szv, 1.0, 40.0);

    float fade = smoothstep(0.0, 0.10, p) * (1.0 - smoothstep(0.86, 1.0, p));

    float dep = 1.0 - smoothstep(uDist * 1.1, uDist * 2.1, rz) * 0.55;

    float bri = (0.32 + bsd * 0.68) * mix(1.30, 0.80, p);

    float cn = max(uCount, 1.0);
    float idx = min(floor(aHue * cn), cn - 1.0);
    vec3 pal = uCols[0];
    for (int i = 1; i < 8; i++) {
        if (abs(idx - float(i)) < 0.5) pal = uCols[i];
    }
    vCol = mix(pal, vec3(1.0), pow(bri, 5.0) * 0.55);
    vA = bri * fade * dep;
}
`;

const FRAG = `
precision highp float;
varying vec3  vCol;
varying float vA;
void main() {
    gl_FragColor = vec4(vCol * vA, vA);
}
`;

function parseColor(input: string): [number, number, number] {
  if (!input) return [0, 0, 0];
  const s = input.trim();
  const fn = s.match(/rgba?\(([^)]+)\)/i);
  if (fn) {
    const p = fn[1].split(",").map((v) => parseFloat(v.trim()));
    return [(p[0] || 0) / 255, (p[1] || 0) / 255, (p[2] || 0) / 255];
  }
  let h = s.replace("#", "");
  if (h.length === 3 || h.length === 4) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  h = h.padEnd(6, "0");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rnd: () => number) {
  const u1 = Math.max(1e-9, rnd());
  const u2 = rnd();
  const g = Math.sqrt(-2 * Math.log(u1)) * Math.cos(TAU * u2);
  return Math.max(-3, Math.min(3, g));
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn("TwinGalaxyRings shader:", gl.getShaderInfoLog(sh));
  }
  return sh;
}

interface TiltGroup {
  tilt: number;
  sideTilt: number;
}

const ARM_W_AT_100 = 34;
const ARM_H_AT_100 = 16;

const SPIN = 2.8;
const GLOW = "rgba(120, 150, 210, 0.10)";
const ARM_PITCH = 9;
const STREAM_AT_50 = 8;

const MAX_POINTS = 400000;

const MAX_COLORS = 8;
const DEFAULT_COLORS = ["#A050FF", "#C9D6E8"];
function smoothReveal(progress: number, start: number, end: number) {
  const t = Math.min(
    1,
    Math.max(0, (progress - start) / Math.max(0.0001, end - start)),
  );
  return t * t * (3 - 2 * t);
}

interface Props {
  background?: string;
  colors?: string[];
  density?: number;
  dotSize?: number;
  speed?: number;
  direction?: "ccw" | "cw";
  distance?: number;
  innerVoid?: number;
  armThickness?: number;
  armCount?: number;
  tilt?: Partial<TiltGroup>;
  style?: React.CSSProperties;
  projectCount?: number;
  mobileMode?: boolean;
}

function __OriginkitBase_TwinGalaxyRings(props: Props) {
  const scrollProgress = useExperienceStore((state) => state.scrollProgress);

  const {
    background = "#050A14",
    colors = DEFAULT_COLORS,
    density = 98,
    dotSize = 2,
    speed = 47,
    direction = "cw",
    distance = 3540,
    innerVoid = 14,
    armThickness = 100,
    armCount = 5,
    tilt = { tilt: 26, sideTilt: -8 },
    style,
    mobileMode = false,
  } = props;

  // Milky Way is part of the world from the first frame, not a final-screen reveal.
  // Keep it present throughout the journey, then let it become slightly stronger
  // toward the destination without ever popping in/out.
  const opacity = 0.78;

  const palette =
    colors && colors.length ? colors.slice(0, MAX_COLORS) : DEFAULT_COLORS;

  const speedDial = Math.max(0, speed);
  const dirSign = direction === "cw" ? -1 : 1;
  const spin = SPIN;
  const cameraDistance = distance;

  const armPitch = ARM_PITCH;

  const tiltStart = tilt.tilt ?? 26;
  const rollStart = tilt.sideTilt ?? -8;

  const armW = (ARM_W_AT_100 * armThickness) / 100;
  const armH = (ARM_H_AT_100 * armThickness) / 100;
  const tiltEnd = tiltStart + (mobileMode ? 8 : 14);
  const rollEnd = rollStart + (mobileMode ? 10 : 18);

  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const live = useRef({
    palette,
    density: mobileMode ? Math.min(density, 38) : density,
    dotSize,
    armWidth: armW,
    armHeight: armH,
    armCount,
    armPitch,
    innerVoid,
    speedDial,
    dirSign,
    spin,
    cameraDistance,
    tiltStart,
    tiltEnd,
    rollStart,
    rollEnd,
    scrollProgress,
  });
  live.current = {
    palette,
    density: mobileMode ? Math.min(density, 38) : density,
    dotSize,
    armWidth: armW,
    armHeight: armH,
    armCount,
    armPitch,
    innerVoid,
    speedDial,
    dirSign,
    spin,
    cameraDistance,
    tiltStart,
    tiltEnd,
    rollStart,
    rollEnd,
    scrollProgress,
  };

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      depth: false,
    }) as WebGLRenderingContext | null;
    if (!gl) return;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("TwinGalaxyRings link:", gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    const aPath = gl.getAttribLocation(prog, "aPath");
    const aOff = gl.getAttribLocation(prog, "aOff");
    const aHue = gl.getAttribLocation(prog, "aHue");
    const U = (n: string) => gl.getUniformLocation(prog, n);
    const u = {
      res: U("uRes"),
      focal: U("uFocal"),
      stream: U("uStream"),
      spin: U("uSpin"),
      arms: U("uArms"),
      b: U("uB"),
      thetaMax: U("uThetaMax"),
      rMin: U("uRMin"),
      armW: U("uArmW"),
      armH: U("uArmH"),
      dot: U("uDot"),
      dist: U("uDist"),
      pitchCam: U("uPitchCam"),
      roll: U("uRoll"),
      cols: U("uCols[0]"),
      colCount: U("uCount"),
      offset: U("uOffset"),
    };

    const pathBuf = gl.createBuffer()!;
    const offBuf = gl.createBuffer()!;
    const hueBuf = gl.createBuffer()!;

    const colBuf = new Float32Array(MAX_COLORS * 3);
    let colKey = "";
    let colCount = 1;
    const uploadPalette = (list: string[]) => {
      const key = list.join("|");
      if (key === colKey) return;
      colKey = key;
      colCount = Math.max(1, Math.min(MAX_COLORS, list.length));
      for (let i = 0; i < MAX_COLORS; i++) {
        const [r, g, b] = parseColor(list[Math.min(i, colCount - 1)]);
        colBuf[i * 3] = r;
        colBuf[i * 3 + 1] = g;
        colBuf[i * 3 + 2] = b;
      }
    };

    let builtKey = "";
    let count = 0;

    const buildArms = (d: number, arms: number) => {
      const nArms = Math.max(1, Math.round(arms));
      const across = 8;
      const samples = Math.max(
        24,
        Math.min(Math.round(d * 8), Math.floor(MAX_POINTS / (nArms * across))),
      );
      count = nArms * samples * across;

      const pathA = new Float32Array(count * 2);
      const offA = new Float32Array(count * 3);
      const hueA = new Float32Array(count);
      const rnd = mulberry32(0x9a1a1);
      let i = 0;
      for (let arm = 0; arm < nArms; arm++) {
        for (let sIdx = 0; sIdx < samples; sIdx++) {
          const p = sIdx / samples;
          for (let k = 0; k < across; k++) {
            pathA[i * 2] = p;
            pathA[i * 2 + 1] = arm;
            offA[i * 3] = gauss(rnd);
            offA[i * 3 + 1] = gauss(rnd);
            offA[i * 3 + 2] = rnd();
            hueA[i] = rnd();
            i++;
          }
        }
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, pathBuf);
      gl.bufferData(gl.ARRAY_BUFFER, pathA, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, offBuf);
      gl.bufferData(gl.ARRAY_BUFFER, offA, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, hueBuf);
      gl.bufferData(gl.ARRAY_BUFFER, hueA, gl.STATIC_DRAW);
      builtKey = `${d}|${arms}`;
    };

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(
        window.devicePixelRatio || 1,
        mobileMode ? MOBILE_DPR_CAP : DPR_CAP,
      );
      cssW = canvas.clientWidth || host.clientWidth || 0;
      cssH = canvas.clientHeight || host.clientHeight || 0;
      const w = Math.max(1, Math.round(cssW * dpr));
      const h = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const scrollProgress = () => {
      const r = host.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const span = r.height + vh;
      if (span <= 0) return 0;
      const p = (vh - r.top) / span;
      return p < 0 ? 0 : p > 1 ? 1 : p;
    };

    let raf = 0;
    let last = performance.now();
    let stream = 0;
    let spinPhase = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);

      if (mobileMode && now - last < 1000 / 30) return;

      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (cssW <= 0 || cssH <= 0) {
        resize();
        if (cssW <= 0 || cssH <= 0) return;
      }

      const L = live.current;
      // The galaxy is alive throughout the entire journey.
      // It is never gated behind the final section; only its camera approach
      // changes with scroll progress.

      const key = `${L.density}|${L.armCount}`;
      if (key !== builtKey) buildArms(L.density, L.armCount);
      if (count === 0) return;

      const rate = ((L.speedDial / 50) * STREAM_AT_50 * L.dirSign) / 320;

      stream = (stream + dt * rate) % 1;
      spinPhase =
        (spinPhase + dt * ((L.spin * Math.PI) / 180) * 0.14) % TAU;

      const time = now * 0.001;
      const orbit = time * (mobileMode ? 0.085 : 0.072);
      const radiusX = cssW * (mobileMode ? 0.26 : 0.34);
      const radiusY = cssH * (mobileMode ? 0.2 : 0.28);
      const edgeBiasX = Math.sign(Math.cos(orbit)) * Math.pow(Math.abs(Math.cos(orbit)), 0.38);
      const edgeBiasY = Math.sign(Math.sin(orbit)) * Math.pow(Math.abs(Math.sin(orbit)), 0.38);
      const driftX = edgeBiasX * radiusX;
      const driftY = edgeBiasY * radiusY;

      const pitchBase = L.tiltStart + (L.tiltEnd - L.tiltStart) * 0.24;
      const rollBase = L.rollStart + (L.rollEnd - L.rollStart) * 0.18;
      const pitch =
        ((pitchBase + Math.sin(time * 0.09) * (mobileMode ? 2.0 : 3.6)) * Math.PI) / 180;
      const roll =
        (-(rollBase + Math.cos(time * 0.07) * (mobileMode ? 2.8 : 5.0)) * Math.PI) / 180;
      const minDist = RMAX * Math.cos(pitch) + 280;
      const baseDistance = L.cameraDistance * (mobileMode ? 0.92 : 0.78);
      const breathe = Math.sin(time * 0.1 + 0.4) * (mobileMode ? 18.0 : 28.0);
      const dist = Math.max(minDist, baseDistance + breathe);

      const b = Math.max(0.02, Math.tan((L.armPitch * Math.PI) / 180));
      const voidFrac = Math.min(0.9, Math.max(0.01, L.innerVoid / 100));
      const thetaMax = Math.min(Math.log(1 / voidFrac) / b, 24 * Math.PI);
      const rMin = RMAX * Math.exp(-b * thetaMax);

      const wDev = canvas.width;
      const hDev = canvas.height;
      const focal = hDev / (2 * Math.tan(((FOV / 2) * Math.PI) / 180));

      uploadPalette(L.palette);

      gl.uniform2f(u.res, wDev, hDev);
      gl.uniform1f(u.focal, focal);
      gl.uniform1f(u.stream, stream);
      gl.uniform1f(u.spin, spinPhase);
      gl.uniform1f(u.arms, Math.max(1, Math.round(L.armCount)));
      gl.uniform1f(u.b, b);
      gl.uniform1f(u.thetaMax, thetaMax);
      gl.uniform1f(u.rMin, rMin);
      gl.uniform1f(u.armW, L.armWidth);
      gl.uniform1f(u.armH, L.armHeight);
      gl.uniform1f(u.dot, L.dotSize);
      gl.uniform1f(u.dist, dist);
      gl.uniform1f(u.pitchCam, pitch);
      gl.uniform1f(u.roll, roll);
      gl.uniform2f(u.offset, driftX, driftY);
      gl.uniform3fv(u.cols, colBuf);
      gl.uniform1f(u.colCount, colCount);

      gl.bindBuffer(gl.ARRAY_BUFFER, pathBuf);
      gl.enableVertexAttribArray(aPath);
      gl.vertexAttribPointer(aPath, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, offBuf);
      gl.enableVertexAttribArray(aOff);
      gl.vertexAttribPointer(aOff, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, hueBuf);
      gl.enableVertexAttribArray(aHue);
      gl.vertexAttribPointer(aHue, 1, gl.FLOAT, false, 0, 0);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.POINTS, 0, count);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [mobileMode]);

  return (
    <div
      ref={hostRef}
      style={{
        minWidth: 0,
        minHeight: 0,
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        pointerEvents: "none",
        opacity,
        visibility: "visible",
        background: `radial-gradient(46% 40% at 6% 4%, ${GLOW} 0%, transparent 72%), radial-gradient(52% 44% at 96% 6%, ${GLOW} 0%, transparent 74%), radial-gradient(44% 38% at 92% 96%, ${GLOW} 0%, transparent 72%), ${background}`,
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

const __originkitPresetProps = {
  colors: ["#8EB7FF", "#D7E3FF", "#FFD0AF"],
  density: 92,
  dotSize: 1.25,
  speed: 14,
  distance: 2850,
  innerVoid: 8,
  armThickness: 175,
  armCount: 2,
  tilt: { tilt: 18, sideTilt: -10 },
};

export default function TwinGalaxyRings(props: Record<string, unknown>) {
  return (
    <__OriginkitBase_TwinGalaxyRings
      {...(__originkitPresetProps as Record<string, unknown>)}
      {...props}
    />
  );
}
