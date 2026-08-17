import { localProjects } from "@/data/projects";
import type { Project } from "@/types/project";

type DirectusAsset = string | { id: string } | null | undefined;

type DirectusProject = Omit<Project, "coverImage" | "model3d"> & {
  coverImage?: DirectusAsset;
  model3d?: DirectusAsset;
};

function normalizeAsset(asset: DirectusAsset, baseUrl: string) {
  if (!asset) return undefined;

  if (typeof asset === "string") {
    return asset.startsWith("http") || asset.startsWith("/")
      ? asset
      : `${baseUrl}/assets/${asset}`;
  }

  return `${baseUrl}/assets/${asset.id}`;
}

function normalizeDirectusProject(
  project: DirectusProject,
  baseUrl: string,
): Project {
  return {
    ...project,
    coverImage: normalizeAsset(project.coverImage, baseUrl),
    model3d: normalizeAsset(project.model3d, baseUrl),
  };
}

export async function getProjects(): Promise<Project[]> {
  const baseUrl = process.env.DIRECTUS_URL;

  if (!baseUrl) {
    return localProjects
      .filter((project) => project.published)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  try {
    const response = await fetch(
      `${baseUrl}/items/projects?filter[published][_eq]=true&sort=sortOrder`,
      { next: { revalidate: 60 } },
    );

    if (!response.ok) {
      throw new Error(`Directus request failed: ${response.status}`);
    }

    const payload = (await response.json()) as { data: DirectusProject[] };
    return payload.data.map((project) =>
      normalizeDirectusProject(project, baseUrl),
    );
  } catch (error) {
    console.error("Falling back to local project data:", error);
    return localProjects
      .filter((project) => project.published)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }
}
