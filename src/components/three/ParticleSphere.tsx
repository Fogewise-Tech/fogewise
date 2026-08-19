"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * ParticleSphere
 *
 * R3F version of the Particle Sphere concept supplied by the user.
 * The important behavior is kept here instead of being hidden inside a
 * planet-specific renderer:
 * - Fibonacci / golden-angle distribution over a sphere shell
 * - configurable particle count, size, scale, speed and direction
 * - per-node sphere color (the planet wrapper supplies a deterministic random color)
 * - additive particle rendering
 *
 * The original Originkit component creates its own Scene/Camera/WebGLRenderer.
 * This project already owns one @react-three/fiber Canvas, so creating one
 * WebGL renderer per planet would be both incorrect for world positioning and
 * extremely expensive on mobile. This version renders the same sphere inside
 * the existing R3F scene.
 */

export type ParticleSphereProps = {
  particlesCount?: number;
  particleScale?: number;
  speed?: number;
  smoothing?: number;
  scale?: number;
  stopOnHover?: boolean;
  rotationDirection?: "clockwise" | "anticlockwise";
  dragSpeed?: number;
  drag?: boolean;
  cursorOn?: boolean;
  cursorRadiusUI?: number;
  cursorStrengthUI?: number;
  clickForce?: number;
  sphereColor?: string;
  accentColor?: string;
  seed?: number;
  active?: boolean;
  opacity?: number;
  mobileMode?: boolean;
};

type SphereBuffers = {
  positions: Float32Array;
  colors: Float32Array;
};

function createSeededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function buildFibonacciSphere(
  count: number,
  radius: number,
  seed: number,
  baseColor: THREE.Color,
  accentColor: THREE.Color,
): SphereBuffers {
  const safeCount = Math.max(16, Math.floor(count));
  const positions = new Float32Array(safeCount * 3);
  const colors = new Float32Array(safeCount * 3);
  const random = createSeededRandom(seed ^ 0x9e3779b9);

  // Same golden-angle / Fibonacci-sphere principle as the supplied
  // Particle Sphere source. It gives a uniform shell without latitude bands.
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const white = new THREE.Color("#ffffff");

  for (let i = 0; i < safeCount; i += 1) {
    const y = 1 - (i / Math.max(1, safeCount - 1)) * 2;
    const horizontalRadius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * i;

    // Very small seeded shell jitter avoids a mathematically perfect grid while
    // keeping the silhouette spherical.
    const shell = radius * (0.985 + random() * 0.03);
    const x = Math.cos(theta) * horizontalRadius * shell;
    const z = Math.sin(theta) * horizontalRadius * shell;

    const offset = i * 3;
    positions[offset] = x;
    positions[offset + 1] = y * shell;
    positions[offset + 2] = z;

    const mix = 0.12 + random() * 0.78;
    const color = baseColor.clone().lerp(accentColor, mix);

    // Sparse hot particles make the sphere read like the reference instead of
    // a flat uniformly-colored point cloud.
    if (random() > 0.965) color.lerp(white, 0.82);

    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
  }

  return { positions, colors };
}

