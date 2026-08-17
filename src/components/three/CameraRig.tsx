"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getInfiniteJourneyState, getProjectCheckpoint } from "@/lib/journey";
import { useExperienceStore } from "@/store/useExperienceStore";

type Props = {
  projectPositions: THREE.Vector3[];
  projectIds: string[];
  cycleOffset: THREE.Vector3;
};

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function getRepeatedPoint(
  basePoints: THREE.Vector3[],
  globalIndex: number,
  cycleOffset: THREE.Vector3,
  out: THREE.Vector3,
) {
  const count = basePoints.length;
  if (count === 0) return out.set(0, 0, 0);

  const cycle = Math.floor(globalIndex / count);
  const index = positiveModulo(globalIndex, count);
  return out.copy(basePoints[index]).addScaledVector(cycleOffset, cycle);
}

function catmullRom(
  out: THREE.Vector3,
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  p3: THREE.Vector3,
  t: number,
) {
  const t2 = t * t;
  const t3 = t2 * t;

  out.set(
    0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    0.5 *
      (2 * p1.z +
        (-p0.z + p2.z) * t +
        (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
        (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
  );

  return out;
}

export function CameraRig({
  projectPositions,
  projectIds,
  cycleOffset,
}: Props) {
  const { camera } = useThree();
  const scrollProgress = useExperienceStore((state) => state.scrollProgress);
  const selectedProjectId = useExperienceStore((state) => state.selectedProjectId);

  const cameraStart = useMemo(() => new THREE.Vector3(0, 0.4, 10.5), []);
  const targetStart = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  const nodeCameraPositions = useMemo(
    () =>
      projectPositions.map((position, index) => {
        const side = index % 2 === 0 ? -1.0 : 1.0;
        return new THREE.Vector3(
          position.x * 0.26 + side,
          position.y + 0.72,
          position.z + 7.8,
        );
      }),
    [projectPositions],
  );

  const desiredPosition = useMemo(() => new THREE.Vector3(), []);
  const desiredTarget = useMemo(() => new THREE.Vector3(), []);
  const selectedTarget = useMemo(() => new THREE.Vector3(), []);
  const selectedCameraPosition = useMemo(() => new THREE.Vector3(), []);
  const currentTarget = useMemo(() => new THREE.Vector3(), []);

  const cameraTemps = useMemo(
    () => Array.from({ length: 5 }, () => new THREE.Vector3()),
    [],
  );
  const targetTemps = useMemo(
    () => Array.from({ length: 5 }, () => new THREE.Vector3()),
    [],
  );

  const pointer = useRef(new THREE.Vector2());

  const sampleRepeatedPath = (
    progress: number,
    basePoints: THREE.Vector3[],
    introStart: THREE.Vector3,
    out: THREE.Vector3,
    temps: THREE.Vector3[],
  ) => {
    const count = basePoints.length;
    if (count === 0) return out.copy(introStart);

    const firstCheckpoint = getProjectCheckpoint(0, count);
    const nodeStep = 1 / count;
    const [p0, p1, p2, p3, reflected] = temps;

    // Keep the original opening shot. After the first node the path becomes a
    // true endless Catmull-Rom chain made only from consecutive project nodes.
    if (progress <= firstCheckpoint) {
      const t = THREE.MathUtils.clamp(progress / firstCheckpoint, 0, 1);
      p1.copy(introStart);
      getRepeatedPoint(basePoints, 0, cycleOffset, p2);
      getRepeatedPoint(basePoints, 1, cycleOffset, p3);
      reflected.copy(introStart).multiplyScalar(2).sub(p2);
      return catmullRom(out, reflected, p1, p2, p3, t);
    }

    const q = (progress - firstCheckpoint) / nodeStep;
    const segment = Math.max(0, Math.floor(q));
    const t = THREE.MathUtils.clamp(q - segment, 0, 1);

    if (segment === 0) {
      p0.copy(introStart);
    } else {
      getRepeatedPoint(basePoints, segment - 1, cycleOffset, p0);
    }
    getRepeatedPoint(basePoints, segment, cycleOffset, p1);
    getRepeatedPoint(basePoints, segment + 1, cycleOffset, p2);
    getRepeatedPoint(basePoints, segment + 2, cycleOffset, p3);

    return catmullRom(out, p0, p1, p2, p3, t);
  };

  useFrame((state, delta) => {
    pointer.current.x = THREE.MathUtils.damp(
      pointer.current.x,
      state.pointer.x,
      4.2,
      delta,
    );
    pointer.current.y = THREE.MathUtils.damp(
      pointer.current.y,
      state.pointer.y,
      4.2,
      delta,
    );

    sampleRepeatedPath(
      scrollProgress,
      nodeCameraPositions,
      cameraStart,
      desiredPosition,
      cameraTemps,
    );
    sampleRepeatedPath(
      scrollProgress,
      projectPositions,
      targetStart,
      desiredTarget,
      targetTemps,
    );

    const selectedIndex = selectedProjectId
      ? projectIds.indexOf(selectedProjectId)
      : -1;

    if (selectedIndex >= 0 && projectPositions[selectedIndex]) {
      const journey = getInfiniteJourneyState(scrollProgress, projectPositions.length);
      selectedTarget
        .copy(projectPositions[selectedIndex])
        .addScaledVector(cycleOffset, journey.activeCycle);
      selectedCameraPosition
        .copy(selectedTarget)
        .add(new THREE.Vector3(0, 0.25, 4.4));

      desiredPosition.lerp(selectedCameraPosition, 0.55);
      desiredTarget.lerp(selectedTarget, 0.75);
    }

    desiredPosition.x += pointer.current.x * 0.72;
    desiredPosition.y += pointer.current.y * 0.42;
    desiredTarget.x += pointer.current.x * 0.16;
    desiredTarget.y += pointer.current.y * 0.1;

    camera.position.lerp(desiredPosition, 1 - Math.exp(-delta * 3.8));
    currentTarget.lerp(desiredTarget, 1 - Math.exp(-delta * 4.6));
    camera.lookAt(currentTarget);
    camera.rotation.z = THREE.MathUtils.damp(
      camera.rotation.z,
      -pointer.current.x * 0.012,
      4.5,
      delta,
    );
  });

  return null;
}
