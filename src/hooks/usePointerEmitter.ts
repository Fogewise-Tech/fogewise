import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { MathUtils, Vector2, Vector3 } from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useExperienceStore } from "@/store/useExperienceStore";

export type PointerTrailSample = {
  position: Vector3;
  age: number;
  speed: number;
  tangent: Vector3;
};

export type PointerEmitterApi = {
  emitterRef: MutableRefObject<Vector3>;
  trailRef: MutableRefObject<PointerTrailSample[]>;
  speedRef: MutableRefObject<number>;
  idleRef: MutableRefObject<number>;
  movingRef: MutableRefObject<boolean>;
};

type Options = {
  distance?: number;
  smoothing?: number;
  trailLifetime?: number;
  maxTrailPoints?: number;
};

const tmpWorld = new Vector3();
const tmpDir = new Vector3();
const tangent = new Vector3();

function ndcToWorld(x: number, y: number, camera: any, distance: number) {
  tmpWorld.set(x, y, 0.1).unproject(camera);
  tmpDir.copy(tmpWorld).sub(camera.position).normalize();
  return camera.position.clone().add(tmpDir.multiplyScalar(distance));
}

export function usePointerEmitter({
  distance = 5,
  smoothing = 18,
  trailLifetime = 2.35,
  maxTrailPoints = 110,
}: Options = {}): PointerEmitterApi {
  const { camera, gl } = useThree();
  const emitterRef = useRef(new Vector3());
  const trailRef = useRef<PointerTrailSample[]>([]);
  const speedRef = useRef(0);
  const idleRef = useRef(99);
  const movingRef = useRef(false);

  const targetNdc = useMemo(() => new Vector2(), []);
  const smoothNdc = useMemo(() => new Vector2(), []);
  const lastWorld = useRef<Vector3 | null>(null);
  const lastSample = useRef<Vector3 | null>(null);
  const lastInputAt = useRef(0);
  const hasPointerInput = useRef(false);
  const resetOnNextFrame = useRef(false);
  const lastScrollProgress = useRef(useExperienceStore.getState().scrollProgress);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      targetNdc.set(
        MathUtils.clamp(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -1.15,
          1.15,
        ),
        MathUtils.clamp(
          -(((event.clientY - rect.top) / rect.height) * 2 - 1),
          -1.15,
          1.15,
        ),
      );

      if (!hasPointerInput.current) {
        hasPointerInput.current = true;
        smoothNdc.copy(targetNdc);
        resetOnNextFrame.current = true;
      }

      idleRef.current = 0;
      lastInputAt.current = performance.now();
    };
    window.addEventListener("pointermove", handleMove, { passive: true });
    return () => window.removeEventListener("pointermove", handleMove);
  }, [gl, targetNdc]);

  useFrame((_, dt) => {
    if (!hasPointerInput.current) {
      trailRef.current = [];
      movingRef.current = false;
      idleRef.current += dt;
      return;
    }

    const alpha = 1 - Math.exp(-dt * smoothing);
    smoothNdc.lerp(targetNdc, alpha);
    const world = ndcToWorld(smoothNdc.x, smoothNdc.y, camera, distance);

    if (resetOnNextFrame.current || !lastWorld.current || !lastSample.current) {
      emitterRef.current.copy(world);
      lastWorld.current = world.clone();
      lastSample.current = world.clone();
      trailRef.current = [];
      speedRef.current = 0;
      movingRef.current = false;
      resetOnNextFrame.current = false;
      lastScrollProgress.current = useExperienceStore.getState().scrollProgress;
      return;
    }

    const distanceMoved = world.distanceTo(lastWorld.current);
    const scrollProgress = useExperienceStore.getState().scrollProgress;
    const scrollDelta = Math.abs(scrollProgress - lastScrollProgress.current);
    const pointerDriven = performance.now() - lastInputAt.current < 90;

    // Scroll now acts as a second emitter input. The pointer itself stays at
    // the exact same screen position; camera motion makes its world-space
    // emitter travel, so the nebula trail feels as if the user is moving it.
    // Virtual journey progress is continuous across native-scroll recycling,
    // therefore this also stays continuous from the last node to the next cycle.
    const scrollDriven = scrollDelta > 0.000015 && distanceMoved > 0.0015;

    // Keep a hard safety guard for genuinely discontinuous camera jumps.
    if (distanceMoved > Math.max(6, distance * 1.2)) {
      emitterRef.current.copy(world);
      trailRef.current = [];
      lastWorld.current.copy(world);
      lastSample.current.copy(world);
      lastScrollProgress.current = scrollProgress;
      speedRef.current = 0;
      movingRef.current = false;
      return;
    }

    emitterRef.current.lerp(world, 1 - Math.exp(-dt * 28));

    const instSpeed = distanceMoved / Math.max(dt, 1 / 240);
    speedRef.current = MathUtils.damp(speedRef.current, instSpeed, 12, dt);
    movingRef.current = pointerDriven || scrollDriven;

    const movedSinceSample = world.distanceTo(lastSample.current);
    const sampleThreshold = pointerDriven ? 0.012 : 0.008;
    if (movingRef.current && movedSinceSample > sampleThreshold) {
      tangent.copy(world).sub(lastSample.current);
      if (tangent.lengthSq() < 1e-7) tangent.set(0.001, 0, 0);
      tangent.normalize();

      trailRef.current.unshift({
        position: world.clone(),
        age: 0,
        speed: speedRef.current,
        tangent: tangent.clone(),
      });
      lastSample.current.copy(world);
    } else if (!movingRef.current) {
      // When neither mouse nor scroll is moving, keep the sample origin synced
      // so a later interaction never draws a connector from stale geometry.
      lastSample.current.copy(world);
    }

    lastScrollProgress.current = scrollProgress;

    for (const sample of trailRef.current) sample.age += dt;
    trailRef.current = trailRef.current
      .filter((sample) => sample.age < trailLifetime)
      .slice(0, maxTrailPoints);

    lastWorld.current.copy(world);
    idleRef.current += dt;
  });

  return { emitterRef, trailRef, speedRef, idleRef, movingRef };
}
