"use client";

import { Canvas } from "@react-three/fiber";
import type { Project } from "@/types/project";
import { GalaxyScene } from "@/components/organisms/GalaxyScene";

export function ExperienceCanvas({ projects }: { projects: Project[] }) {
  return (
    <Canvas
      dpr={[1, 1.65]}
      camera={{ position: [0, 0.4, 10.5], fov: 44, near: 0.1, far: 180 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#010207"]} />
      <fog attach="fog" args={["#010207", 23, 90]} />
      <ambientLight intensity={0.12} />
      <hemisphereLight args={["#9ebcff", "#05020d", 0.32]} />
      <GalaxyScene projects={projects} />
    </Canvas>
  );
}
