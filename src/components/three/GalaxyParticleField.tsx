"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getInfiniteJourneyState } from "@/lib/journey";
import { useExperienceStore } from "@/store/useExperienceStore";

const GATHER_PARTICLE_COUNT = 3200;
const AMBIENT_PARTICLE_COUNT = 520;
const PARTICLE_COUNT = GATHER_PARTICLE_COUNT + AMBIENT_PARTICLE_COUNT;

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

// Keep the infinite field/wrapping from v6, but use the exact gather/release
// motion language from the uploaded reference version: gentle free drift,
// direct smooth convergence, subtle breathing and slow orbit while focused.
const vertexShader = /* glsl */ `
  attribute vec3 aOrigin;
  attribute vec3 aCluster;
  attribute float aSeed;
  attribute float aGatherWeight;

  uniform float uTime;
  uniform float uGather;
  uniform float uCameraZ;
  uniform float uFieldDepth;
  uniform vec3 uTarget;

  varying float vGather;
  varying float vSeed;

  void main() {
    float seed = aSeed;
    float halfDepth = uFieldDepth * 0.5;

    // Infinite world: each molecule wraps independently around the camera,
    // so the field never ends and never jumps as one large group.
    float wrappedZ = uCameraZ
      + mod(aOrigin.z - uCameraZ + halfDepth, uFieldDepth)
      - halfDepth;

    // Same dispersed animation as src(1).zip.
    vec3 drift = vec3(
      sin(uTime * (0.11 + seed * 0.08) + seed * 18.0),
      cos(uTime * (0.09 + seed * 0.06) + seed * 27.0),
      sin(uTime * (0.07 + seed * 0.05) + seed * 41.0)
    );

    vec3 freePosition = vec3(aOrigin.xy, wrappedZ)
      + drift * (0.12 + seed * 0.32);

    // Same focused breathing animation as src(1).zip.
    vec3 radial = normalize(aCluster + vec3(0.0001));
    float pulse = sin(uTime * 0.72 + seed * 22.0) * (0.025 + seed * 0.065);
    vec3 clusterPosition = uTarget + aCluster + radial * pulse;

    // No stagger wave / curved detour: particles gather with the same smooth
    // direct interpolation as the reference version. Density stays from v6.
    float gather = clamp(uGather * aGatherWeight, 0.0, 1.0);
    vec3 particlePosition = mix(freePosition, clusterPosition, gather);

    if (gather > 0.001) {
      float angle = uTime * (0.08 + seed * 0.08) * gather;
      float c = cos(angle);
      float ss = sin(angle);
      vec2 xz = mat2(c, -ss, ss, c) * (particlePosition.xz - uTarget.xz);
      particlePosition.xz = uTarget.xz + xz;
    }

    vec4 mvPosition = modelViewMatrix * vec4(particlePosition, 1.0);
    float perspective = 180.0 / max(1.0, -mvPosition.z);
    gl_PointSize = clamp((1.0 + seed * 2.1 + gather * 2.0) * perspective, 1.0, 6.5);
    gl_Position = projectionMatrix * mvPosition;

    vGather = gather;
    vSeed = seed;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vGather;
  varying float vSeed;

  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    float alpha = 1.0 - smoothstep(0.08, 0.5, d);
    float core = 1.0 - smoothstep(0.0, 0.16, d);

    vec3 deep = vec3(0.28, 0.42, 0.82);
    vec3 ice = vec3(0.73, 0.86, 1.0);
    vec3 violet = vec3(0.67, 0.55, 1.0);

    // Match the reference particle look while focused.
    vec3 color = mix(deep, ice, 0.35 + vSeed * 0.5);
    color = mix(color, violet, vGather * (0.22 + vSeed * 0.2));
    color += core * vec3(0.45);

    float opacity = alpha * mix(0.42, 0.92, vGather);
    gl_FragColor = vec4(color, opacity);
  }
`;

type Props = {
  projectPositions: THREE.Vector3[];
  cycleOffset: THREE.Vector3;
};

