import * as THREE from "three";

export function getProjectCheckpoint(index: number, projectCount: number) {
  if (projectCount <= 0) return 0;
  return index / projectCount;
}

export function getJourneyState(progress: number, projectCount: number) {
  const p = THREE.MathUtils.clamp(progress, 0, 1);

  if (projectCount <= 0) {
    return { activeIndex: 0, focusStrength: 0 };
  }

  let activeIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < projectCount; index += 1) {
    const distance = Math.abs(p - getProjectCheckpoint(index, projectCount));

    if (distance < nearestDistance) {
      nearestDistance = distance;
      activeIndex = index;
    }
  }

  const normalizedDistance = nearestDistance * projectCount;
  const focusStrength =
    1 - THREE.MathUtils.smoothstep(normalizedDistance, 0.08, 0.5);

  return {
    activeIndex,
    focusStrength: THREE.MathUtils.clamp(focusStrength, 0, 1),
  };
}
