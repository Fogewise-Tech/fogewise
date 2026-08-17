# FOGEWISE Showcase

FOGEWISE Showcase is an immersive 3D project portfolio built with Next.js, Three.js and React Three Fiber. The experience presents projects as glowing galaxy nodes, with scroll-driven camera movement, animated nebula effects, a detail overlay, custom brand typography and ambient space audio.

## Features

- Scroll-controlled 3D journey through project nodes
- Infinite-feeling scroll loop with smooth camera easing
- Project detail overlay with highlights, technologies and links
- Ambient audio with an on/off sound control
- Custom sparkle cursor and layered galaxy particle effects
- Branded typography using local font assets
- Data loading from Directus when configured, with local fallback data

## Tech Stack

- Next.js App Router
- React and TypeScript
- Three.js
- `@react-three/fiber`
- `@react-three/drei`
- GSAP ScrollTrigger
- Zustand
- Directus-ready data source

## Getting Started

Install dependencies:

```bash
pnpm install
```

Run the development server:

```bash
pnpm dev
```

Open:

```text
http://localhost:3000
```

Build for production:

```bash
pnpm build
```

Start the production build:

```bash
pnpm start
```

## Directus

The repository includes a Docker Compose setup for Directus.

Start the CMS stack:

```bash
docker compose up -d
```

Directus runs at:

```text
http://localhost:8055
```

## Experience Notes

The scroll journey is calculated from project count rather than hand-authored camera positions. Each project becomes a checkpoint in the galaxy path, and smootherstep easing slows the camera near active projects before accelerating into the next segment.
