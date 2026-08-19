function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

export async function GET(_request: Request, context: any) {
  const rawBaseUrl = process.env.DIRECTUS_URL;

  if (!rawBaseUrl) {
    return new Response("DIRECTUS_URL is not configured", { status: 500 });
  }

  const params = await context.params;
  const id = String(params?.id ?? "").trim();

  if (!id) {
    return new Response("Missing asset id", { status: 400 });
  }

  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const token = process.env.DIRECTUS_TOKEN;

  const response = await fetch(
    `${baseUrl}/assets/${encodeURIComponent(id)}`,
    {
      cache: "no-store",
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : undefined,
    },
  );

  if (!response.ok || !response.body) {
    const message = `Directus asset request failed: ${response.status} ${response.statusText}`;
    console.error(message, { id });
    return new Response(message, { status: response.status || 502 });
  }

  const headers = new Headers();

  for (const name of [
    "content-type",
    "content-length",
    "content-disposition",
    "etag",
    "last-modified",
  ]) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }

  // During CMS editing we prefer correctness over stale browser caches.
  headers.set("Cache-Control", "private, no-store");

  return new Response(response.body, {
    status: 200,
    headers,
  });
}
