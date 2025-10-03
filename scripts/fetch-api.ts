import { fetchFromAPI } from "../lib/api-client.ts";

const args = Deno.args;
const path = args[0];
const method = (args[1] || "GET").toUpperCase();
const payload = args[2] ? JSON.parse(args[2]) : undefined;

if (!path) {
  console.error("Usage: deno task fetch <path> [method] [payload]");
  console.error("Example: deno task fetch /system-config/reference-congress");
  console.error("Example: deno task fetch /some-endpoint POST '{\"key\":\"value\"}'");
  Deno.exit(1);
}

console.log(`\n📡 ${method} ${path}\n`);

if (payload) {
  console.log("📤 Payload:", JSON.stringify(payload, null, 2), "\n");
}

try {
  const data = await fetchFromAPI(path, { method, body: payload });

  console.log("📥 Response:");
  console.log(JSON.stringify(data, null, 2));
  console.log();
} catch (error) {
  console.error("❌ Error:", error instanceof Error ? error.message : String(error));
  Deno.exit(1);
}
