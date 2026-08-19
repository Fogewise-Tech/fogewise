"use client";

import { useLayoutEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useExperienceStore } from "@/store/useExperienceStore";

const CAMERA_Z = 9.2;
const BASE_FOV = 44;

export function CameraRig() {
  const { camera } = useThree();

  useLayoutEffect(() => {
    camera.position.set(0, 0, CAMERA_Z);
    camera.rotation.set(0, 0, 0);
    camera.lookAt(0, 0, 0);

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = BASE_FOV;
      camera.updateProjectionMatrix();
    }
  }, [camera]);

  useFrame((_state, delta) => {
    const experience = useExperienceStore.getState();
    const selected = experience.selectedProjectId !== null;

    const targetCameraZ = selected ? 8.75 : CAMERA_Z;
    camera.position.x = 0;
    camera.position.y = 0;
    camera.position.z = THREE.MathUtils.damp(
      camera.position.z,
      targetCameraZ,
      5.4,
      delta,
    );

    camera.lookAt(0, 0, 0);
    camera.rotation.z = 0;

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = THREE.MathUtils.damp(camera.fov, BASE_FOV, 6.0, delta);
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