export function ParticleSphere({
  particlesCount = 2600,
  particleScale = 5,
  speed = 2,
  smoothing = 7,
  scale = 1,
  stopOnHover = false,
  rotationDirection = "clockwise",
  dragSpeed = 5,
  drag = false,
  cursorOn = false,
  cursorRadiusUI = 75,
  cursorStrengthUI = 10,
  clickForce = 5,
  sphereColor = "#ffffff",
  accentColor,
  seed = 1,
  active = false,
  opacity = 1,
  mobileMode = false,
}: ParticleSphereProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const hoveredRef = useRef(false);
  const targetRotation = useRef(new THREE.Vector2());
  const pointerDown = useRef(false);
  const previousPointer = useRef(new THREE.Vector2());

  const palette = useMemo(() => {
    const base = new THREE.Color(sphereColor);
    const accent = accentColor
      ? new THREE.Color(accentColor)
      : base.clone().offsetHSL(0.07, 0.06, 0.12);
    return { base, accent };
  }, [accentColor, sphereColor]);

  const radius = Math.max(0.1, scale);
  const effectiveCount = mobileMode
    ? Math.min(Math.max(420, Math.floor(particlesCount * 0.38)), 1100)
    : particlesCount;

  const buffers = useMemo(
    () =>
      buildFibonacciSphere(
        effectiveCount,
        radius,
        seed,
        palette.base,
        palette.accent,
      ),
    [effectiveCount, palette, radius, seed],
  );

  useFrame((state, delta) => {
    const points = pointsRef.current;
    const material = materialRef.current;
    if (!points || !material) return;

    const direction = rotationDirection === "anticlockwise" ? -1 : 1;
    const shouldRotate = !(stopOnHover && hoveredRef.current);
    const speedInternal = THREE.MathUtils.lerp(0.045, 0.22, THREE.MathUtils.clamp(speed / 10, 0, 1));

    if (shouldRotate && !pointerDown.current) {
      targetRotation.current.x += delta * speedInternal * direction;
      targetRotation.current.y += delta * speedInternal * 0.22;
    }

    const smoothingN = THREE.MathUtils.clamp(smoothing / 10, 0, 1);
    const damp = THREE.MathUtils.lerp(12, 3.5, smoothingN);
    points.rotation.y = THREE.MathUtils.damp(
      points.rotation.y,
      targetRotation.current.x,
      damp,
      delta,
    );
    points.rotation.x = THREE.MathUtils.damp(
      points.rotation.x,
      targetRotation.current.y,
      damp,
      delta,
    );

    // Global pulse only; no O(N) particle mutation every frame. This keeps the
    // visual alive while remaining much cheaper than updating thousands of
    // instance matrices on mobile.
    const pulse = active ? 1 + Math.sin(state.clock.elapsedTime * 1.7 + seed) * 0.035 : 1;
    points.scale.setScalar(pulse);

    const baseSize = mobileMode ? 0.052 : 0.044;
    const sizeFromUi = THREE.MathUtils.lerp(0.55, 1.65, THREE.MathUtils.clamp(particleScale / 10, 0, 1));
    const targetSize = baseSize * sizeFromUi * (active ? 1.18 : 0.92);
    material.size = THREE.MathUtils.damp(material.size, targetSize, 5, delta);

    const targetOpacity = THREE.MathUtils.clamp(opacity * (active ? 1 : 0.58), 0, 1);
    material.opacity = THREE.MathUtils.damp(material.opacity, targetOpacity, 5, delta);
  });

  return (
    <points
      ref={pointsRef}
      frustumCulled={false}
      renderOrder={4}
      onPointerEnter={(event) => {
        event.stopPropagation();
        hoveredRef.current = true;
      }}
      onPointerLeave={() => {
        hoveredRef.current = false;
        pointerDown.current = false;
      }}
      onPointerDown={(event) => {
        if (!drag || mobileMode) return;
        event.stopPropagation();
        pointerDown.current = true;
        previousPointer.current.set(event.pointer.x, event.pointer.y);
      }}
      onPointerMove={(event) => {
        if (!drag || mobileMode || !pointerDown.current) return;
        event.stopPropagation();
        const dx = event.pointer.x - previousPointer.current.x;
        const dy = event.pointer.y - previousPointer.current.y;
        const sensitivity = THREE.MathUtils.lerp(0.7, 2.8, THREE.MathUtils.clamp(dragSpeed / 10, 0, 1));
        targetRotation.current.x += dx * sensitivity;
        targetRotation.current.y = THREE.MathUtils.clamp(
          targetRotation.current.y + dy * sensitivity,
          -Math.PI / 2,
          Math.PI / 2,
        );
        previousPointer.current.set(event.pointer.x, event.pointer.y);
      }}
      onPointerUp={() => {
        pointerDown.current = false;
      }}
      // Keep compatibility with the supplied Particle Sphere API. Cursor
      // repulsion/scatter is intentionally disabled by the planet wrapper on
      // mobile because doing an O(N) projection loop for every node is one of
      // the largest performance costs in the original standalone component.
      userData={{ cursorOn, cursorRadiusUI, cursorStrengthUI, clickForce }}
    >
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[buffers.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[buffers.colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={materialRef}
        color="#ffffff"
        vertexColors
        size={mobileMode ? 0.052 : 0.044}
        sizeAttenuation
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

export default ParticleSphere;
