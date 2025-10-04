/**
 * Helper function to open KV with optional path/URL from environment
 * Supports both local file paths and remote Deno Deploy KV URLs
 */
export async function openKv(): Promise<Deno.Kv> {
  const kvPath = Deno.env.get("KV_PATH");

  // If KV_PATH is not set, use default local KV
  if (!kvPath) {
    return await Deno.openKv();
  }

  // If it's a URL (starts with http:// or https://), use it directly
  if (kvPath.startsWith("http://") || kvPath.startsWith("https://")) {
    return await Deno.openKv(kvPath);
  }

  // Otherwise treat it as a local file path
  return await Deno.openKv(kvPath);
}
