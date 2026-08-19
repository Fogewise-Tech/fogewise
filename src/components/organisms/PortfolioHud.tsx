"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import type { Project } from "@/types/project";
import { ProjectMeta } from "@/components/molecules/ProjectMeta";
import { SoundToggle } from "@/components/atoms/SoundToggle";
import { useExperienceStore } from "@/store/useExperienceStore";

type Props = { projects: Project[] };

function smoothstep(value: number) {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

export function PortfolioHud({ projects }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const activeIndex = useExperienceStore((state) => state.activeIndex);
  const focusStrength = useExperienceStore((state) => state.focusStrength);
  const scrollProgress = useExperienceStore((state) => state.scrollProgress);
  const selectedProjectId = useExperienceStore(
    (state) => state.selectedProjectId,
  );

  const project = projects[activeIndex];
  const lastProjectCheckpoint =
    projects.length > 0 ? (projects.length - 1) / projects.length : 0;
  const contactStart =
    lastProjectCheckpoint + (1 - lastProjectCheckpoint) * 0.38;
  const contactStrength = smoothstep(
    (scrollProgress - contactStart) / Math.max(0.0001, 1 - contactStart),
  );

  useLayoutEffect(() => {
    if (!panelRef.current) return;
    gsap.fromTo(
      panelRef.current,
      { y: 22 },
      { y: 0, duration: 0.65, ease: "power3.out", overwrite: true },
    );
  }, [activeIndex]);

  if (!project) return null;

  return (
    <div
      className={`portfolio-hud ${selectedProjectId ? "portfolio-hud--dimmed" : ""}`}
    >
      <header className="hud-header">
        <a href="/" className="brand" aria-label="FOGEWISE showcase">
          <span className="brand__name">FOGEWISE</span>
          <span className="brand__script">Showcase</span>
        </a>

        <SoundToggle />
      </header>

      <div
        ref={panelRef}
        className="hud-project-panel"
        style={{
          opacity: focusStrength * (1 - contactStrength),
          pointerEvents:
            focusStrength > 0.22 && contactStrength < 0.2 ? "auto" : "none",
        }}
      >
        <ProjectMeta project={project} index={activeIndex} total={projects.length} />
      </div>

      <footer className="hud-footer" />
    </div>
  );
}
