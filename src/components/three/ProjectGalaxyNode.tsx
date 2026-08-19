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

type OrbitConfig = {
  radiusX: number;
  radiusZ: number;
  tiltX: number;
  tiltY: number;
  tiltZ: number;
  speed: number;
  phase: number;
  satelliteScale: number;
  satelliteColor: THREE.Color;
  lineOpacity: number;
};

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uEnergy;
  varying vec3 vNormalView;
  varying vec3 vViewPosition;
  varying float vWave;

  void main() {
    vec3 p = position;
    float wave =
      sin(position.y * 5.0 + uTime * 0.7) * 0.035 +
      sin(position.x * 6.0 - uTime * 0.45) * 0.024 +
      sin(position.z * 4.0 + uTime * 0.31) * 0.018;
    p += normal * wave * (0.35 + uEnergy * 0.9);

    vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewPosition = -viewPosition.xyz;
    vWave = wave;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uAccent;
  uniform float uEnergy;
  varying vec3 vNormalView;
  varying vec3 vViewPosition;
  varying float vWave;

  void main() {
    vec3 N = normalize(vNormalView);
    vec3 V = normalize(vViewPosition);
    float fresnel = pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 2.4);
    float inner = 0.08 + uEnergy * 0.12 + vWave * 0.7;
    vec3 color = vec3(0.015, 0.025, 0.06) + uAccent * inner + fresnel * mix(uAccent, vec3(1.0), 0.5) * 1.25;
    float alpha = 0.12 + fresnel * 0.58 + uEnergy * 0.08;
    gl_FragColor = vec4(color, alpha);
  }
