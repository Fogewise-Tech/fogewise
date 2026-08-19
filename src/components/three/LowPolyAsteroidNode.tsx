"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Project } from "@/types/project";
import { useExperienceStore } from "@/store/useExperienceStore";
import { getProjectCheckpoint } from "@/lib/journey";

type Props = {
  project: Project;
  projectIndex: number;
  projectCount: number;
  active: boolean;
  mobileMode?: boolean;
};

type ShapeKind = "icosa" | "octa" | "dodeca";

const COVER_VERTEX = `
  uniform float uCrack;
  uniform vec2 uNodeCenter;
  uniform float uNodeRadius;

  attribute vec2 aFaceUvCenter;
  attribute vec2 aUvOffset;
  attribute float aUvAngle;
  attribute float aUvScale;
  attribute float aFaceShade;
  attribute vec3 aBarycentric;

  varying vec2 vUv;
  varying vec2 vProjectedUv;
  varying vec2 vFaceCenter;
  varying vec3 vNormalView;
  varying vec3 vViewPosition;
  varying float vFaceShade;
  varying vec3 vBarycentric;

  mat2 rotate2d(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
  }

  void main() {
    float crack = smoothstep(0.0, 1.0, uCrack);

    vec2 localUv = uv - aFaceUvCenter;
    localUv *= mix(1.0, aUvScale, crack);
    localUv = rotate2d(aUvAngle * crack) * localUv;

    vUv = aFaceUvCenter + localUv + aUvOffset * crack;
    vFaceCenter = aFaceUvCenter;
    vFaceShade = aFaceShade;
    vBarycentric = aBarycentric;

    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec4 clipPosition = projectionMatrix * mv;
    vec2 ndcPosition = clipPosition.xy / max(clipPosition.w, 0.0001);

    vProjectedUv =
      (ndcPosition - uNodeCenter) /
      max(uNodeRadius * 2.0, 0.0001) +
      0.5;

    vNormalView = normalize(normalMatrix * normal);
    vViewPosition = -mv.xyz;

    gl_Position = clipPosition;
  }
`;

