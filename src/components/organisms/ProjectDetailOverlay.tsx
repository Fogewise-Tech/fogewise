"use client";

import { useEffect } from "react";
import type { Project } from "@/types/project";
import { TechChip } from "@/components/atoms/TechChip";
import { useExperienceStore } from "@/store/useExperienceStore";

type Props = { projects: Project[] };

export function ProjectDetailOverlay({ projects }: Props) {
  const selectedProjectId = useExperienceStore((state) => state.selectedProjectId);
  const closeProject = useExperienceStore((state) => state.closeProject);
  const project = projects.find((item) => item.id === selectedProjectId) ?? null;

  useEffect(() => {
    if (!project) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeProject();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [project, closeProject]);

  if (!project) return null;

  return (
    <div className="detail-backdrop" onMouseDown={closeProject}>
      <article className="detail-card" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="detail-close" onClick={closeProject}>
          Close ×
        </button>

        <p className="detail-eyebrow">
          {project.category} · {project.year}
        </p>
        <h2>{project.name}</h2>
        <p className="detail-lead">{project.description}</p>

        {project.highlights?.length ? (
          <div className="detail-section">
            <div className="detail-section-title">Highlights</div>
            <ul>
              {project.highlights.map((highlight) => (
                <li key={highlight}>{highlight}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="tech-row">
          {project.technologies.map((technology) => (
            <TechChip key={technology} label={technology} />
          ))}
        </div>

        <div className="detail-actions">
          {project.websiteUrl ? <a href={project.websiteUrl} target="_blank" rel="noreferrer">Live project ↗</a> : null}
          {project.githubUrl ? <a href={project.githubUrl} target="_blank" rel="noreferrer">GitHub ↗</a> : null}
          {project.caseStudyUrl ? <a href={project.caseStudyUrl} target="_blank" rel="noreferrer">Case study ↗</a> : null}
        </div>
      </article>
    </div>
  );
}
