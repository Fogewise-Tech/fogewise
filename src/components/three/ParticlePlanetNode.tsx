"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Project } from "@/types/project";
import { useExperienceStore } from "@/store/useExperienceStore";
import { ParticleSphere } from "@/components/three/ParticleSphere";
import { getProjectCheckpoint } from "@/lib/journey";

type Props = {
  project: Project;
  projectIndex: number;
  projectCount: number;
  position: THREE.Vector3;
  active: boolean;
  mobileMode?: boolean;
};

const EXIT_LIFT_DESKTOP = 5.4;
const EXIT_LIFT_MOBILE = 3.8;

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

export function ParticlePlanetNode({
  project,
  projectIndex,
  projectCount,
  position,
  active,
  mobileMode = false,
}: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const openProject = useExperienceStore((state) => state.openProject);

  const config = useMemo(() => {
    const seed = hashString(project.id);
    const random = createSeededRandom(seed);

    // Stable random palette per project. Reloading keeps the same planet color.
    const hue = random();
    const hue2 = (hue + 0.055 + random() * 0.11) % 1;
    const primary = new THREE.Color().setHSL(hue, 0.82, 0.61);
    const accent = new THREE.Color().setHSL(hue2, 0.9, 0.72);

    return {
      seed,
      color: `#${primary.getHexString()}`,
      accent: `#${accent.getHexString()}`,
      radius: 1.7 + random() * 0.32,
      count: mobileMode ? 900 : 3200,
      particleScale: 4.2 + random() * 1.6,
      speed: 1.6 + random() * 2.2,
      tilt: (random() - 0.5) * 0.12,
    };
  }, [mobileMode, project.id]);

  useEffect(() => {
    if (mobileMode || !hovered) return;
    document.body.style.cursor = "pointer";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered, mobileMode]);

  useFrame((_state, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const experience = useExperienceStore.getState();
    const focusStrength = experience.focusStrength;
    const selected = experience.selectedProjectId === project.id;

    /**
     * Center -> up behavior:
     * - at its checkpoint the node is exactly at the warp center (y = 0)
     * - once that checkpoint is passed, it rises upward while the camera flies
     *   toward the next node, which itself is still waiting on the center axis
     * - selecting a project freezes it at center for the detail interaction
     */
    const checkpoint = getProjectCheckpoint(projectIndex, projectCount);
    const sectionSpan = projectCount > 0 ? 1 / projectCount : 1;
    const departureRaw = THREE.MathUtils.clamp(
      (experience.scrollProgress - checkpoint) / (sectionSpan * 0.72),
      0,
      1,
    );
    const departure = selected
      ? 0
      : THREE.MathUtils.smoothstep(departureRaw, 0, 1);
    const exitLift = mobileMode ? EXIT_LIFT_MOBILE : EXIT_LIFT_DESKTOP;
    const targetY = position.y + departure * exitLift;

    group.position.x = THREE.MathUtils.damp(
      group.position.x,
      position.x,
      8,
      delta,
    );
    group.position.y = THREE.MathUtils.damp(
      group.position.y,
      targetY,
      5.4,
      delta,
    );
    group.position.z = THREE.MathUtils.damp(
      group.position.z,
      position.z,
      8,
      delta,
    );

    const energy = active ? focusStrength : 0;
    const hoverBoost = !mobileMode && hovered ? 0.05 : 0;
    const departureShrink = THREE.MathUtils.lerp(1, 0.76, departure);
    const targetScale =
      (active ? 1 + energy * 0.08 + hoverBoost : 0.9) * departureShrink;
    const nextScale = THREE.MathUtils.damp(
      group.scale.x,
      targetScale,
      4.8,
      delta,
    );
    group.scale.setScalar(nextScale);
    group.rotation.z = THREE.MathUtils.damp(
      group.rotation.z,
      config.tilt,
      3.2,
      delta,
    );
  });

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
      <ParticleSphere
        seed={config.seed}
        sphereColor={config.color}
        accentColor={config.accent}
        scale={config.radius}
        particlesCount={config.count}
        particleScale={config.particleScale}
        speed={config.speed}
        smoothing={7}
        rotationDirection={
          config.seed % 2 === 0 ? "clockwise" : "anticlockwise"
        }
        active={active}
        opacity={active ? 1 : 0.7}
        mobileMode={mobileMode}
        drag={false}
        cursorOn={false}
      />
    </group>
  );
}
