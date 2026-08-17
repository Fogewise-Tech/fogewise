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
};
type Props = { emitter: PointerEmitterApi; count?: number };
const tangent = new Vector3(),
  side = new Vector3(),
  view = new Vector3(),
  up = new Vector3(0, 1, 0);
const vert = /*glsl*/ `uniform float uDpr;attribute float aSize;attribute float aAlpha;varying float vAlpha;void main(){vAlpha=aAlpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=max(1.,aSize*uDpr);}`;
const frag = /*glsl*/ `varying float vAlpha;void main(){vec2 q=gl_PointCoord-.5;float a=vAlpha*exp(-dot(q,q)*22.0);if(a<.003)discard;gl_FragColor=vec4(.91,.96,1.,a);}`;
export function NebulaSparkles({ emitter, count = 1500 }: Props) {
  const { camera, size, gl } = useThree();
  const geo = useRef<BufferGeometry>(null),
    mat = useRef<ShaderMaterial>(null),
    cursor = useRef(0),
    carry = useRef(0);
  const pool = useRef<P[]>(
    Array.from({ length: count }, () => ({
      p: new Vector3(9999, 9999, 9999),
      v: new Vector3(),
      age: 99,
      life: 1,
      size: 1,
      alpha: 0,
    })),
  );
  const pos = useMemo(() => new Float32Array(count * 3), [count]),
    sz = useMemo(() => new Float32Array(count), [count]),
    al = useMemo(() => new Float32Array(count), [count]);
  useMemo(() => pos.fill(9999), [pos]);
  useFrame((_, dt) => {
    const trail = emitter.trailRef.current;
    const rate = emitter.movingRef.current ? 520 : 18;
    carry.current += rate * Math.min(dt, 0.033);
    while (carry.current >= 1 && trail.length) {
      carry.current -= 1;
      const p = pool.current[cursor.current];
      cursor.current = (cursor.current + 1) % count;
      const mh = Math.min(58, trail.length),
        hi = Math.floor(Math.random() * mh),
        s = trail[hi];
      tangent.copy(s.tangent).normalize();
      view.copy(camera.position).sub(s.position).normalize();
      side.crossVectors(tangent, view).normalize();
      if (side.lengthSq() < 1e-7) side.crossVectors(tangent, up).normalize();
      const dist = camera.position.distanceTo(s.position),
        wpp =
          (2 *
            dist *
            Math.tan(MathUtils.degToRad((camera as any).fov ?? 45) / 2)) /
          size.height,
        spread = MathUtils.lerp(18, 130, hi / Math.max(1, mh - 1)) * wpp;
      p.p
        .copy(s.position)
        .addScaledVector(side, (Math.random() + Math.random() - 1) * spread)
        .addScaledVector(up, (Math.random() - 0.5) * spread * 0.45);
      p.v
        .copy(tangent)
        .multiplyScalar(0.04 + Math.random() * 0.13)
        .addScaledVector(side, (Math.random() - 0.5) * 0.15);
      p.age = 0;
      p.life = MathUtils.randFloat(0.9, 2.0);
      p.size = MathUtils.randFloat(0.65, 2.1);
      p.alpha = MathUtils.randFloat(0.22, 0.82);
    }
    for (let i = 0; i < count; i++) {
      const p = pool.current[i],
        o = i * 3;
      if (p.age < p.life) {
        const k = p.age / p.life;
        p.p.addScaledVector(p.v, dt);
        p.v.multiplyScalar(Math.pow(0.986, dt * 60));
        p.age += dt;
        pos[o] = p.p.x;
        pos[o + 1] = p.p.y;
        pos[o + 2] = p.p.z;
        sz[i] = p.size;
        al[i] = p.alpha * Math.pow(1 - k, 1.15);
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
    }
    if (mat.current)
      mat.current.uniforms.uDpr.value = Math.min(gl.getPixelRatio(), 2);
  });
  return (
    <points frustumCulled={false} renderOrder={102}>
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
      </bufferGeometry>
      <shaderMaterial
        ref={mat}
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
