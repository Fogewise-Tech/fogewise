import { usePointerEmitter } from "@/hooks/usePointerEmitter";
import { NebulaHaze } from "@/components/three/NebulaHaze";
import { NebulaFlowParticles } from "@/components/three/NebulaFlowParticles";
import { NebulaFilaments } from "@/components/three/NebulaFilaments";
import { NebulaSparkles } from "@/components/three/NebulaSparkles";

export function PointerNebulaTrail() {
  const emitter = usePointerEmitter({
    distance: 5,
    smoothing: 18,
    trailLifetime: 2.35,
    maxTrailPoints: 110,
  });
  return (
    <group>
      <NebulaHaze emitter={emitter} count={1500} />
      <NebulaFlowParticles emitter={emitter} count={7600} />
      <NebulaFilaments emitter={emitter} />
      <NebulaSparkles emitter={emitter} count={1500} />
    </group>
  );
}
