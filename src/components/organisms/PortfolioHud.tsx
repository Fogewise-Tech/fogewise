"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import type { Project } from "@/types/project";
import { ProjectMeta } from "@/components/molecules/ProjectMeta";
import { SoundToggle } from "@/components/atoms/SoundToggle";
import { useExperienceStore } from "@/store/useExperienceStore";

type Props = { projects: Project[] };

export function PortfolioHud({ projects }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const activeIndex = useExperienceStore((state) => state.activeIndex);
  const focusStrength = useExperienceStore((state) => state.focusStrength);
  const selectedProjectId = useExperienceStore(
    (state) => state.selectedProjectId,
  );

  const project = projects[activeIndex];

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
        <div className="brand" aria-label="FOGEWISE showcase">
          <span className="brand__name">FOGEWISE</span>
          <span className="brand__script">showcase</span>
        </div>
        <SoundToggle />
      </header>

      <div
        ref={panelRef}
        className="hud-project-panel"
        style={{
          opacity: focusStrength,
          pointerEvents: focusStrength > 0.22 ? "auto" : "none",
        }}
      >
        <ProjectMeta project={project} />
      </div>

      <footer className="hud-footer" />
    </div>
  );
}
