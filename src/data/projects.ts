import type { Project } from "@/types/project";

export const localProjects: Project[] = [
  {
    id: "p1",
    slug: "3d-furniture",
    name: "3D furniture",
    tagline: "Generative 3D furniture workflow",
    description:
      "A concept for generating customizable furniture assets, interactive previews and export-ready 3D outputs.",
    category: "AI / 3D",
    technologies: ["Three.js", "React", "FastAPI", "GLTF"],
    year: 2026,
    coverImage: "/projects/ai-furniture.png",
    accent: "#93c5fd",
    highlights: [
      "Parametric customization",
      "Interactive 360-degree preview",
      "GLTF / USDZ-oriented pipeline",
    ],
    featured: true,
    published: true,
    sortOrder: 2,
  },
  {
    id: "p2",
    slug: "fashion-studio",
    name: "Fashion Studio",
    tagline: "Interactive product customization in 3D",
    description:
      "A visual studio for configuring garments, artwork and front/back product views with real-time interaction.",
    category: "3D Commerce",
    technologies: ["React", "Three.js", "SVG", "WebGL"],
    year: 2026,
    coverImage: "/projects/fashion-studio.png",
    accent: "#f9a8d4",
    highlights: [
      "Front/back garment editing",
      "Recolorable SVG assets",
      "Interactive design placement",
    ],
    featured: true,
    published: true,
    sortOrder: 3,
  },
  {
    id: "p3",
    slug: "website-cloner",
    name: "AI Website Cloner",
    tagline: "Rebuild interfaces from references",
    description:
      "An experimental workflow for reconstructing multi-page interfaces and reusable visual systems from references.",
    category: "AI / Web",
    technologies: ["Next.js", "TypeScript", "AI"],
    year: 2026,
    coverImage: "/projects/website-cloner.png",
    accent: "#c4b5fd",
    highlights: [
      "Multi-route reconstruction",
      "Reusable component extraction",
      "Reference-driven visual matching",
    ],
    featured: false,
    published: true,
    sortOrder: 4,
  },
];
