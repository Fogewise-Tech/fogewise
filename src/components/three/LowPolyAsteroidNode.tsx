"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Project } from "@/types/project";
import { useExperienceStore } from "@/store/useExperienceStore";
import { getProjectCheckpoint } from "@/lib/journey";

type Props = {
  project: Project;
  projectIndex: number;
  projectCount: number;
  active: boolean;
  mobileMode?: boolean;
};

type ShapeKind = "icosa" | "octa" | "dodeca";

const ROCK_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vHeight;

  void main() {
    vHeight = length(position);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const ROCK_FRAGMENT = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uRim;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vHeight;

  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vView);

    float t = clamp((vHeight - 0.82) * 2.4, 0.0, 1.0);
    vec3 base = mix(uColorB, uColorA, t);

    float diff = clamp(dot(n, normalize(vec3(0.5, 0.7, 0.9))), 0.0, 1.0);
    float rim = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 3.0);

    vec3 col = base * (0.22 + diff * 0.95) + uRim * rim * 0.5;
    gl_FragColor = vec4(col, 1.0);
  }
`;

function clamp(v: number, lo: number, hi: number, fallback: number) {
  const n = Number.isFinite(v) ? v : fallback;
  return Math.max(lo, Math.min(hi, n));
}

function hash3(x: number, y: number, z: number) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

function noise3(x: number, y: number, z: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (i: number, j: number, k: number) => hash3(xi + i, yi + j, zi + k);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), u);
  const x10 = lerp(c(0, 1, 0), c(1, 1, 0), u);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), u);
  const x11 = lerp(c(0, 1, 1), c(1, 1, 1), u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w) * 2 - 1;
}

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

function createBaseGeometry(kind: ShapeKind, detail: number) {
  switch (kind) {
    case "octa":
      return new THREE.OctahedronGeometry(1, Math.min(detail, 2));
    case "dodeca":
      return new THREE.DodecahedronGeometry(1, Math.min(detail, 1));
    case "icosa":
    default:
      return new THREE.IcosahedronGeometry(1, detail);
  }
}

function buildGeometry(
  kind: ShapeKind,
  detail: number,
  roughness: number,
  axisScale: THREE.Vector3,
) {
  const base = createBaseGeometry(kind, detail);
  const positions = base.getAttribute("position") as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const rough = clamp(roughness, 0, 100, 72) / 100;

  for (let i = 0; i < positions.count; i += 1) {
    v.fromBufferAttribute(positions, i);
    const n =
      noise3(v.x * 2.2, v.y * 2.2, v.z * 2.2) * 0.7 +
      noise3(v.x * 5.1, v.y * 5.1, v.z * 5.1) * 0.3;
    v.multiplyScalar(1 + n * rough * 0.42);
    v.set(v.x * axisScale.x, v.y * axisScale.y, v.z * axisScale.z);
    positions.setXYZ(i, v.x, v.y, v.z);
  }

  const geometry = base.toNonIndexed();
  base.dispose();
  geometry.computeVertexNormals();
  return geometry;
}

function smooth01(value: number) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

export function LowPolyAsteroidNode({
  project,
  projectIndex,
  projectCount,
  active,
  mobileMode = false,
}: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const config = useMemo(() => {
    const seed = hashString(project.id);
    const random = createSeededRandom(seed);
    const hue = random();
    const shapeKinds: ShapeKind[] = ["icosa", "octa", "dodeca"];
    const shapeKind = shapeKinds[Math.floor(random() * shapeKinds.length)] ?? "icosa";
    const colorA = new THREE.Color().setHSL(hue, 0.18, 0.66);
    const colorB = new THREE.Color().setHSL((hue + 0.03 + random() * 0.04) % 1, 0.18, 0.18);
    const rim = new THREE.Color().setHSL((hue + 0.02) % 1, 0.12, 0.96);
    const outgoingTheta = random() * Math.PI * 2;
    const outgoingRadius = mobileMode ? 7.0 + random() * 2.2 : 10.5 + random() * 3.6;

    return {
      shapeKind,
      detail: mobileMode ? 1 : 2,
      roughness: 58 + random() * 24,
      axisScale: new THREE.Vector3(
        0.88 + random() * 0.34,
        0.88 + random() * 0.34,
        0.88 + random() * 0.34,
      ),
      colorA,
      colorB,
      rim,
      rotation: new THREE.Vector3(
        (0.8 + random() * 1.2) * (random() > 0.5 ? 1 : -1),
        (1 + random() * 1.5) * (random() > 0.5 ? 1 : -1),
        (0.25 + random() * 0.55) * (random() > 0.5 ? 1 : -1),
      ),
      focusScale: mobileMode ? 1.08 + random() * 0.08 : 1.22 + random() * 0.16,
      focusPosition: new THREE.Vector3(0, 0, 0),
      incomingPosition: new THREE.Vector3(0, 0, (mobileMode ? -18 : -25) - random() * (mobileMode ? 4 : 8)),
      outgoingPosition: new THREE.Vector3(
        Math.cos(outgoingTheta) * outgoingRadius,
        Math.sin(outgoingTheta) * outgoingRadius * 0.84,
        mobileMode ? 2.2 + random() * 1.2 : 3.2 + random() * 1.8,
      ),
    };
  }, [mobileMode, project.id]);

  const geometry = useMemo(
    () => buildGeometry(config.shapeKind, config.detail, config.roughness, config.axisScale),
    [config.axisScale, config.detail, config.roughness, config.shapeKind],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_state, delta) => {
    const group = groupRef.current;
    const material = materialRef.current;
    if (!group || !material) return;

    const experience = useExperienceStore.getState();
    const selected = experience.selectedProjectId === project.id;
    const checkpoint = getProjectCheckpoint(projectIndex, projectCount);
    const sectionSpan = projectCount > 0 ? 1 / projectCount : 1;
    const relative = (experience.scrollProgress - checkpoint) / sectionSpan;

    let shouldShow = false;
    const targetPosition = new THREE.Vector3().copy(config.incomingPosition);
    let targetScale = config.focusScale * 0.18;

    if (selected) {
      shouldShow = true;
      targetPosition.copy(config.focusPosition);
      targetScale = config.focusScale * 1.06;
    } else if (relative >= -0.98 && relative <= 1.0) {
      shouldShow = true;
      if (relative <= 0) {
        const incoming = smooth01((relative + 0.98) / 0.98);
        targetPosition.lerpVectors(config.incomingPosition, config.focusPosition, incoming);
        targetScale = THREE.MathUtils.lerp(config.focusScale * 0.16, config.focusScale, incoming);
      } else {
        const outgoing = smooth01(relative / 1.0);
        targetPosition.lerpVectors(config.focusPosition, config.outgoingPosition, outgoing);
        targetScale = THREE.MathUtils.lerp(config.focusScale, config.focusScale * 0.72, outgoing);
      }
    }

    group.visible = shouldShow;
    if (!shouldShow) return;

    group.position.x = THREE.MathUtils.damp(group.position.x, targetPosition.x, 5.6, delta);
    group.position.y = THREE.MathUtils.damp(group.position.y, targetPosition.y, 5.6, delta);
    group.position.z = THREE.MathUtils.damp(group.position.z, targetPosition.z, 5.6, delta);

    const nextScale = THREE.MathUtils.damp(
      group.scale.x,
      targetScale,
      active ? 7 : 5.2,
      delta,
    );
    group.scale.setScalar(nextScale);

    const rotationScale = mobileMode ? 0.7 : 1;
    group.rotation.x += config.rotation.x * 0.05 * delta * rotationScale;
    group.rotation.y += config.rotation.y * 0.05 * delta * rotationScale;
    group.rotation.z += config.rotation.z * 0.05 * delta * rotationScale;

    material.uniforms.uColorA.value.copy(config.colorA);
    material.uniforms.uColorB.value.copy(config.colorB);
    material.uniforms.uRim.value.copy(config.rim);
  });

  const startsFocused = projectIndex === 0;

  return (
    <group
      ref={groupRef}
      position={startsFocused ? config.focusPosition.toArray() : config.incomingPosition.toArray()}
      scale={startsFocused ? config.focusScale : config.focusScale * 0.16}
      visible={startsFocused}
    >
      <mesh geometry={geometry}>
        <shaderMaterial
          ref={materialRef}
          vertexShader={ROCK_VERTEX}
          fragmentShader={ROCK_FRAGMENT}
          transparent={false}
          depthWrite
          depthTest
          uniforms={{
            uColorA: { value: config.colorA.clone() },
            uColorB: { value: config.colorB.clone() },
            uRim: { value: config.rim.clone() },
          }}
        />
      </mesh>
    </group>
  );
}
