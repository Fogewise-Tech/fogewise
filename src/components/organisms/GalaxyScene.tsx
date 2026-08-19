"use client";

import type { Project } from "@/types/project";
import { useExperienceStore } from "@/store/useExperienceStore";
import { CameraRig } from "@/components/three/CameraRig";
import { LowPolyAsteroidNode } from "@/components/three/LowPolyAsteroidNode";
import { DestinationStar } from "@/components/three/DestinationStar";

type Props = { projects: Project[]; mobileMode?: boolean };

export function GalaxyScene({ projects, mobileMode = false }: Props) {
  const activeIndex = useExperienceStore((state) => state.activeIndex);
  const focusStrength = useExperienceStore((state) => state.focusStrength);

  return (
    <>
      <CameraRig />

      {projects.map((project, index) => (
        <LowPolyAsteroidNode
          key={project.id}
          project={project}
          projectIndex={index}
          projectCount={projects.length}
          active={index === activeIndex && focusStrength > 0.01}
          mobileMode={mobileMode}
        />
      ))}

      <DestinationStar
        projectCount={projects.length}
        mobileMode={mobileMode}
      />
    </>
  );
}
