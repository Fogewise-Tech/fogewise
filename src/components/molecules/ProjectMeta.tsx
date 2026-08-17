import type { Project } from "@/types/project";
import { TechChip } from "@/components/atoms/TechChip";

type Props = {
  project: Project;
};

export function ProjectMeta({ project }: Props) {
  return (
    <section className="project-meta">
      <p className="project-eyebrow">
        {project.category} · {project.year}
      </p>
      <h1 className="project-title">{project.name}</h1>
      <p className="project-kicker">{project.tagline}</p>
      <p className="project-description">{project.description}</p>

      <div className="tech-row">
        {project.technologies.map((technology) => (
          <TechChip key={technology} label={technology} />
        ))}
      </div>
    </section>
  );
}
