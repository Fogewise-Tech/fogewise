import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  MathUtils,
  NormalBlending,
  ShaderMaterial,
  Vector3,
} from "three";
import type { PointerEmitterApi } from "@/hooks/usePointerEmitter";
type Props = { emitter: PointerEmitterApi };
type C = {
  width: number;
  opacity: number;
  dist: number;
  speed: number;
  add?: boolean;
  phase: number;
};
const prev = new Vector3(),
  next = new Vector3(),
  tan = new Vector3(),
  view = new Vector3(),
  normal = new Vector3(),
  binormal = new Vector3(),
  center = new Vector3(),
  L = new Vector3(),
  R = new Vector3();
const vert = /*glsl*/ `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const frag = /*glsl*/ `uniform float uTime;uniform float uOpacity;uniform float uSeed;varying vec2 vUv;float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p*=2.;a*=.5;}return v;}void main(){float edge=pow(max(0.,1.-abs(vUv.y*2.-1.)),2.2);float along=pow(sin(vUv.x*3.14159),.55);float f=fbm(vec2(vUv.x*9.+uTime*.07+uSeed,vUv.y*3.4+uSeed*5.));float breakup=smoothstep(.22,.82,f);float a=uOpacity*edge*along*(.3+.95*breakup);if(a<.002)discard;gl_FragColor=vec4(mix(vec3(.48,.68,1.),vec3(.93,.97,1.),breakup),a);}`;
function Strip({ emitter, c }: { emitter: PointerEmitterApi; c: C }) {
  const { camera, size } = useThree();
  const g = useRef<BufferGeometry>(null),
    m = useRef<ShaderMaterial>(null);
  const max = 110;
  const data = useMemo(() => {
    const p = new Float32Array(max * 6),
      uv = new Float32Array(max * 4),
      idx: number[] = [];
    for (let i = 0; i < max; i++) {
      const t = i / (max - 1);
      uv[i * 4] = t;
      uv[i * 4 + 1] = 0;
      uv[i * 4 + 2] = t;
      uv[i * 4 + 3] = 1;
      if (i < max - 1) {
        const a = i * 2;
        idx.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
      }
    }
    return { p, uv, idx: new Uint16Array(idx) };
  }, []);
  useFrame((state) => {
    const trail = emitter.trailRef.current,
      usable = Math.min(max, trail.length);
    if (!g.current) return;
    g.current.setDrawRange(0, Math.max(0, (usable - 1) * 6));
    if (usable < 2) return;
    for (let i = 0; i < usable; i++) {
      const sample = trail[usable - 1 - i],
        p0 =
          trail[usable - 1 - Math.max(0, i - 1)]?.position ?? sample.position,
        p1 =
          trail[usable - 1 - Math.min(usable - 1, i + 1)]?.position ??
          sample.position;
      prev.copy(p0);
      next.copy(p1);
      tan.copy(next).sub(prev).normalize();
      view.copy(camera.position).sub(sample.position).normalize();
      normal.crossVectors(tan, view).normalize();
      if (normal.lengthSq() < 1e-7) normal.set(1, 0, 0);
      binormal.crossVectors(normal, tan).normalize();
      const d = camera.position.distanceTo(sample.position),
        wpp =
          (2 *
            d *
            Math.tan(MathUtils.degToRad((camera as any).fov ?? 45) / 2)) /
          size.height,
        t = i / (usable - 1),
        profile = Math.pow(Math.sin(t * Math.PI), 0.7),
        ww = c.width * wpp * (0.2 + profile),
        wob =
          Math.sin(t * 8.5 + state.clock.elapsedTime * c.speed + c.phase) *
          c.dist *
          (0.3 + profile),
        curl =
          Math.sin(
            t * 15 - state.clock.elapsedTime * c.speed * 0.63 + c.phase * 2,
          ) *
          c.dist *
          0.55;
      center
        .copy(sample.position)
        .addScaledVector(binormal, wob)
        .addScaledVector(normal, curl);
      L.copy(center).addScaledVector(normal, ww * 0.5);
      R.copy(center).addScaledVector(normal, -ww * 0.5);
      const o = i * 6;
      data.p[o] = L.x;
      data.p[o + 1] = L.y;
      data.p[o + 2] = L.z;
      data.p[o + 3] = R.x;
      data.p[o + 4] = R.y;
      data.p[o + 5] = R.z;
    }
    for (let i = usable; i < max; i++) {
      data.p[i * 6] =
        data.p[i * 6 + 1] =
        data.p[i * 6 + 2] =
        data.p[i * 6 + 3] =
        data.p[i * 6 + 4] =
        data.p[i * 6 + 5] =
          9999;
    }
    (g.current.getAttribute("position") as BufferAttribute).needsUpdate = true;
    if (m.current) m.current.uniforms.uTime.value = state.clock.elapsedTime;
  });
  return (
    <mesh frustumCulled={false} renderOrder={101}>
      <bufferGeometry ref={g}>
        <bufferAttribute
          attach="attributes-position"
          args={[data.p, 3]}
          usage={DynamicDrawUsage}
        />
        <bufferAttribute attach="attributes-uv" args={[data.uv, 2]} />
        <bufferAttribute attach="index" args={[data.idx, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={m}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={{
          uTime: { value: 0 },
          uOpacity: { value: c.opacity },
          uSeed: { value: c.phase },
        }}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={c.add ? AdditiveBlending : NormalBlending}
      />
    </mesh>
  );
}
export function NebulaFilaments({ emitter }: Props) {
  const layers: C[] = [
    { width: 168, opacity: 0.018, dist: 0.085, speed: 0.45, phase: 0.1 },
    { width: 118, opacity: 0.026, dist: 0.07, speed: 0.62, phase: 1.3 },
    { width: 76, opacity: 0.04, dist: 0.05, speed: 0.82, phase: 2.7 },
    { width: 42, opacity: 0.062, dist: 0.032, speed: 1.08, phase: 4.1 },
    {
      width: 18,
      opacity: 0.095,
      dist: 0.018,
      speed: 1.45,
      phase: 5.6,
      add: true,
    },
  ];
  return (
    <group>
      {layers.map((c, i) => (
        <Strip key={i} emitter={emitter} c={c} />
      ))}
    </group>
  );
}
