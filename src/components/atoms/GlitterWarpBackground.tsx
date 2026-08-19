"use client";

import { useEffect, useRef } from "react";
import { useExperienceStore } from "@/store/useExperienceStore";

type Star = {
  x: number;
  y: number;
  z: number;
  px: number;
  py: number;
  seed: number;
  vmul: number;
  colorIdx: number;
};

type Rgba = [number, number, number, number];

type Props = { mobileMode?: boolean };

const COLORS = ["#ffffff", "#a8c5ff", "#d7c5ff"] as const;

function parseColor(input: string): Rgba {
  const hex = input.replace("#", "");
  const value = Number.parseInt(hex, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 1];
}

export function GlitterWarpBackground({ mobileMode = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const particleCount = mobileMode ? 170 : 390;
    const targetFps = mobileMode ? 30 : 60;
    const minFrameMs = 1000 / targetFps;
    const colors = COLORS.map(parseColor);
    const rgb = colors.map((color) => `rgb(${color[0]}, ${color[1]}, ${color[2]})`);
    const stars: Star[] = [];

    let width = 1;
    let height = 1;
    let dpr = 1;
    let raf = 0;
    let lastTime = performance.now();
    let lastDrawTime = 0;
    let previousProgress = useExperienceStore.getState().scrollProgress;
    let travelSpeed = 0;

    const focalDepth = 0.055;
    const density = 5.4;

    const resetStar = (star: Star, initial = false) => {
      const angle = Math.random() * Math.PI * 2;
      const radius = (0.12 + Math.random() * 0.88) * density;
      star.x = Math.cos(angle) * radius;
      star.y = Math.sin(angle) * radius;
      star.z = initial ? focalDepth + Math.random() * (1 - focalDepth) : 1;
      star.px = Number.NaN;
      star.py = Number.NaN;
      star.seed = Math.random();
      star.vmul = 0.62 + Math.random() * 0.86;
      star.colorIdx = Math.floor(Math.random() * rgb.length);
    };

    for (let index = 0; index < particleCount; index += 1) {
      const star: Star = {
        x: 0,
        y: 0,
        z: 0,
        px: Number.NaN,
        py: Number.NaN,
        seed: 0,
        vmul: 1,
        colorIdx: 0,
      };
      resetStar(star, true);
      stars.push(star);
    }

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.floor(rect.width));
      const nextHeight = Math.max(1, Math.floor(rect.height));
      const nextDpr = mobileMode ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
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
      raf = requestAnimationFrame(draw);
      if (now - lastDrawTime < minFrameMs) return;

      const deltaSec = Math.max(0.001, Math.min(0.05, (now - lastTime) / 1000));
      lastTime = now;
      lastDrawTime = now;

      const experience = useExperienceStore.getState();
      const progressVelocity = Math.abs(experience.scrollProgress - previousProgress) / deltaSec;
      previousProgress = experience.scrollProgress;
      const betweenPlanets = 1 - experience.focusStrength;
      const targetTravelSpeed = Math.min(1, betweenPlanets * 0.78 + progressVelocity * 0.42);
      travelSpeed += (targetTravelSpeed - travelSpeed) * (1 - Math.exp(-deltaSec * 5.5));

      const cx = width / 2;
      const cy = height / 2;
      const projectionScale = Math.min(width, height) * 0.94;
      const frameScale = deltaSec * 60;
      const stepZ = (mobileMode ? 0.0018 : 0.00215) * (0.52 + travelSpeed * 4.8);
      const streakAlpha = 0.035 + travelSpeed * 0.085;

      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(0,0,0,${0.24 - travelSpeed * 0.09})`;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";

      for (const star of stars) {
        star.z -= stepZ * star.vmul * frameScale;
        if (star.z <= focalDepth) {
          resetStar(star);
          continue;
        }

        const drift = (star.seed - 0.5) * 0.018 * travelSpeed;
        const perspective = focalDepth / Math.max(star.z, 0.0001);
        const sx = cx + (star.x + drift) * perspective * projectionScale;
        const sy = cy + star.y * perspective * projectionScale;

        if (sx < -30 || sx > width + 30 || sy < -30 || sy > height + 30) {
          resetStar(star);
          continue;
        }

        const near = Math.min(1, (1 - star.z) * 1.7);
        const radius = Math.max(0.35, (0.5 + star.seed * 1.2) * (0.55 + near * 1.1));
        const alpha = (0.16 + near * 0.58) * (0.72 + star.seed * 0.28);
        const color = rgb[star.colorIdx];

        if (!Number.isNaN(star.px) && !Number.isNaN(star.py)) {
          ctx.globalAlpha = alpha * (0.18 + travelSpeed * 0.66);
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(0.35, radius * (0.45 + travelSpeed * 0.5));
          ctx.beginPath();
          ctx.moveTo(star.px, star.py);
          ctx.lineTo(
            sx + (sx - star.px) * travelSpeed * 2.6,
            sy + (sy - star.py) * travelSpeed * 2.6,
          );
          ctx.stroke();
        }

        ctx.globalAlpha = Math.min(1, alpha + streakAlpha);
        ctx.fillStyle = color;
        ctx.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);

        star.px = sx;
        star.py = sy;
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [mobileMode]);

  return (
    <div
      ref={containerRef}
      className="planet-warp-background"
      aria-hidden="true"
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