const COVER_FRAGMENT = `
  uniform sampler2D uCover;
  uniform float uHasCover;
  uniform float uCoverAspect;
  uniform float uCrack;
  uniform float uTime;

  varying vec2 vUv;
  varying vec2 vProjectedUv;
  varying vec2 vFaceCenter;
  varying vec3 vNormalView;
  varying vec3 vViewPosition;
  varying float vFaceShade;
  varying vec3 vBarycentric;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }

  float noise21(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x)
      + (c - a) * u.y * (1.0 - u.x)
      + (d - b) * u.x * u.y;
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += noise21(p) * amplitude;
      p *= 2.03;
      amplitude *= 0.5;
    }
    return value;
  }

  vec2 coverUv(vec2 uv, float aspect) {
    vec2 result = uv;
    if (aspect > 1.0) {
      result.x = (result.x - 0.5) / aspect + 0.5;
    } else if (aspect > 0.0) {
      result.y = (result.y - 0.5) * aspect + 0.5;
    }
    return clamp(result, 0.002, 0.998);
  }

  vec3 sampleRgbSplit(vec2 uv, float amount) {
    vec2 safeUv = coverUv(uv, max(uCoverAspect, 0.0001));
    vec2 shift = vec2(amount, amount * 0.28);
    float r = texture2D(
      uCover,
      coverUv(safeUv + shift, max(uCoverAspect, 0.0001))
    ).r;
    float g = texture2D(uCover, safeUv).g;
    float b = texture2D(
      uCover,
      coverUv(safeUv - shift, max(uCoverAspect, 0.0001))
    ).b;
    return vec3(r, g, b);
  }

  void main() {
    float crack = smoothstep(0.0, 1.0, uCrack);

    vec2 cleanUv = vProjectedUv;
    vec2 localFacet = (vUv - vFaceCenter) * 11.0;

    float n1 = fbm(
      localFacet * 3.3 +
      vec2(vFaceShade * 19.7, vFaceShade * 8.1) +
      uTime * 0.07
    );

    float n2 = fbm(
      localFacet.yx * 4.4 -
      vec2(vFaceShade * 13.2, vFaceShade * 22.1) -
      uTime * 0.055
    );

    float row = floor((localFacet.y + vFaceShade * 13.0) * 8.0);
    float tick = floor(uTime * 20.0);

    float horizontalJitter =
      (hash21(vec2(row, tick + vFaceShade * 117.0)) - 0.5) *
      0.012 *
      crack;

    vec2 crackShift =
      vec2(n1 - 0.5, n2 - 0.5) * 0.016 * crack +
      vec2(horizontalJitter, 0.0);

    vec2 crackedUv = cleanUv + (vUv - cleanUv) * 0.22 * crack + crackShift;

    vec3 cleanCover = texture2D(
      uCover,
      coverUv(cleanUv, max(uCoverAspect, 0.0001))
    ).rgb;

    vec3 crackedBase = texture2D(
      uCover,
      coverUv(crackedUv, max(uCoverAspect, 0.0001))
    ).rgb;

    vec3 crackedSplit = sampleRgbSplit(
      crackedUv,
      0.0004 + crack * 0.0009
    );

    vec3 crackedCover = mix(crackedBase, crackedSplit, 0.32);

    float grainA = hash21(
      gl_FragCoord.xy * 0.91 +
      vec2(uTime * 71.0, -uTime * 43.0) +
      vFaceShade * 93.0
    );

    float grainB = hash21(
      gl_FragCoord.yx * 1.27 -
      vec2(uTime * 39.0, uTime * 61.0) +
      vFaceShade * 57.0
    );

    float grain = ((grainA + grainB) * 0.5 - 0.5) * 0.022 * crack;
    float scan = sin(gl_FragCoord.y * 1.5 + uTime * 11.0) * 0.002 * crack;
    float scratchA = 1.0 - smoothstep(
      0.0,
      0.026,
      abs(fract(localFacet.x * 1.7 + localFacet.y * 0.42 + n1 * 1.8) - 0.5)
    );
    float scratchB = 1.0 - smoothstep(
      0.0,
      0.018,
      abs(fract(localFacet.x * -0.38 + localFacet.y * 2.15 + n2 * 1.6) - 0.5)
    );
    float crackScratch =
      max(scratchA * smoothstep(0.42, 0.92, n2), scratchB * smoothstep(0.48, 0.96, n1)) *
      crack;

    crackedCover += grain + scan;
    crackedCover += vec3(0.42, 0.48, 0.5) * crackScratch * 0.38;
    crackedCover *= 1.0 - crackScratch * 0.08;

    float hot = max(crackedCover.r, max(crackedCover.g, crackedCover.b));
    crackedCover += smoothstep(0.72, 1.0, hot) * vec3(0.018, 0.006, 0.008) * crack;
    crackedCover.b += smoothstep(0.12, 0.72, 1.0 - hot) * 0.006 * crack;

    vec3 fallback = vec3(0.15, 0.16, 0.19);
    vec3 hoverCover = mix(cleanCover, crackedCover, smoothstep(0.12, 1.0, crack));
    vec3 base = mix(fallback, hoverCover, uHasCover);

    vec3 normalView = normalize(vNormalView);
    vec3 viewDirection = normalize(vViewPosition);
    vec3 lightDirection = normalize(vec3(0.42, 0.68, 0.92));
    vec3 halfDirection = normalize(lightDirection + viewDirection);

    float diffuse = clamp(dot(normalView, lightDirection), 0.0, 1.0);
    float ndv = clamp(dot(normalView, viewDirection), 0.0, 1.0);
    float fresnel = pow(1.0 - ndv, 2.8);
    float specular = pow(
      clamp(dot(normalView, halfDirection), 0.0, 1.0),
      38.0
    );

    float nearestEdge = min(
      vBarycentric.x,
      min(vBarycentric.y, vBarycentric.z)
    );

    float seamWide = 1.0 - smoothstep(0.0, 0.045, nearestEdge);
    float seamSoft = 1.0 - smoothstep(0.0, 0.021, nearestEdge);
    float seamHard = 1.0 - smoothstep(0.0, 0.0055, nearestEdge);

    float facetBase = 0.9 + vFaceShade * 0.16;
    float facetHover = 0.94 + vFaceShade * 0.18;
    float facetTone = mix(facetBase, facetHover, crack);

    vec3 color = base * facetTone;
    color *= 0.94 + diffuse * 0.08;

    vec3 edgeTint = mix(vec3(0.58, 0.78, 1.0), vec3(1.0, 0.88, 0.62), vFaceShade);
    float seamGlint = seamHard * (0.16 + fresnel * 0.34) + seamSoft * fresnel * 0.12;

    color *= 1.0 - seamWide * (0.008 + crack * 0.006);
    color *= 1.0 - seamSoft * (0.012 + crack * 0.01);
    color += edgeTint * seamGlint * (0.18 + crack * 0.08);

    float glassDust = fbm(vProjectedUv * 24.0 + vec2(uTime * 0.025, -uTime * 0.018));
    float prismBand =
      sin((vProjectedUv.x + vProjectedUv.y) * 19.0 + vFaceShade * 8.0) * 0.5 +
      0.5;
    float mineralNoise = fbm(localFacet * 1.55 + vFaceShade * 9.0);
    vec3 mineral =
      mix(vec3(0.018, 0.016, 0.020), vec3(0.16, 0.12, 0.10), mineralNoise) +
      vec3(0.04, 0.045, 0.055) * diffuse;
    vec3 prism =
      vec3(0.025, 0.07, 0.11) +
      vec3(0.36, 0.12, 0.55) * smoothstep(0.70, 1.0, prismBand) +
      vec3(0.78, 0.48, 0.16) * smoothstep(0.88, 1.0, 1.0 - prismBand);
    vec3 glassShell =
      mineral +
      prism * (0.08 + fresnel * 0.48) +
      vec3(0.12, 0.13, 0.15) * diffuse * 0.12 +
      vec3(1.0, 0.92, 0.78) * specular * 0.34;

    color = mix(color, color + glassShell, 0.2);
    color += (glassDust - 0.5) * 0.026;
    color += vec3(0.12, 0.16, 0.24) * fresnel * 0.18;
    color += vec3(1.0) * specular * 0.12;

    color = mix(color, color * vec3(1.04, 1.015, 1.08), 0.12);
    color = mix(color, pow(max(color, 0.0), vec3(0.86)), crack * 0.2);

    gl_FragColor = vec4(color, 1.0);
  }
`;

