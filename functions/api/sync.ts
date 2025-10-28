import type { KVNamespace } from "@cloudflare/workers-types";

type Env = {
  CATALOG_DB: KVNamespace;
};

type CatalogProgram = Record<string, unknown>;

type CatalogMetadata = {
  exportedAt: string;
  programs: CatalogProgram[];
  programCount?: number;
  instructions?: string;
};

const STORAGE_KEY = "latest-catalog";

const jsonResponse = (data: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    console.error("⚠️ /api/sync received invalid JSON", error);
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { programs, exportedAt, ...rest } = (payload ?? {}) as Partial<CatalogMetadata> & Record<string, unknown>;

  if (!Array.isArray(programs)) {
    return jsonResponse({ error: "Invalid payload: programs must be an array" }, { status: 400 });
  }

  if (typeof exportedAt !== "string" || exportedAt.length === 0) {
    return jsonResponse({ error: "Invalid payload: exportedAt is required" }, { status: 400 });
  }

  const metadata: CatalogMetadata & Record<string, unknown> = {
    exportedAt,
    programs,
    ...(typeof rest.programCount === "number" ? { programCount: rest.programCount } : {}),
    ...(typeof rest.instructions === "string" ? { instructions: rest.instructions } : {}),
  };

  try {
    await env.CATALOG_DB.put(STORAGE_KEY, JSON.stringify({ ...rest, ...metadata }));
  } catch (error) {
    console.error("❌ Failed to store catalog metadata", error);
    return jsonResponse({ error: "Failed to persist metadata" }, { status: 500 });
  }

  return jsonResponse({ ok: true });
}

export async function onRequestGet({ env }: { env: Env }) {
  let stored: string | null = null;

  try {
    stored = await env.CATALOG_DB.get(STORAGE_KEY);
  } catch (error) {
    console.error("❌ Failed to read catalog metadata", error);
    return jsonResponse({ error: "Failed to read metadata" }, { status: 500 });
  }

  if (!stored) {
    return jsonResponse({ exportedAt: null, programs: [] });
  }

  try {
    return jsonResponse(JSON.parse(stored));
  } catch (error) {
    console.error("⚠️ Stored metadata is not valid JSON", error);
    return jsonResponse({ exportedAt: null, programs: [] }, { status: 502 });
  }
}
