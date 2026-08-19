"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Project } from "@/types/project";
import { useExperienceStore } from "@/store/useExperienceStore";

type Props = {
  project: Project;
  position: THREE.Vector3;
  active: boolean;
  mobileMode?: boolean;
};

type MoonConfig = {
  radius: number;
  size: number;
  speed: number;
  phase: number;
  tilt: number;
};

const planetVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uActive;
  varying vec3 vNormalView;
  varying vec3 vPosition;
  varying vec3 vViewPosition;

  void main() {
    vec3 p = position;
    float breathing = sin(uTime * 0.28 + position.y * 2.2) * 0.003 * uActive;
    p += normal * breathing;

    vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vPosition = position;
    vViewPosition = -viewPosition.xyz;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const planetFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uActive;
  uniform vec3 uAccent;
  uniform vec3 uSecondary;
  uniform vec3 uDark;

  varying vec3 vNormalView;
  varying vec3 vPosition;
  varying vec3 vViewPosition;

  void main() {
    vec3 N = normalize(vNormalView);
    vec3 V = normalize(vViewPosition);
    vec3 L = normalize(vec3(-0.55, 0.72, 0.82));

    float diffuse = max(dot(N, L), 0.0);
    float hemi = N.y * 0.5 + 0.5;

    float latitude = vPosition.y * (5.2 + uSeed * 1.4);
    float longitude = atan(vPosition.z, vPosition.x);
    float bands = 0.5 + 0.5 * sin(
      latitude +
      sin(longitude * 3.0 + uSeed * 5.0) * 0.85 +
      sin(vPosition.x * 5.0 - vPosition.z * 3.6) * 0.38
    );
    bands = smoothstep(0.18, 0.9, bands);

    float continents = sin(vPosition.x * 7.2 + uSeed * 11.0)
      * sin(vPosition.y * 5.4 - uSeed * 4.0)
      * sin(vPosition.z * 6.6 + uSeed * 7.0);
    continents = smoothstep(-0.22, 0.48, continents);

    float storm = 0.5 + 0.5 * sin(
      longitude * 8.0 +
      vPosition.y * 8.5 +
      sin(vPosition.z * 7.0) * 1.1 +
      uTime * 0.035
    );

    vec3 surface = mix(uDark, uAccent, 0.22 + diffuse * 0.58 + hemi * 0.12);
    surface = mix(surface, uSecondary, bands * 0.30 + continents * 0.14);
    surface += uSecondary * storm * 0.045;

    float night = pow(1.0 - diffuse, 2.2);
    float cityMask = step(0.83, fract(sin(dot(vPosition.xz, vec2(18.9898, 43.233))) * 43758.5453));
    surface += uAccent * cityMask * night * 0.08 * uActive;

    float fresnel = pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 3.0);
    surface += mix(uAccent, vec3(0.84, 0.93, 1.0), 0.55) * fresnel * (0.22 + uActive * 0.32);

    gl_FragColor = vec4(surface, 1.0);
  }
`;

const atmosphereVertexShader = /* glsl */ `
  varying vec3 vNormalView;
  varying vec3 vViewPosition;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewPosition = -viewPosition.xyz;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const atmosphereFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec3 vNormalView;
  varying vec3 vViewPosition;

  void main() {
    vec3 N = normalize(vNormalView);
    vec3 V = normalize(vViewPosition);
    float rim = pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 2.15);
    float alpha = rim * (0.22 + uStrength * 0.34);
    gl_FragColor = vec4(uColor * (0.75 + rim * 0.75), alpha);
  }