function clamp(v: number, lo: number, hi: number, fallback: number) {
  const n = Number.isFinite(v) ? v : fallback;
  return Math.max(lo, Math.min(hi, n));
}

function hash3(x: number, y: number, z: number) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

function noise3(x: number, y: number, z: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (i: number, j: number, k: number) => hash3(xi + i, yi + j, zi + k);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), u);
  const x10 = lerp(c(0, 1, 0), c(1, 1, 0), u);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), u);
  const x11 = lerp(c(0, 1, 1), c(1, 1, 1), u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w) * 2 - 1;
}

function hashString(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function createBaseGeometry(kind: ShapeKind, detail: number) {
  switch (kind) {
    case "octa":
      return new THREE.OctahedronGeometry(1, Math.min(detail, 2));
    case "dodeca":
      return new THREE.DodecahedronGeometry(1, Math.min(detail, 1));
    case "icosa":
    default:
      return new THREE.IcosahedronGeometry(1, detail);
  }
}

function addProjectedUvsAndFacetAttributes(
  geometry: THREE.BufferGeometry,
  seed: number,
) {
  const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
  geometry.computeBoundingBox();

  const box = geometry.boundingBox;
  if (!box) return;

  const width = Math.max(box.max.x - box.min.x, 0.0001);
  const height = Math.max(box.max.y - box.min.y, 0.0001);

  const uvs = new Float32Array(positions.count * 2);
  const faceUvCenters = new Float32Array(positions.count * 2);
  const uvOffsets = new Float32Array(positions.count * 2);
  const uvAngles = new Float32Array(positions.count);
  const uvScales = new Float32Array(positions.count);
  const faceShades = new Float32Array(positions.count);
  const barycentrics = new Float32Array(positions.count * 3);

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    uvs[index * 2] = (x - box.min.x) / width;
    uvs[index * 2 + 1] = (y - box.min.y) / height;
  }

  const random = createSeededRandom(seed ^ 0xa511e9b3);

  for (let index = 0; index < positions.count; index += 3) {
    const uv0x = uvs[index * 2];
    const uv0y = uvs[index * 2 + 1];
    const uv1x = uvs[(index + 1) * 2];
    const uv1y = uvs[(index + 1) * 2 + 1];
    const uv2x = uvs[(index + 2) * 2];
    const uv2y = uvs[(index + 2) * 2 + 1];

    const centerX = (uv0x + uv1x + uv2x) / 3;
    const centerY = (uv0y + uv1y + uv2y) / 3;
    const offsetX = (random() - 0.5) * 0.24;
    const offsetY = (random() - 0.5) * 0.24;
    const angle = (random() - 0.5) * 0.62;
    const scale = 0.82 + random() * 0.42;
    const shade = random();

    for (let vertex = 0; vertex < 3; vertex += 1) {
      const vertexIndex = index + vertex;

      faceUvCenters[vertexIndex * 2] = centerX;
      faceUvCenters[vertexIndex * 2 + 1] = centerY;
      uvOffsets[vertexIndex * 2] = offsetX;
      uvOffsets[vertexIndex * 2 + 1] = offsetY;
      uvAngles[vertexIndex] = angle;
      uvScales[vertexIndex] = scale;
      faceShades[vertexIndex] = shade;

      const baryIndex = vertexIndex * 3;
      barycentrics[baryIndex] = vertex === 0 ? 1 : 0;
      barycentrics[baryIndex + 1] = vertex === 1 ? 1 : 0;
      barycentrics[baryIndex + 2] = vertex === 2 ? 1 : 0;
    }
  }

  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute(
    "aFaceUvCenter",
    new THREE.BufferAttribute(faceUvCenters, 2),
  );
  geometry.setAttribute("aUvOffset", new THREE.BufferAttribute(uvOffsets, 2));
  geometry.setAttribute("aUvAngle", new THREE.BufferAttribute(uvAngles, 1));
  geometry.setAttribute("aUvScale", new THREE.BufferAttribute(uvScales, 1));
  geometry.setAttribute("aFaceShade", new THREE.BufferAttribute(faceShades, 1));
  geometry.setAttribute(
    "aBarycentric",
    new THREE.BufferAttribute(barycentrics, 3),
  );
}