export function GalaxyParticleField({
  projectPositions,
  cycleOffset,
}: Props) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const scrollProgress = useExperienceStore((state) => state.scrollProgress);
  const focusStrength = useExperienceStore((state) => state.focusStrength);

  const journey = getInfiniteJourneyState(scrollProgress, projectPositions.length);
  const target = useMemo(() => new THREE.Vector3(), []);
  const fallbackTarget = useMemo(() => new THREE.Vector3(0, 0, -4), []);

  const fieldDepth = useMemo(
    () => Math.max(104, Math.abs(cycleOffset.z) * 2.35),
    [cycleOffset.z],
  );

  const attributes = useMemo(() => {
    const random = seededRandom(20260815);
    const origins = new Float32Array(PARTICLE_COUNT * 3);
    const clusters = new Float32Array(PARTICLE_COUNT * 3);
    const seeds = new Float32Array(PARTICLE_COUNT);
    const gatherWeights = new Float32Array(PARTICLE_COUNT);

    for (let index = 0; index < PARTICLE_COUNT; index += 1) {
      const i3 = index * 3;
      const seed = random();

      // Infinite dispersed field from v6.
      const zT = (index + random()) / PARTICLE_COUNT;
      const angle = random() * Math.PI * 2;
      const radial = Math.sqrt(random());
      const radiusX = 14.8 * radial;
      const radiusY = 8.6 * radial;

      origins[i3] = Math.cos(angle) * radiusX + (random() - 0.5) * 1.4;
      origins[i3 + 1] = Math.sin(angle) * radiusY + (random() - 0.5) * 0.9;
      origins[i3 + 2] = fieldDepth * (0.5 - zT);

      // Keep the denser v6 cluster shape requested in the previous turn.
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      const clusterSeed = random();
      const shellRadius = 0.88 + random() * 0.52;
      const innerRadius = 0.12 + Math.pow(random(), 0.72) * 0.76;
      const baseRadius = clusterSeed < 0.34 ? innerRadius : shellRadius;
      const wave =
        Math.sin(theta * 3.0 + phi * 5.0) * 0.22 +
        Math.sin(theta * 7.0 - phi * 2.0) * 0.09 +
        Math.sin(phi * 9.0) * 0.06;
      const radius = baseRadius + wave;

      clusters[i3] = Math.sin(phi) * Math.cos(theta) * radius * 1.08;
      clusters[i3 + 1] = Math.cos(phi) * radius * 0.78;
      clusters[i3 + 2] = Math.sin(phi) * Math.sin(theta) * radius * 0.92;

      seeds[index] = seed;
      // Keep the existing gathered-node density unchanged. The extra particles
      // are ambient-only, so the open-space molecular field feels slightly
      // denser without making the focused node blow out brighter.
      gatherWeights[index] =
        index >= GATHER_PARTICLE_COUNT
          ? 0.0
          : seed < 0.035
            ? 0.58
            : seed < 0.09
              ? 0.86
              : 1.0;
    }

    return { origins, clusters, seeds, gatherWeights };
  }, [fieldDepth]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uGather: { value: 0 },
      uCameraZ: { value: 10.5 },
      uFieldDepth: { value: fieldDepth },
      uTarget: { value: new THREE.Vector3() },
    }),
    [fieldDepth],
  );

  useFrame((state, delta) => {
    const material = materialRef.current;
    if (!material) return;

    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uCameraZ.value = state.camera.position.z;

    // Exact response speed from the uploaded reference version.
    material.uniforms.uGather.value = THREE.MathUtils.damp(
      material.uniforms.uGather.value,
      focusStrength,
      4.3,
      delta,
    );

    target
      .copy(projectPositions[journey.activeIndex] ?? fallbackTarget)
      .addScaledVector(cycleOffset, journey.activeCycle);

    const uniformTarget = material.uniforms.uTarget.value as THREE.Vector3;

    // Infinite-specific safeguard: change node while particles are dispersed,
    // otherwise keep the reference's 3.8 target interpolation feel.
    if (focusStrength < 0.015) {
      uniformTarget.copy(target);
    } else {
      uniformTarget.lerp(target, 1 - Math.exp(-delta * 3.8));
    }
  });

  return (
    <points frustumCulled={false} renderOrder={1}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[attributes.origins, 3]} />
        <bufferAttribute attach="attributes-aOrigin" args={[attributes.origins, 3]} />
        <bufferAttribute attach="attributes-aCluster" args={[attributes.clusters, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[attributes.seeds, 1]} />
        <bufferAttribute
          attach="attributes-aGatherWeight"
          args={[attributes.gatherWeights, 1]}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
