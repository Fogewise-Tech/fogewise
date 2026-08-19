import type { Project } from "@/types/project";

type DirectusAsset = string | { id: string } | null | undefined;

type DirectusProject = Omit<Project, "coverImage" | "model3d"> & {
  coverImage?: DirectusAsset;
  model3d?: DirectusAsset;
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function extractDirectusAssetId(
  asset: DirectusAsset,
  baseUrl: string,
): string | undefined {
  if (!asset) return undefined;
  if (typeof asset === "object") return asset.id;

  const value = asset.trim();
  if (!value) return undefined;

  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    return value;
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const absolutePrefix = `${normalizedBaseUrl}/assets/`;

  if (value.startsWith(absolutePrefix)) {
    return value.slice(absolutePrefix.length).split(/[?#]/, 1)[0];
  }

  if (value.startsWith("/assets/")) {
    return value.slice("/assets/".length).split(/[?#]/, 1)[0];
  }

  return undefined;
}

function normalizeAsset(
  asset: DirectusAsset,
  baseUrl: string,
): string | undefined {
  if (!asset) return undefined;

  const assetId = extractDirectusAssetId(asset, baseUrl);

  if (assetId) {
    return `/api/assets/${encodeURIComponent(assetId)}`;
  }

  if (typeof asset === "string") {
    return asset;
  }

  return undefined;
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
  const rawBaseUrl = process.env.DIRECTUS_URL;

  if (!rawBaseUrl) {
    throw new Error("DIRECTUS_URL is not configured");
  }

  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const token = process.env.DIRECTUS_TOKEN;

  const response = await fetch(
    `${baseUrl}/items/projects?filter[published][_eq]=true&sort=sortOrder`,
    {
      cache: "no-store",
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : undefined,
    },
  );

  if (!response.ok) {
    throw new Error(
      `Directus request failed: ${response.status} ${response.statusText}`,
    );
  }

  const payload = (await response.json()) as {
    data: DirectusProject[];
  };

  return payload.data.map((project) =>
    normalizeDirectusProject(project, baseUrl),
  );
}
