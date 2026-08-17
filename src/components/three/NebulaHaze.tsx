import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  MathUtils,
  NormalBlending,
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
const tangent = new Vector3(),
  side = new Vector3(),
  view = new Vector3(),
  up = new Vector3(0, 1, 0),
  flow = new Vector3();

const vert = /*glsl*/ `
uniform float uDpr; attribute float aSize; attribute float aAlpha; attribute float aSeed;
varying float vAlpha; varying float vSeed;
void main(){vAlpha=aAlpha;vSeed=aSeed;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=aSize*uDpr;}`;
const frag = /*glsl*/ `
varying float vAlpha; varying float vSeed;
float h(vec2 p){return fract(sin(dot(p,vec2(91.7,47.3)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
void main(){vec2 q=gl_PointCoord-.5;float d=length(q);float soft=smoothstep(.52,.04,d);float cloud=.58+.55*n(gl_PointCoord*5.0+vSeed*13.0);float a=vAlpha*soft*soft*cloud;if(a<.0015)discard;gl_FragColor=vec4(.63,.77,1.0,a);}`;

function drift(p: Vector3, t: number, s: number) {
  return flow.set(
    Math.sin(p.y * 0.75 + t * 0.28 + s * 5) * 0.19,
    Math.cos(p.x * 0.68 - t * 0.22 + s * 3) * 0.16,
    0,
  );
}

export function NebulaHaze({ emitter, count = 1500 }: Props) {
  const { camera, size, gl } = useThree();
  const geo = useRef<BufferGeometry>(null),
    mat = useRef<ShaderMaterial>(null);
  const cursor = useRef(0),
    carry = useRef(0);
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
  const pos = useMemo(() => new Float32Array(count * 3), [count]),
    sz = useMemo(() => new Float32Array(count), [count]),
    al = useMemo(() => new Float32Array(count), [count]),
    seed = useMemo(() => new Float32Array(count), [count]);
  useMemo(() => pos.fill(9999), [pos]);
  useFrame((state, dt) => {
    const trail = emitter.trailRef.current;
    const activity = MathUtils.clamp(emitter.speedRef.current * 0.8, 0, 1);
    const rate = emitter.movingRef.current
      ? MathUtils.lerp(250, 520, activity)
      : 18;
    carry.current += rate * Math.min(dt, 0.033);
    while (carry.current >= 1 && trail.length) {
      carry.current -= 1;
      const p = pool.current[cursor.current];
      cursor.current = (cursor.current + 1) % count;
      const mh = Math.min(70, trail.length);
      const hi = Math.floor(Math.pow(Math.random(), 1.2) * mh);
      const s = trail[hi];
      tangent.copy(s.tangent).normalize();
      view.copy(camera.position).sub(s.position).normalize();
      side.crossVectors(tangent, view).normalize();
      if (side.lengthSq() < 1e-7) side.crossVectors(tangent, up).normalize();
      const dist = camera.position.distanceTo(s.position);
      const wpp =
        (2 *
          dist *
          Math.tan(MathUtils.degToRad((camera as any).fov ?? 45) / 2)) /
        size.height;
      const spread = MathUtils.lerp(34, 145, hi / Math.max(1, mh - 1)) * wpp;
      p.p
        .copy(s.position)
        .addScaledVector(side, (Math.random() + Math.random() - 1) * spread)
        .addScaledVector(up, (Math.random() - 0.5) * spread * 0.55);
      p.v
        .copy(tangent)
        .multiplyScalar(0.02 + Math.random() * 0.07)
        .addScaledVector(side, (Math.random() - 0.5) * 0.1);
      p.age = 0;
      p.life = MathUtils.randFloat(1.7, 3.25);
      p.size = MathUtils.randFloat(34, 112);
      p.alpha = MathUtils.randFloat(0.012, 0.045);
      p.seed = Math.random();
    }
    const time = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const p = pool.current[i],
        o = i * 3;
      if (p.age < p.life) {
        const k = p.age / p.life;
        p.v.addScaledVector(drift(p.p, time, p.seed), dt * 0.07);
        p.v.multiplyScalar(Math.pow(0.993, dt * 60));
        p.p.addScaledVector(p.v, dt);
        p.age += dt;
        pos[o] = p.p.x;
        pos[o + 1] = p.p.y;
        pos[o + 2] = p.p.z;
        sz[i] = p.size * MathUtils.lerp(0.8, 1.5, k);
        al[i] = p.alpha * Math.pow(1 - k, 1.7);
        seed[i] = p.seed;
      } else {
        pos[o] = 9999;
        pos[o + 1] = 9999;
        pos[o + 2] = 9999;
        sz[i] = 0;
        al[i] = 0;
      }
    }
    if (geo.current) {
      (geo.current.getAttribute("position") as BufferAttribute).needsUpdate =
        true;
      (geo.current.getAttribute("aSize") as BufferAttribute).needsUpdate = true;
      (geo.current.getAttribute("aAlpha") as BufferAttribute).needsUpdate =
        true;
      (geo.current.getAttribute("aSeed") as BufferAttribute).needsUpdate = true;
    }
    if (mat.current)
      mat.current.uniforms.uDpr.value = Math.min(gl.getPixelRatio(), 2);
  });
  return (
    <points frustumCulled={false} renderOrder={98}>
      <bufferGeometry ref={geo}>
        <bufferAttribute
          attach="attributes-position"
          args={[pos, 3]}
          usage={DynamicDrawUsage}
        />
        <bufferAttribute
          attach="attributes-aSize"
          args={[sz, 1]}
          usage={DynamicDrawUsage}
        />
        <bufferAttribute
          attach="attributes-aAlpha"
          args={[al, 1]}
          usage={DynamicDrawUsage}
        />
        <bufferAttribute
          attach="attributes-aSeed"
          args={[seed, 1]}
          usage={DynamicDrawUsage}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={mat}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={{ uDpr: { value: 1 } }}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={NormalBlending}
      />
    </points>
  );
}
