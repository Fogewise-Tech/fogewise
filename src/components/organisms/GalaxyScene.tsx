"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { Project } from "@/types/project";
import { getInfiniteJourneyState } from "@/lib/journey";
import { useExperienceStore } from "@/store/useExperienceStore";
import { CameraRig } from "@/components/three/CameraRig";
import { GalaxyParticleField } from "@/components/three/GalaxyParticleField";
import { PointerNebulaTrail } from "@/components/three/PointerNebulaTrail";
import { ProjectGalaxyNode } from "@/components/three/ProjectGalaxyNode";

type Props = { projects: Project[] };

const NODE_DEPTH_SPACING = 17.5;

function createSeededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function generateProjectPositions(count: number) {
  const rand = createSeededRandom(0x9e3779b9 ^ count * 97);
  const positions: THREE.Vector3[] = [];

  for (let index = 0; index < count; index += 1) {
    const z = -(index + 1) * NODE_DEPTH_SPACING;
    let candidate = new THREE.Vector3(0, 0, z);
    let accepted = false;

    for (let attempt = 0; attempt < 120; attempt += 1) {
      const x = THREE.MathUtils.lerp(-6.6, 6.6, rand());
      const y = THREE.MathUtils.lerp(-2.1, 2.1, rand());
      candidate.set(x, y, z);

      const tooClose = positions.some((prev) => {
        const dx = candidate.x - prev.x;
        const dy = candidate.y - prev.y;
        const dz = candidate.z - prev.z;
        const xyDistance = Math.hypot(dx, dy);
        const fullDistance = Math.hypot(dx, dy, dz);
        return (Math.abs(dz) < 26 && xyDistance < 3.8) || fullDistance < 8.5;
      });

      if (!tooClose) {
        accepted = true;
        break;
      }
    }

    if (!accepted) {
      const angle = index * 1.37 + rand() * Math.PI * 2;
      const radius = 4.2 + (index % 3) * 0.9;
      candidate.set(Math.cos(angle) * radius, Math.sin(angle * 1.3) * 1.6, z);
    }

    positions.push(candidate.clone());
  }

  return positions;
}

export function GalaxyScene({ projects }: Props) {
  const scrollProgress = useExperienceStore((state) => state.scrollProgress);
  const activeIndex = useExperienceStore((state) => state.activeIndex);

  const projectPositions = useMemo(
    () => generateProjectPositions(projects.length),
    [projects.length],
  );

  // Translate one project set by exactly its own depth. Therefore the first
  // node of the next set sits one normal node-spacing after the current last
  // node instead of after a large empty zoom-out gap.
  const cycleOffset = useMemo(
    () => new THREE.Vector3(0, 0, -projects.length * NODE_DEPTH_SPACING),
    [projects.length],
  );

  const journey = getInfiniteJourneyState(scrollProgress, projects.length);
  const spatialCycle = Math.max(0, Math.floor(scrollProgress));
  const visibleCycles = Array.from(
    new Set([
      Math.max(0, spatialCycle - 1),
      spatialCycle,
      spatialCycle + 1,
      journey.activeCycle,
    ]),
  );

  return (
    <>
      <CameraRig
        projectPositions={projectPositions}
        projectIds={projects.map((project) => project.id)}
        cycleOffset={cycleOffset}
      />

      <GalaxyParticleField
        projectPositions={projectPositions}
        cycleOffset={cycleOffset}
      />

      {visibleCycles.map((cycle) => {
        const offset = cycleOffset.clone().multiplyScalar(cycle);

        return (
          <group key={`journey-cycle-${cycle}`} position={offset}>
            {projects.map((project, index) => (
              <ProjectGalaxyNode
                key={project.id}
                project={project}
                position={projectPositions[index]}
                active={cycle === journey.activeCycle && index === activeIndex}
              />
            ))}
          </group>
        );
      })}

      <PointerNebulaTrail />
    </>
  );
}
