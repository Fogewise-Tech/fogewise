"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type OrbitLayout = {
  radiusX: number;
  radiusZ: number;
  rotation: [number, number, number];
  phase: number;
};

type Props = {
  center: THREE.Vector3;
  layouts: OrbitLayout[];
  activeIndex: number;
};

function OrbitLine({
  layout,
  active,
}: {
  layout: OrbitLayout;
  active: boolean;
}) {
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const segments = 220;

    for (let index = 0; index <= segments; index += 1) {
      const theta = (index / segments) * Math.PI * 2;
      points.push(
        new THREE.Vector3(
          Math.cos(theta) * layout.radiusX,
          0,
          Math.sin(theta) * layout.radiusZ,
        ),
      );
    }

    return new THREE.BufferGeometry().setFromPoints(points);
  }, [layout.radiusX, layout.radiusZ]);

  const material = useMemo(() => {
    const nextMaterial = new THREE.LineBasicMaterial({
      color: active ? "#eef6ff" : "#86a3d4",
      transparent: true,
      opacity: active ? 0.46 : 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    nextMaterial.toneMapped = false;
    return nextMaterial;
  }, [active]);

  const orbitLine = useMemo(() => {
    const line = new THREE.LineLoop(geometry, material);
    line.renderOrder = 2;
    return line;
  }, [geometry, material]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <group rotation={layout.rotation}>
      <primitive object={orbitLine} />
    </group>
  );
}

export function ProjectOrbitSystem({ center, layouts, activeIndex }: Props) {
  const coreRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!coreRef.current) return;
    coreRef.current.rotation.y += delta * 0.045;
    coreRef.current.rotation.x += delta * 0.012;
  });

  return (
    <group position={center}>
      {layouts.map((layout, index) => (
        <OrbitLine
          key={`shared-project-orbit-${index}`}
          layout={layout}
          active={index === activeIndex}
        />
      ))}

      <group ref={coreRef}>
        <pointLight color="#b7ceff" intensity={2.3} distance={9} />

        <mesh renderOrder={3}>
          <icosahedronGeometry args={[0.72, 5]} />
          <meshPhysicalMaterial
            color="#0d1834"
            emissive="#5f82c7"
            emissiveIntensity={0.38}
            roughness={0.32}
            metalness={0.08}
            transparent
            opacity={0.58}
            transmission={0.12}
            depthWrite={false}
          />
        </mesh>

        <mesh scale={0.52} renderOrder={4}>
          <sphereGeometry args={[0.72, 32, 32]} />
          <meshBasicMaterial
            color="#dce9ff"
            transparent
            opacity={0.34}
            toneMapped={false}
          />
        </mesh>

        <mesh scale={1.16} renderOrder={2}>
          <sphereGeometry args={[0.72, 32, 32]} />
          <meshBasicMaterial
            color="#6f9bf0"
            transparent
            opacity={0.075}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

export type { OrbitLayout };