function buildGeometry(
  kind: ShapeKind,
  detail: number,
  roughness: number,
  axisScale: THREE.Vector3,
  seed: number,
) {
  const base = createBaseGeometry(kind, detail);
  const positions = base.getAttribute("position") as THREE.BufferAttribute;
  const vertex = new THREE.Vector3();
  const rough = clamp(roughness, 0, 100, 72) / 100;

  for (let index = 0; index < positions.count; index += 1) {
    vertex.fromBufferAttribute(positions, index);

    const n =
      noise3(vertex.x * 2.2, vertex.y * 2.2, vertex.z * 2.2) * 0.7 +
      noise3(vertex.x * 5.1, vertex.y * 5.1, vertex.z * 5.1) * 0.3;

    vertex.multiplyScalar(1 + n * rough * 0.42);
    vertex.set(
      vertex.x * axisScale.x,
      vertex.y * axisScale.y,
      vertex.z * axisScale.z,
    );

    positions.setXYZ(index, vertex.x, vertex.y, vertex.z);
  }

  positions.needsUpdate = true;

  let geometry: THREE.BufferGeometry;

  if (base.index) {
    geometry = base.toNonIndexed();
    base.dispose();
  } else {
    geometry = base;
  }

  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  addProjectedUvsAndFacetAttributes(geometry, seed);

  return geometry;
}

