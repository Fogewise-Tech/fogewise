"use client";

import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  z: number;
  px: number;
  py: number;
  seed: number;
  vmul: number;
  colorIdx: number;
  flashUntil: number;
  nextFlash: number;
};

type Rgba = [number, number, number, number];

const SETTINGS = {
  // Keep the Originkit preset values from the supplied Glitter Wrap effect.
  particleCount: 579,
  speed: 1,
  density: 100,
  starSize: 7,
  focalDepth: 7,
  turbulence: 0,
  brightness: 82,
  glitterIntensity: 3,
  trailAmount: 100,
  reverse: false,
  // Preserve the portfolio's cool galaxy palette while using the supplied motion/rendering effect.
  colors: ["#ffffff", "#9fb8ff", "#dce6ff"] as const,
};

function parseColor(input: string): Rgba {
  const s = input.trim();
  if (s.startsWith("#")) {
    let hex = s.slice(1);
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    const num = Number.parseInt(hex, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 1];
  }

  const match = s.match(/rgba?\(([^)]+)\)/i);
  if (match) {
    const parts = match[1].split(",").map((part) => Number.parseFloat(part.trim()));
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0, parts[3] ?? 1];
  }

  return [255, 255, 255, 1];
}

export function GlitterWarpBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const stars: Star[] = [];
    const colors = SETTINGS.colors.map(parseColor);
    const rgb = colors.map((color) => `rgb(${color[0]}, ${color[1]}, ${color[2]})`);
    let elapsed = 0;
    let lastTime = performance.now();
    let raf = 0;
    let width = 1;
    let height = 1;
    let dpr = 1;

    const focalDepth = SETTINGS.focalDepth / 100;
    const stepZ = SETTINGS.speed * 0.0008;
    const starScale = SETTINGS.starSize * 0.15;
    const turbulence = SETTINGS.turbulence * 0.2;
    const glitter = SETTINGS.glitterIntensity * 0.1;
    const brightness = Math.min(1, SETTINGS.brightness / 100);
    const trail = SETTINGS.trailAmount / 100;

    const resetStar = (star: Star, initial = false) => {
      const angle = Math.random() * Math.PI * 2;
      const radius = (0.2 + Math.random() * 0.8) * (SETTINGS.density / 15);
      star.x = Math.cos(angle) * radius;
      star.y = Math.sin(angle) * radius;
      star.z = SETTINGS.reverse
        ? initial
          ? focalDepth + Math.random() * (1 - focalDepth)
          : focalDepth
        : initial
          ? Math.max(focalDepth, Math.random())
          : 1;
      star.px = Number.NaN;
      star.py = Number.NaN;
      star.seed = Math.random() * 1000;
      star.vmul = 0.6 + Math.random() * 0.8;
      star.colorIdx = Math.floor(Math.random() * rgb.length);
      star.flashUntil = 0;
      star.nextFlash = elapsed + 1 + Math.random() * 4 * (1 / Math.max(0.0001, glitter));
    };

    for (let i = 0; i < SETTINGS.particleCount; i += 1) {
      const star: Star = {
        x: 0,
        y: 0,
        z: 0,
        px: Number.NaN,
        py: Number.NaN,
        seed: 0,
        vmul: 1,
        colorIdx: 0,
        flashUntil: 0,
        nextFlash: 0,
      };
      resetStar(star, true);
      stars.push(star);
    }

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.floor(rect.width));
      const nextHeight = Math.max(1, Math.floor(rect.height));
      const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
      if (nextWidth === width && nextHeight === height && nextDpr === dpr) return;

      width = nextWidth;
      height = nextHeight;
      dpr = nextDpr;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const draw = (now: number) => {
      const rawDelta = (now - lastTime) / 1000;
      lastTime = now;
      const deltaSec = Math.max(0.001, Math.min(0.1, rawDelta));
      const dt = deltaSec * 60;
      const cx = width / 2;
      const cy = height / 2;
      const projectionScale = Math.min(width, height) * 0.9;

      // Same transparent trail buffer strategy as the supplied Glitter Wrap.
      const keep = Math.pow(Math.min(0.98, Math.max(0, trail)), dt);
      const trailAlpha = Math.max(0.02, 1 - keep);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = `rgba(0, 0, 0, ${trailAlpha})`;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";

      for (const star of stars) {
        const velocityZ = stepZ * star.vmul * dt;
        if (SETTINGS.reverse) {
          star.z += velocityZ;
          if (star.z >= 1) {
            resetStar(star);
            continue;
          }
        } else {
          star.z -= velocityZ;
          if (star.z <= focalDepth) {
            resetStar(star);
            continue;
          }
        }

        let tx = star.x;
        let ty = star.y;
        if (turbulence > 0) {
          const t = elapsed * 1.2 + star.seed;
          const amp = turbulence * (1 - star.z) * 0.25;
          tx += Math.sin(t + star.seed) * amp;
          ty += Math.cos(t * 1.13 + star.seed * 0.7) * amp;
        }

        const perspective = focalDepth / Math.max(star.z, 0.0001);
        const sx = cx + tx * perspective * projectionScale;
        const sy = cy + ty * perspective * projectionScale;

        if (
          !SETTINGS.reverse &&
          (sx < -20 || sx > width + 20 || sy < -20 || sy > height + 20)
        ) {
          resetStar(star);
          continue;
        }

        let flashMultiplier = 1;
        if (glitter > 0) {
          if (elapsed >= star.nextFlash && star.flashUntil < elapsed) {
            star.flashUntil = elapsed + 0.04 + Math.random() * 0.07;
            star.nextFlash =
              elapsed + 1 + Math.random() * 4 * (1 / Math.max(0.0001, glitter));
          }
          if (elapsed <= star.flashUntil) flashMultiplier = 1 + 2.5 * glitter;
        }

        const sizePerspective = Math.min(
          2.5,
          (focalDepth / Math.max(star.z, 0.0001)) * 0.6,
        );
        const baseRadius = Math.max(0.25, starScale * (0.4 + sizePerspective));
        const maxRadius = 1 + starScale * 2.5;
        const radius = Math.min(baseRadius * flashMultiplier, maxRadius);
        const lifeT = SETTINGS.reverse ? star.z : 1 - star.z;
        const fadeIn = SETTINGS.reverse
          ? Math.min(1, (star.z - focalDepth) / (1 - focalDepth) / 0.12)
          : 1;
        const alpha =
          Math.min(1, SETTINGS.reverse ? 0.85 - lifeT * 0.6 : lifeT * 0.9 + 0.05) *
          fadeIn *
          brightness *
          (flashMultiplier > 1 ? 1 : 0.85);
        const color = rgb[star.colorIdx];

        if (!Number.isNaN(star.px) && !Number.isNaN(star.py)) {
          ctx.globalAlpha = alpha * 0.5;
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(0.4, radius * 0.4);
          ctx.beginPath();
          ctx.moveTo(star.px, star.py);
          ctx.lineTo(sx, sy);
          ctx.stroke();
        }

        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);

        if (flashMultiplier > 1) {
          const flashRadius = Math.min(radius * 1.4, maxRadius * 1.4);
          ctx.globalAlpha = alpha * 0.5;
          ctx.fillRect(
            sx - flashRadius,
            sy - flashRadius,
            flashRadius * 2,
            flashRadius * 2,
          );
        }

        star.px = sx;
        star.py = sy;
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      elapsed += deltaSec;
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        pointerEvents: "none",
        background: "#010207",
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
          opacity: 0.72,
        }}
      />
    </div>
  );
}