`;

function hashString(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
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

function OrbitLine({
  radiusX,
  radiusZ,
  color,
  opacity,
  mobileMode = false,
}: {
  radiusX: number;
  radiusZ: number;
  color: THREE.ColorRepresentation;
  opacity: number;
  mobileMode?: boolean;
}) {
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const segments = mobileMode ? 48 : 120;
    for (let index = 0; index < segments; index += 1) {
      const theta = (index / segments) * Math.PI * 2;

      points.push(
        new THREE.Vector3(
          Math.cos(theta) * radiusX,
          0,
          Math.sin(theta) * radiusZ,
        ),
      );
    }

    return new THREE.BufferGeometry().setFromPoints(points);
  }, [radiusX, radiusZ, mobileMode]);

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  const orbitLine = useMemo(() => {
    const line = new THREE.LineLoop(geometry, material);
    line.renderOrder = 2;
    return line;
  }, [geometry, material]);

  useEffect(() => {
    material.color.set(color);
    material.opacity = opacity;
    material.needsUpdate = true;
  }, [color, opacity, material]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return <primitive object={orbitLine} />;
}

export function ProjectGalaxyNode({
  project,
  position,
  active,
  mobileMode = false,
}: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const orbitRefs = useRef<Array<THREE.Group | null>>([]);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const [hovered, setHovered] = useState(false);
  const focusStrength = useExperienceStore((state) => state.focusStrength);
  const openProject = useExperienceStore((state) => state.openProject);
  const accent = useMemo(
    () => new THREE.Color(project.accent ?? "#8fb8ff"),
    [project.accent],
  );
  const energy = active ? focusStrength : 0;

  const orbits = useMemo(() => {
    const rand = createSeededRandom(hashString(project.id));
    const ringCount = mobileMode ? 2 : 3 + Math.floor(rand() * 2);
    return Array.from({ length: ringCount }, (_, index) => {
      const radiusX = 1.55 + index * 0.62 + rand() * 0.28;
      const radiusZ = radiusX * (0.72 + rand() * 0.18);
      const tiltX = (rand() - 0.5) * 1.05;
      const tiltY = (rand() - 0.5) * 0.85;
      const tiltZ = (rand() - 0.5) * 0.35;
      const speed = (0.16 + rand() * 0.35) * (index % 2 === 0 ? 1 : -1);
      const phase = rand() * Math.PI * 2;
      const satelliteScale = 0.06 + rand() * 0.1;
      const satelliteColor = new THREE.Color().setHSL(
        0.54 + rand() * 0.08,
        0.58,
        0.7 + rand() * 0.16,
      );
      const lineOpacity = 0.14 + index * 0.04;
      return {
        radiusX,
        radiusZ,
        tiltX,
        tiltY,
        tiltZ,
        speed,
        phase,
        satelliteScale,
        satelliteColor,
        lineOpacity,
      } satisfies OrbitConfig;
    });
  }, [project.id, mobileMode]);

  useEffect(() => {
    if (!hovered) return;
    document.body.style.cursor = "pointer";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);

  useFrame((state, delta) => {
    if (!groupRef.current || !materialRef.current) return;
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    materialRef.current.uniforms.uEnergy.value = THREE.MathUtils.damp(
      materialRef.current.uniforms.uEnergy.value,
      energy + (hovered ? 0.18 : 0),
      5,
      delta,
    );

    const targetScale = active ? 0.9 + energy * 0.2 : 0.58;
    const scale = THREE.MathUtils.damp(
      groupRef.current.scale.x,
      targetScale,
      4.3,
      delta,
    );
    groupRef.current.scale.setScalar(scale);

    groupRef.current.rotation.y += delta * (active ? 0.08 : 0.025);
    groupRef.current.rotation.x = THREE.MathUtils.damp(
      groupRef.current.rotation.x,
      hovered ? -state.pointer.y * 0.1 : 0,
      4,
      delta,
    );

    orbitRefs.current.forEach((orbitGroup, index) => {
      if (!orbitGroup) return;
      const config = orbits[index];
      orbitGroup.rotation.y += delta * config.speed * (active ? 1.4 : 0.75);
    });
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onPointerEnter={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onClick={(event) => {
        event.stopPropagation();
        openProject(project.id);
      }}
    >
      {(!mobileMode || active) && (
        <pointLight
          color={accent}
          intensity={active ? 2.6 + energy * 4.2 : 0.35}
          distance={10}
        />
      )}

      {orbits.map((orbit, index) => (
        <group
          key={`${project.id}-orbit-${index}`}
          ref={(element) => {
            orbitRefs.current[index] = element;
          }}
          rotation={[orbit.tiltX, orbit.tiltY + orbit.phase, orbit.tiltZ]}
        >
          <OrbitLine
            radiusX={orbit.radiusX}
            radiusZ={orbit.radiusZ}
            color={active ? "#cfe2ff" : "#8aa7d6"}
            opacity={
              (active ? 0.24 : 0.12) + orbit.lineOpacity * (0.35 + energy * 0.9)
            }
            mobileMode={mobileMode}
          />

          <group position={[orbit.radiusX, 0, 0]}>
            <mesh scale={orbit.satelliteScale} renderOrder={4}>
              <sphereGeometry args={[1, mobileMode ? 10 : 18, mobileMode ? 10 : 18]} />
              {mobileMode ? (
                <meshBasicMaterial
                  color={orbit.satelliteColor}
                  toneMapped={false}
                />
              ) : (
                <meshStandardMaterial
                  color={orbit.satelliteColor}
                  emissive={orbit.satelliteColor}
                  emissiveIntensity={active ? 1.2 : 0.45}
                  toneMapped={false}
                />
              )}
            </mesh>
            {!mobileMode && (
              <pointLight
                color={orbit.satelliteColor}
                intensity={active ? 1.2 : 0.28}
                distance={2.2}
              />
            )}
          </group>
        </group>
      ))}

      <mesh renderOrder={3}>
        <icosahedronGeometry args={[0.78, mobileMode ? 3 : 7]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={{
            uTime: { value: 0 },
            uEnergy: { value: energy },
            uAccent: { value: accent },
          }}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <mesh scale={0.42} renderOrder={4}>
        <sphereGeometry args={[1, mobileMode ? 16 : 32, mobileMode ? 16 : 32]} />
        <meshBasicMaterial
          color={active ? "#eef6ff" : "#7180a8"}
          transparent
          opacity={active ? 0.62 : 0.18}
        />
      </mesh>
    </group>
  );
}