function smooth01(value: number) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function createFallbackTexture() {
  const data = new Uint8Array([58, 60, 66, 255]);
  const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function LowPolyAsteroidNode({
  project,
  projectIndex,
  projectCount,
  active,
  mobileMode = false,
}: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const coverTextureRef = useRef<THREE.Texture | null>(null);
  const [hovered, setHovered] = useState(false);

  const config = useMemo(() => {
    const seed = hashString(project.id);
    const random = createSeededRandom(seed);
    const shapeKinds: ShapeKind[] = ["icosa", "octa", "dodeca"];
    const shapeKind =
      shapeKinds[Math.floor(random() * shapeKinds.length)] ?? "icosa";
    const outgoingTheta = random() * Math.PI * 2;
    const outgoingRadius = mobileMode
      ? 7 + random() * 2.2
      : 10.5 + random() * 3.6;

    return {
      seed,
      shapeKind,
      detail: 1,
      roughness: 54 + random() * 22,
      axisScale: new THREE.Vector3(
        0.84 + random() * 0.38,
        0.84 + random() * 0.38,
        0.84 + random() * 0.38,
      ),
      rotation: new THREE.Vector3(
        (0.8 + random() * 1.2) * (random() > 0.5 ? 1 : -1),
        (1 + random() * 1.5) * (random() > 0.5 ? 1 : -1),
        (0.25 + random() * 0.55) * (random() > 0.5 ? 1 : -1),
      ),
      focusScale: mobileMode ? 1.14 + random() * 0.08 : 1.54 + random() * 0.16,
      focusPosition: new THREE.Vector3(0, 0, 0),
      incomingPosition: new THREE.Vector3(
        0,
        0,
        (mobileMode ? -18 : -25) - random() * (mobileMode ? 4 : 8),
      ),
      outgoingPosition: new THREE.Vector3(
        Math.cos(outgoingTheta) * outgoingRadius,
        Math.sin(outgoingTheta) * outgoingRadius * 0.84,
        mobileMode ? 2.2 + random() * 1.2 : 3.2 + random() * 1.8,
      ),
    };
  }, [mobileMode, project.id]);

  const geometry = useMemo(
    () =>
      buildGeometry(
        config.shapeKind,
        config.detail,
        config.roughness,
        config.axisScale,
        config.seed,
      ),
    [
      config.axisScale,
      config.detail,
      config.roughness,
      config.seed,
      config.shapeKind,
    ],
  );

  const fallbackTexture = useMemo(() => createFallbackTexture(), []);

  const uniforms = useMemo(
    () => ({
      uCover: { value: fallbackTexture as THREE.Texture },
      uHasCover: { value: 0 },
      uCoverAspect: { value: 1 },
      uCrack: { value: 0 },
      uTime: { value: 0 },
      uNodeCenter: { value: new THREE.Vector2(0, 0) },
      uNodeRadius: { value: 0.25 },
    }),
    [fallbackTexture],
  );

  const frameTemp = useMemo(
    () => ({
      centerWorld: new THREE.Vector3(),
      centerNdc: new THREE.Vector3(),
      cameraRight: new THREE.Vector3(),
      edgeWorld: new THREE.Vector3(),
      edgeNdc: new THREE.Vector3(),
    }),
    [],
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useEffect(() => {
    return () => {
      fallbackTexture.dispose();
    };
  }, [fallbackTexture]);

  useEffect(() => {
    const material = materialRef.current;

    if (material) {
      material.uniforms.uCover.value = fallbackTexture;
      material.uniforms.uHasCover.value = 0;
      material.uniforms.uCoverAspect.value = 1;
      material.needsUpdate = true;
    }

    if (!project.coverImage) {
      coverTextureRef.current?.dispose();
      coverTextureRef.current = null;
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    let ownedTexture: THREE.Texture | null = null;

    async function loadCover() {
      try {
        const response = await fetch(project.coverImage!, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(
            `Cover request failed: ${response.status} ${response.statusText} (${project.coverImage})`,
          );
        }

        const blob = await response.blob();
        if (cancelled) return;

        objectUrl = URL.createObjectURL(blob);
        const loader = new THREE.TextureLoader();

        loader.load(
          objectUrl,
          (texture) => {
            if (cancelled) {
              texture.dispose();
              return;
            }

            ownedTexture = texture;

            const image = texture.image as HTMLImageElement | undefined;
            const width = image?.naturalWidth || image?.width || 1;
            const height = image?.naturalHeight || image?.height || 1;

            texture.colorSpace = THREE.SRGBColorSpace;
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.generateMipmaps = true;
            texture.anisotropy = 4;
            texture.needsUpdate = true;

            const previous = coverTextureRef.current;
            if (previous && previous !== texture) {
              previous.dispose();
            }

            coverTextureRef.current = texture;

            const currentMaterial = materialRef.current;

            if (currentMaterial) {
              currentMaterial.uniforms.uCover.value = texture;
              currentMaterial.uniforms.uHasCover.value = 1;
              currentMaterial.uniforms.uCoverAspect.value =
                width / Math.max(height, 1);
              currentMaterial.needsUpdate = true;
            }

            if (objectUrl) {
              URL.revokeObjectURL(objectUrl);
              objectUrl = null;
            }
          },
          undefined,
          (error) => {
            if (!cancelled) {
              console.error(
                `Failed to decode cover image for "${project.name}":`,
                error,
              );
            }

            if (objectUrl) {
              URL.revokeObjectURL(objectUrl);
              objectUrl = null;
            }
          },
        );
      } catch (error) {
        if (!cancelled) {
          console.error(
            `Failed to load cover image for "${project.name}":`,
            error,
          );
        }
      }
    }

    void loadCover();

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }

      if (ownedTexture && coverTextureRef.current === ownedTexture) {
        coverTextureRef.current = null;
        ownedTexture.dispose();
      }
    };
  }, [fallbackTexture, project.coverImage, project.name]);

  useEffect(() => {
    if (mobileMode || !hovered) return;

    document.body.style.cursor = "pointer";

    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered, mobileMode]);

  useFrame((state, delta) => {
    const group = groupRef.current;
    const material = materialRef.current;

    if (!group || !material) return;

    const experience = useExperienceStore.getState();
    const selected = experience.selectedProjectId === project.id;
    const checkpoint = getProjectCheckpoint(projectIndex, projectCount);
    const sectionSpan = projectCount > 0 ? 1 / projectCount : 1;
    const relative = (experience.scrollProgress - checkpoint) / sectionSpan;

    let shouldShow = false;
    const targetPosition = new THREE.Vector3().copy(config.incomingPosition);
    let targetScale = config.focusScale * 0.18;

    if (selected) {
      shouldShow = true;
      targetPosition.copy(config.focusPosition);
      targetScale = config.focusScale * 1.06;
    } else if (relative >= -0.98 && relative <= 1) {
      shouldShow = true;

      if (relative <= 0) {
        const incoming = smooth01((relative + 0.98) / 0.98);

        targetPosition.lerpVectors(
          config.incomingPosition,
          config.focusPosition,
          incoming,
        );

        targetScale = THREE.MathUtils.lerp(
          config.focusScale * 0.16,
          config.focusScale,
          incoming,
        );
      } else {
        const outgoing = smooth01(relative);

        targetPosition.lerpVectors(
          config.focusPosition,
          config.outgoingPosition,
          outgoing,
        );

        targetScale = THREE.MathUtils.lerp(
          config.focusScale,
          config.focusScale * 0.72,
          outgoing,
        );
      }
    }

    group.visible = shouldShow;
    if (!shouldShow) return;

    group.position.x = THREE.MathUtils.damp(
      group.position.x,
      targetPosition.x,
      5.6,
      delta,
    );

    group.position.y = THREE.MathUtils.damp(
      group.position.y,
      targetPosition.y,
      5.6,
      delta,
    );

    group.position.z = THREE.MathUtils.damp(
      group.position.z,
      targetPosition.z,
      5.6,
      delta,
    );

    const hoverScale = hovered && !mobileMode ? 1.025 : 1;

    const nextScale = THREE.MathUtils.damp(
      group.scale.x,
      targetScale * hoverScale,
      active ? 7 : 5.2,
      delta,
    );

    group.scale.setScalar(nextScale);

    const rotationScale =
      (mobileMode ? 0.62 : 0.82) * (hovered && !mobileMode ? 0.42 : 1);

    group.rotation.x += config.rotation.x * 0.05 * delta * rotationScale;
    group.rotation.y += config.rotation.y * 0.05 * delta * rotationScale;
    group.rotation.z += config.rotation.z * 0.05 * delta * rotationScale;

    group.updateWorldMatrix(true, false);

    group.getWorldPosition(frameTemp.centerWorld);
    frameTemp.centerNdc.copy(frameTemp.centerWorld).project(state.camera);

    frameTemp.cameraRight
      .setFromMatrixColumn(state.camera.matrixWorld, 0)
      .normalize();

    const localRadius = geometry.boundingSphere?.radius ?? 1;
    const worldRadius = localRadius * group.scale.x;

    frameTemp.edgeWorld
      .copy(frameTemp.centerWorld)
      .addScaledVector(frameTemp.cameraRight, worldRadius);

    frameTemp.edgeNdc.copy(frameTemp.edgeWorld).project(state.camera);

    const radiusNdc = Math.max(
      Math.abs(frameTemp.edgeNdc.x - frameTemp.centerNdc.x),
      0.001,
    );

    material.uniforms.uNodeCenter.value.set(
      frameTemp.centerNdc.x,
      frameTemp.centerNdc.y,
    );

    material.uniforms.uNodeRadius.value = radiusNdc;
    material.uniforms.uTime.value += delta;

    material.uniforms.uCrack.value = THREE.MathUtils.damp(
      material.uniforms.uCrack.value,
      hovered && !mobileMode ? 1 : 0,
      hovered ? 7.5 : 6,
      delta,
    );
  });

  const startsFocused = projectIndex === 0;

  return (
    <group
      ref={groupRef}
      position={
        startsFocused
          ? config.focusPosition.toArray()
          : config.incomingPosition.toArray()
      }
      scale={startsFocused ? config.focusScale : config.focusScale * 0.16}
      visible={startsFocused}
      onPointerEnter={(event) => {
        if (mobileMode) return;
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
    >
      <mesh geometry={geometry} renderOrder={3}>
        <shaderMaterial
          ref={materialRef}
          vertexShader={COVER_VERTEX}
          fragmentShader={COVER_FRAGMENT}
          uniforms={uniforms}
          side={THREE.DoubleSide}
          depthWrite
          depthTest
          transparent
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
