"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useExperienceStore } from "@/store/useExperienceStore";

type Props = {
  contactPosition: THREE.Vector3;
  strength?: number;
};

type DiskLayerOptions = {
  seed: number;
  count: number;
  innerRadius: number;
  outerRadius: number;
  thickness: number;
  stretchX: number;
  stretchZ: number;
  swirl: number;
  spread: number;
  radiusBias: number;
  warmBias: number;
  warmColor: THREE.ColorRepresentation;
  midColor: THREE.ColorRepresentation;
  coolColor: THREE.ColorRepresentation;
};

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function gaussian(random: () => number) {
  let u = 0;
  let v = 0;
  while (u === 0) u = random();
  while (v === 0) v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}

function createPointSprite() {
  if (typeof document === "undefined") {
    const data = new Uint8Array([255, 255, 255, 255]);
    const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
    texture.needsUpdate = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  if (!context) return new THREE.CanvasTexture(canvas);

  const gradient = context.createRadialGradient(
    size * 0.5,
    size * 0.5,
    0,
    size * 0.5,
    size * 0.5,
    size * 0.5,
  );

  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.16, "rgba(255,255,255,.98)");
  gradient.addColorStop(0.4, "rgba(255,255,255,.32)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");

  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createDiskLayer(options: DiskLayerOptions) {
  const random = seededRandom(options.seed);
  const positions = new Float32Array(options.count * 3);
  const colors = new Float32Array(options.count * 3);

  const warm = new THREE.Color(options.warmColor);
  const mid = new THREE.Color(options.midColor);
  const cool = new THREE.Color(options.coolColor);
  const mixed = new THREE.Color();
  const finalColor = new THREE.Color();

  for (let index = 0; index < options.count; index += 1) {
    const i3 = index * 3;
    const radiusT = Math.pow(random(), options.radiusBias);
    const radius = THREE.MathUtils.lerp(options.innerRadius, options.outerRadius, radiusT);

    const theta =
      random() * Math.PI * 2 +
      radius * options.swirl +
      gaussian(random) * options.spread +
      Math.sin(radius * 0.52) * 0.12;

    const stretch = 0.9 + random() * 0.28;
    positions[i3] = Math.cos(theta) * radius * options.stretchX * stretch;
    positions[i3 + 1] =
      gaussian(random) * options.thickness * (0.38 + radiusT * 0.76);
    positions[i3 + 2] = Math.sin(theta) * radius * options.stretchZ * stretch;

    const warmth = Math.pow(1 - radiusT, options.warmBias);
    mixed.copy(cool).lerp(mid, 0.24 + (1 - radiusT) * 0.42);
    finalColor.copy(mixed).lerp(warm, THREE.MathUtils.clamp(warmth, 0, 1));

    const sparkle = 0.78 + random() * 0.4;
    colors[i3] = finalColor.r * sparkle;
    colors[i3 + 1] = finalColor.g * sparkle;
    colors[i3 + 2] = finalColor.b * sparkle;
  }

  return { positions, colors };
}

function createStreakLayer() {
  const random = seededRandom(0x7f31ae12);
  const segmentCount = 1050;
  const positions = new Float32Array(segmentCount * 2 * 3);
  const colors = new Float32Array(segmentCount * 2 * 3);
  const warm = new THREE.Color("#f6f2eb");
  const cool = new THREE.Color("#526dbd");
  const color = new THREE.Color();

  for (let index = 0; index < segmentCount; index += 1) {
    const radiusT = Math.pow(random(), 0.74);
    const radius = THREE.MathUtils.lerp(3.3, 19.5, radiusT);
    const arm = Math.floor(random() * 3);
    const armAngle = (arm / 3) * Math.PI * 2;
    const theta = armAngle + radius * 1.35 + gaussian(random) * 0.12;
    const segmentLength = THREE.MathUtils.lerp(0.22, 1.45, radiusT) * (0.72 + random() * 0.58);

    const theta2 = theta + segmentLength / Math.max(2.8, radius);
    const base = index * 6;

    positions[base] = Math.cos(theta) * radius * 1.88;
    positions[base + 1] = gaussian(random) * (0.12 + radiusT * 0.2);
    positions[base + 2] = Math.sin(theta) * radius * 0.76;

    positions[base + 3] = Math.cos(theta2) * (radius + segmentLength * 0.08) * 1.88;
    positions[base + 4] = positions[base + 1] + gaussian(random) * 0.03;
    positions[base + 5] = Math.sin(theta2) * (radius + segmentLength * 0.08) * 0.76;

    color.copy(cool).lerp(warm, Math.pow(1 - radiusT, 1.55) * 0.72 + 0.14);
    const brightness = 0.7 + random() * 0.38;

    for (let vertex = 0; vertex < 2; vertex += 1) {
      const c = base + vertex * 3;
      colors[c] = color.r * brightness;
      colors[c + 1] = color.g * brightness;
      colors[c + 2] = color.b * brightness;
    }
  }

  return { positions, colors };
}

export function MilkyWayBackground({ contactPosition, strength = 1 }: Props) {
  const scrollProgress = useExperienceStore((state) => state.scrollProgress);

  const groupRef = useRef<THREE.Group>(null);
  const hazeRef = useRef<THREE.Points>(null);
  const starsRef = useRef<THREE.Points>(null);
  const coreRef = useRef<THREE.Points>(null);
  const streaksRef = useRef<THREE.LineSegments>(null);

  const hazeMaterialRef = useRef<THREE.PointsMaterial>(null);
  const starsMaterialRef = useRef<THREE.PointsMaterial>(null);
  const coreMaterialRef = useRef<THREE.PointsMaterial>(null);
  const streakMaterialRef = useRef<THREE.LineBasicMaterial>(null);
  const coolGlowMaterialRef = useRef<THREE.SpriteMaterial>(null);

  const targetPositionRef = useRef(new THREE.Vector3());
  const pointSprite = useMemo(() => createPointSprite(), []);

  const haze = useMemo(
    () =>
      createDiskLayer({
        seed: 7101,
        count: 8400,
        innerRadius: 2.8,
        outerRadius: 18.8,
        thickness: 0.8,
        stretchX: 1.9,
        stretchZ: 0.76,
        swirl: 1.24,
        spread: 0.34,
        radiusBias: 0.8,
        warmBias: 2.5,
        warmColor: "#f1eee9",
        midColor: "#9ab2f5",
        coolColor: "#253e91",
      }),
    [],
  );

  const stars = useMemo(
    () =>
      createDiskLayer({
        seed: 7102,
        count: 4200,
        innerRadius: 3.15,
        outerRadius: 15.2,
        thickness: 0.38,
        stretchX: 1.84,
        stretchZ: 0.72,
        swirl: 1.46,
        spread: 0.18,
        radiusBias: 0.74,
        warmBias: 1.95,
        warmColor: "#fffaf1",
        midColor: "#d4defc",
        coolColor: "#6079c7",
      }),
    [],
  );

  const core = useMemo(
    () =>
      createDiskLayer({
        seed: 7103,
        count: 1700,
        innerRadius: 2.15,
        outerRadius: 5.4,
        thickness: 0.2,
        stretchX: 1.62,
        stretchZ: 0.62,
        swirl: 2.05,
        spread: 0.18,
        radiusBias: 0.86,
        warmBias: 0.82,
        warmColor: "#ffffff",
        midColor: "#f8ead6",
        coolColor: "#b6c7ec",
      }),
    [],
  );

  const streaks = useMemo(() => createStreakLayer(), []);

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const reveal = THREE.MathUtils.smoothstep(scrollProgress, 0.68, 0.97);
    const endBoost = THREE.MathUtils.smoothstep(scrollProgress, 0.86, 1.0);
    const visibility = strength * (0.018 + reveal * 0.72 + endBoost * 0.26);

    const time = state.clock.elapsedTime;
    const pointerX = state.pointer.x;
    const pointerY = state.pointer.y;

    const target = targetPositionRef.current;
    target.set(
      contactPosition.x + 3.2 - pointerX * 0.48,
      contactPosition.y - 0.45 - pointerY * 0.2,
      contactPosition.z - 26.0,
    );

    group.position.lerp(target, 1 - Math.exp(-delta * 1.6));
    group.rotation.x = THREE.MathUtils.damp(group.rotation.x, 1.38, 1.3, delta);
    group.rotation.y = THREE.MathUtils.damp(
      group.rotation.y,
      0.08 + pointerX * 0.03,
      1.2,
      delta,
    );
    group.rotation.z = THREE.MathUtils.damp(
      group.rotation.z,
      -0.48 + Math.sin(time * 0.055) * 0.012 - pointerX * 0.018,
      1.1,
      delta,
    );

    const targetScale = THREE.MathUtils.lerp(0.5, 0.67, reveal);
    const breathe = 1 + Math.sin(time * 0.11) * 0.006;
    group.scale.setScalar(targetScale * breathe);

    if (hazeRef.current) hazeRef.current.rotation.z += delta * 0.0032;
    if (starsRef.current) starsRef.current.rotation.z += delta * 0.0054;
    if (coreRef.current) coreRef.current.rotation.z += delta * 0.009;
    if (streaksRef.current) streaksRef.current.rotation.z += delta * 0.0024;

    if (hazeMaterialRef.current) hazeMaterialRef.current.opacity = 0.17 * visibility;
    if (starsMaterialRef.current) starsMaterialRef.current.opacity = 0.5 * visibility;
    if (coreMaterialRef.current) coreMaterialRef.current.opacity = 0.92 * visibility;
    if (streakMaterialRef.current) streakMaterialRef.current.opacity = 0.34 * visibility;
    if (coolGlowMaterialRef.current) coolGlowMaterialRef.current.opacity = 0.065 * visibility;
  });

  return (
    <group
      ref={groupRef}
      position={[contactPosition.x + 3.2, contactPosition.y - 0.45, contactPosition.z - 26]}
      rotation={[1.38, 0.08, -0.48]}
      scale={0.5}
    >
      <sprite position={[0, 0, -0.3]} scale={[18, 8.5, 1]} renderOrder={-24}>
        <spriteMaterial
          ref={coolGlowMaterialRef}
          map={pointSprite}
          color="#6b87ca"
          transparent
          opacity={0.001}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>

      <points ref={hazeRef} frustumCulled={false} renderOrder={-23}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[haze.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[haze.colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={hazeMaterialRef}
          map={pointSprite}
          size={0.25}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.001}
          depthWrite={false}
          alphaTest={0.001}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>

      <lineSegments ref={streaksRef} frustumCulled={false} renderOrder={-22}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[streaks.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[streaks.colors, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          ref={streakMaterialRef}
          vertexColors
          transparent
          opacity={0.001}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </lineSegments>

      <points ref={starsRef} frustumCulled={false} renderOrder={-21}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[stars.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[stars.colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={starsMaterialRef}
          map={pointSprite}
          size={0.25}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.001}
          depthWrite={false}
          alphaTest={0.001}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>

      <points ref={coreRef} frustumCulled={false} renderOrder={-20}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[core.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[core.colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={coreMaterialRef}
          map={pointSprite}
          size={0.31}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.001}
          depthWrite={false}
          alphaTest={0.001}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>

      {/* The actual event horizon: it intentionally draws after the light
          layers, cutting a clean dark hole through the accretion disk. */}
      <mesh renderOrder={-18}>
        <sphereGeometry args={[2.15, 40, 24]} />
        <meshBasicMaterial color="#000000" toneMapped={false} />
      </mesh>
    </group>
  );
}
