import * as THREE from "three";

export function wrapJourneyProgress(progress: number) {
  return ((progress % 1) + 1) % 1;
}

export function getProjectCheckpoint(index: number, projectCount: number) {
  if (projectCount <= 0) return 0;
  return (index + 1) / (projectCount + 1);
}

export type InfiniteJourneyState = {
  activeIndex: number;
  activeCycle: number;
  focusStrength: number;
  checkpoint: number;
};

/**
 * Infinite checkpoint lattice.
 *
 * The first node keeps the same entry checkpoint as the original source,
 * then every following node (including last -> first of the next cycle) is
 * spaced by exactly 1 / projectCount. This removes the double-width gap that
 * used to exist at the loop seam.
 */
export function getInfiniteJourneyState(
  progress: number,
  projectCount: number,
): InfiniteJourneyState {
  const p = Math.max(0, progress);

  if (projectCount <= 0) {
    return {
      activeIndex: 0,
      activeCycle: 0,
      focusStrength: 0,
      checkpoint: 0,
    };
  }

  const firstCheckpoint = getProjectCheckpoint(0, projectCount);
  const nodeStep = 1 / projectCount;
  const rawGlobalIndex = Math.round((p - firstCheckpoint) / nodeStep);
  const globalIndex = Math.max(0, rawGlobalIndex);

  const activeCycle = Math.floor(globalIndex / projectCount);
  const activeIndex = globalIndex % projectCount;
  const checkpoint = firstCheckpoint + globalIndex * nodeStep;
  const normalizedDistance = Math.abs(p - checkpoint) / nodeStep;

  // Same focus envelope as the uploaded reference animation. The infinite
  // checkpoint lattice is unchanged; only the approach/release timing matches.
  const focusStrength =
    1 - THREE.MathUtils.smoothstep(normalizedDistance, 0.08, 0.5);

  return {
    activeIndex,
    activeCycle,
    focusStrength: THREE.MathUtils.clamp(focusStrength, 0, 1),
    checkpoint,
  };
}

// Kept for callers that still need the original finite 0 -> 1 behaviour.
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

  const normalizedDistance = nearestDistance * (projectCount + 1);
  const focusStrength =
    1 - THREE.MathUtils.smoothstep(normalizedDistance, 0.08, 0.5);

  return {
    activeIndex,
    focusStrength: THREE.MathUtils.clamp(focusStrength, 0, 1),
  };
}
