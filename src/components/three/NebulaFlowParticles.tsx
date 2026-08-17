import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  MathUtils,
  ShaderMaterial,
  Vector3,
} from "three";
import type { PointerEmitterApi } from "@/hooks/usePointerEmitter";

type P = {
  p: Vector3;
  v: Vector3;
  age: number;
  life: number;
  size: number;
  alpha: number;
  seed: number;
};

type Props = { emitter: PointerEmitterApi; count?: number };

const up = new Vector3(0, 1, 0);
const tangent = new Vector3();
const side = new Vector3();
const view = new Vector3();
const flow = new Vector3();

const vert = /* glsl */ `
uniform float uDpr;
attribute float aSize;
attribute float aAlpha;
attribute float aSeed;
varying float vAlpha;
varying float vSeed;
void main() {
  vAlpha = aAlpha;
  vSeed = aSeed;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = max(1.0, aSize * uDpr);
}`;

const frag = /* glsl */ `
varying float vAlpha;
varying float vSeed;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
  vec2 q = gl_PointCoord - .5;
  float d = dot(q,q);
  float core = exp(-d * 17.0);
  float grain = .78 + .35 * hash(floor(gl_PointCoord*7.0) + vSeed*19.0);
  float a = vAlpha * core * grain;
  if(a < .003) discard;
  vec3 c = mix(vec3(.60,.76,1.0), vec3(.95,.98,1.0), core);
  gl_FragColor = vec4(c,a);
}`;

function curlLike(p: Vector3, t: number, seed: number) {
  return flow.set(
    Math.sin(p.y * 1.4 + t * 0.72 + seed * 8.0) +
      0.45 * Math.cos(p.x * 0.7 - t * 0.31),
    Math.cos(p.x * 1.25 - t * 0.58 + seed * 5.0) +
      0.35 * Math.sin(p.y * 0.8 + t * 0.42),
    0.18 * Math.sin((p.x + p.y) * 0.9 + t * 0.25 + seed * 3.0),
  );
}

export function NebulaFlowParticles({ emitter, count = 7600 }: Props) {
  const { camera, size, gl } = useThree();
  const geometryRef = useRef<BufferGeometry>(null);
  const materialRef = useRef<ShaderMaterial>(null);
  const cursor = useRef(0);
  const carry = useRef(0);

  const pool = useRef<P[]>(
    Array.from({ length: count }, () => ({
      p: new Vector3(9999, 9999, 9999),
      v: new Vector3(),
      age: 99,
      life: 1,
      size: 1,
      alpha: 0,
      seed: Math.random(),
    })),
  );
  const positions = useMemo(() => new Float32Array(count * 3), [count]);
  const sizes = useMemo(() => new Float32Array(count), [count]);
  const alphas = useMemo(() => new Float32Array(count), [count]);
  const seeds = useMemo(() => new Float32Array(count), [count]);

  useMemo(() => {
    positions.fill(9999);
  }, [positions]);

  useFrame((state, dt) => {
    const trail = emitter.trailRef.current;
    const moving = emitter.movingRef.current;
    const activity = MathUtils.clamp(emitter.speedRef.current * 0.85, 0, 1);
    const rate = moving ? MathUtils.lerp(1250, 2700, activity) : 120;
    carry.current += rate * Math.min(dt, 0.033);

    while (carry.current >= 1 && trail.length) {
      carry.current -= 1;
      const particle = pool.current[cursor.current];
      cursor.current = (cursor.current + 1) % count;

      const maxHistory = Math.min(58, trail.length);
      const historyIndex = Math.floor(
        Math.pow(Math.random(), 1.45) * maxHistory,
      );
      const s = trail[historyIndex];
      tangent.copy(s.tangent).normalize();
      view.copy(camera.position).sub(s.position).normalize();
      side.crossVectors(tangent, view).normalize();
      if (side.lengthSq() < 1e-7) side.crossVectors(tangent, up).normalize();

      const dist = camera.position.distanceTo(s.position);
      const worldPerPx =
        (2 *
          dist *
          Math.tan(MathUtils.degToRad((camera as any).fov ?? 45) / 2)) /
        size.height;
      const spreadPx = MathUtils.lerp(
        22,
        118,
        Math.pow(historyIndex / Math.max(1, maxHistory - 1), 0.65),
      );
      const spread = spreadPx * worldPerPx;
      const gaussianish =
        (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

      particle.p
        .copy(s.position)
        .addScaledVector(side, gaussianish * spread)
        .addScaledVector(up, (Math.random() - 0.5) * spread * 0.42);

      particle.v
        .copy(tangent)
        .multiplyScalar(0.1 + Math.min(s.speed, 0.9) * 0.12)
        .addScaledVector(side, (Math.random() - 0.5) * 0.34)
        .addScaledVector(up, (Math.random() - 0.5) * 0.16);

      particle.age = 0;
      particle.life = MathUtils.randFloat(1.55, 2.85);
      particle.size = MathUtils.randFloat(0.75, 2.35);
      particle.alpha = MathUtils.randFloat(0.12, 0.55);
      particle.seed = Math.random();
    }

    const time = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const p = pool.current[i];
      const o = i * 3;
      if (p.age < p.life) {
        const n = p.age / p.life;
        p.v.addScaledVector(curlLike(p.p, time, p.seed), dt * 0.19);
        p.v.multiplyScalar(Math.pow(0.986, dt * 60));
        p.p.addScaledVector(p.v, dt);
        p.age += dt;
        positions[o] = p.p.x;
        positions[o + 1] = p.p.y;
        positions[o + 2] = p.p.z;
        sizes[i] = p.size * MathUtils.lerp(0.85, 1.28, n);
        alphas[i] = p.alpha * Math.pow(1 - n, 1.35);
        seeds[i] = p.seed;
      } else {
        positions[o] = 9999;
        positions[o + 1] = 9999;
        positions[o + 2] = 9999;
        sizes[i] = 0;
        alphas[i] = 0;
      }
    }

    const g = geometryRef.current;
    if (g) {
      (g.getAttribute("position") as BufferAttribute).needsUpdate = true;
      (g.getAttribute("aSize") as BufferAttribute).needsUpdate = true;
      (g.getAttribute("aAlpha") as BufferAttribute).needsUpdate = true;
      (g.getAttribute("aSeed") as BufferAttribute).needsUpdate = true;
    }
    if (materialRef.current)
      materialRef.current.uniforms.uDpr.value = Math.min(gl.getPixelRatio(), 2);
  });

  return (
    <points frustumCulled={false} renderOrder={100}>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          usage={DynamicDrawUsage}
        />
        <bufferAttribute
          attach="attributes-aSize"
          args={[sizes, 1]}
          usage={DynamicDrawUsage}
        />
        <bufferAttribute
          attach="attributes-aAlpha"
          args={[alphas, 1]}
          usage={DynamicDrawUsage}
        />
        <bufferAttribute
          attach="attributes-aSeed"
          args={[seeds, 1]}
          usage={DynamicDrawUsage}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={{ uDpr: { value: 1 } }}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}
