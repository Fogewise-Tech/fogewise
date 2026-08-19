"use client";

import { Canvas } from "@react-three/fiber";
import type { Project } from "@/types/project";
import { GalaxyScene } from "@/components/organisms/GalaxyScene";

export function ExperienceCanvas({
  projects,
  mobileMode = false,
}: {
  projects: Project[];
  mobileMode?: boolean;
}) {
  return (
    <Canvas
      dpr={mobileMode ? 1 : [1, 1.65]}
      camera={{ position: [0, 0, 9.2], fov: 44, near: 0.1, far: 120 }}
      gl={{
        antialias: !mobileMode,
        alpha: true,
        powerPreference: "high-performance",
      }}
    >
      <fog attach="fog" args={["#010207", 23, 90]} />
      <ambientLight intensity={0.12} />
      <hemisphereLight args={["#9ebcff", "#05020d", 0.32]} />
      <GalaxyScene projects={projects} mobileMode={mobileMode} />
    </Canvas>
  );
}