`;

function hashString(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function PlanetProjectNode({
  project,
  position,
  active,
  mobileMode = false,
}: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const planetRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Group>(null);
  const moonOrbitRefs = useRef<Array<THREE.Group | null>>([]);
  const planetMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const atmosphereMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const [hovered, setHovered] = useState(false);

  const focusStrength = useExperienceStore((state) => state.focusStrength);
  const openProject = useExperienceStore((state) => state.openProject);

  const config = useMemo(() => {
    const seed = hashString(project.id);
    const random = createSeededRandom(seed);
    const accent = new THREE.Color(project.accent ?? "#8fb8ff");
    const secondary = accent.clone();
    secondary.offsetHSL(0.08 + random() * 0.12, -0.08, 0.16);
    const dark = accent.clone().multiplyScalar(0.075);
    dark.offsetHSL(-0.02, 0.08, -0.015);

    const radius = 1.55 + random() * 0.55;
    const hasRing = random() > 0.37;
    const ringTiltX = 1.04 + (random() - 0.5) * 0.3;
    const ringTiltZ = (random() - 0.5) * 0.32;
    const ringInner = radius * (1.34 + random() * 0.1);
    const ringOuter = radius * (1.92 + random() * 0.22);
    const seedFloat = (seed % 997) / 997;

    const moonCount = mobileMode ? 1 : 1 + Math.floor(random() * 2);
    const moons: MoonConfig[] = Array.from({ length: moonCount }, (_, index) => ({
      radius: radius * (2.25 + index * 0.5 + random() * 0.25),
      size: radius * (0.105 + random() * 0.07),
      speed: (0.12 + random() * 0.16) * (index % 2 === 0 ? 1 : -1),
      phase: random() * Math.PI * 2,
      tilt: (random() - 0.5) * 0.55,
    }));

    return {
      accent,
      secondary,
      dark,
      radius,
      hasRing,
      ringTiltX,
      ringTiltZ,
      ringInner,
      ringOuter,
      seedFloat,
      moons,
    };
  }, [mobileMode, project.accent, project.id]);

  useEffect(() => {
    if (mobileMode || !hovered) return;
    document.body.style.cursor = "pointer";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered, mobileMode]);

  useFrame((state, delta) => {
    const group = groupRef.current;
    const planet = planetRef.current;
    const planetMaterial = planetMaterialRef.current;
    const atmosphereMaterial = atmosphereMaterialRef.current;
    if (!group || !planet || !planetMaterial || !atmosphereMaterial) return;

    const energy = active ? focusStrength : 0;
    const hoverEnergy = !mobileMode && hovered ? 0.12 : 0;
    const targetScale = active ? 1 + energy * 0.07 + hoverEnergy : 0.78;
    const scale = THREE.MathUtils.damp(group.scale.x, targetScale, 4.1, delta);
    group.scale.setScalar(scale);

    planet.rotation.y += delta * (active ? 0.055 : 0.016);
    planet.rotation.z = THREE.MathUtils.damp(
      planet.rotation.z,
      active ? Math.sin(state.clock.elapsedTime * 0.16 + config.seedFloat * 6) * 0.028 : 0,
      2.5,
      delta,
    );

    if (ringRef.current) {
      ringRef.current.rotation.z += delta * (active ? 0.018 : 0.006);
    }

    moonOrbitRefs.current.forEach((orbit, index) => {
      if (!orbit) return;
      const moon = config.moons[index];
      orbit.rotation.y += delta * moon.speed * (active ? 1.0 : 0.34);
    });

    planetMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    planetMaterial.uniforms.uActive.value = THREE.MathUtils.damp(
      planetMaterial.uniforms.uActive.value,
      energy + hoverEnergy,
      4.8,
      delta,
    );
    atmosphereMaterial.uniforms.uStrength.value = THREE.MathUtils.damp(
      atmosphereMaterial.uniforms.uStrength.value,
      active ? 0.68 + energy * 0.72 : 0.18,
      4.4,
      delta,
    );
  });

  const surfaceSegments = mobileMode ? 24 : 48;
  const surfaceHeightSegments = mobileMode ? 16 : 32;
  const showMoons = !mobileMode || active;

  return (
    <group
      ref={groupRef}
      position={position}
      onPointerEnter={(event) => {
        if (mobileMode) return;
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onClick={(event) => {
        event.stopPropagation();
        openProject(project.id);
      }}
    >
      <mesh ref={planetRef} renderOrder={3}>
        <sphereGeometry
          args={[config.radius, surfaceSegments, surfaceHeightSegments]}
        />
        <shaderMaterial
          ref={planetMaterialRef}
          vertexShader={planetVertexShader}
          fragmentShader={planetFragmentShader}
          uniforms={{
            uTime: { value: 0 },
            uSeed: { value: config.seedFloat },
            uActive: { value: active ? focusStrength : 0 },
            uAccent: { value: config.accent },
            uSecondary: { value: config.secondary },
            uDark: { value: config.dark },
          }}
          toneMapped={false}
        />
      </mesh>

      <mesh scale={config.radius * 1.075} renderOrder={4}>
        <sphereGeometry args={[1, mobileMode ? 20 : 40, mobileMode ? 14 : 28]} />
        <shaderMaterial
          ref={atmosphereMaterialRef}
          vertexShader={atmosphereVertexShader}
          fragmentShader={atmosphereFragmentShader}
          uniforms={{
            uColor: { value: config.accent },
            uStrength: { value: active ? 1 : 0.2 },
          }}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <sprite scale={config.radius * 3.2} renderOrder={1}>
        <spriteMaterial
          color={config.accent}
          transparent
          opacity={active ? 0.055 + focusStrength * 0.065 : 0.018}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>

      {config.hasRing && (
        <group
          ref={ringRef}
          rotation={[config.ringTiltX, 0, config.ringTiltZ]}
          renderOrder={2}
        >
          <mesh>
            <ringGeometry
              args={[
                config.ringInner,
                config.ringOuter,
                mobileMode ? 48 : 96,
                1,
              ]}
            />
            <meshBasicMaterial
              color={config.secondary}
              transparent
              opacity={active ? 0.23 + focusStrength * 0.16 : 0.075}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
          <mesh scale={1.045}>
            <ringGeometry
              args={[
                config.ringInner * 1.08,
                config.ringInner * 1.12,
                mobileMode ? 48 : 96,
                1,
              ]}
            />
            <meshBasicMaterial
              color="#eef6ff"
              transparent
              opacity={active ? 0.17 : 0.04}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        </group>
      )}

      {showMoons &&
        config.moons.map((moon, index) => (
          <group
            key={`${project.id}-moon-${index}`}
            ref={(element) => {
              moonOrbitRefs.current[index] = element;
            }}
            rotation={[moon.tilt, moon.phase, 0]}
          >
            <mesh position={[moon.radius, 0, 0]} scale={moon.size} renderOrder={3}>
              <sphereGeometry args={[1, mobileMode ? 10 : 16, mobileMode ? 8 : 12]} />
              <meshBasicMaterial
                color={index % 2 === 0 ? config.secondary : "#d9e6ff"}
                toneMapped={false}
              />
            </mesh>
          </group>
        ))}
    </group>
  );
}
