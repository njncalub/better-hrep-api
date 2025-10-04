import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { openKv } from "../lib/kv.ts";

const INDEXER_KEY = Deno.env.get("INDEXER_KEY")!;

if (!INDEXER_KEY) {
  throw new Error("INDEXER_KEY environment variable must be set");
}

const IndexRequestSchema = z.object({
  key: z.string().openapi({
    example: "your-indexer-key",
    description: "Indexer authentication key",
  }),
});

const cachedByFullNameRoute = createRoute({
  method: "post",
  path: "/cached/people/byFullName",
  request: {
    body: {
      content: {
        "application/json": {
          schema: IndexRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            count: z.number(),
            entries: z.array(z.object({
              fullName: z.string(),
              primaryKey: z.array(z.string()),
            })),
          }),
        },
      },
      description: "List of people cache entries indexed by full name",
    },
    401: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: "Unauthorized - Invalid indexer key",
    },
    500: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: "Internal server error",
    },
  },
  tags: ["Cached"],
  summary: "Get people cache by full name index",
  description: "Returns all people cache entries indexed by full name with their primary keys. Requires valid indexer key.",
  hide: true,
});

const cachedByNameCodeRoute = createRoute({
  method: "post",
  path: "/cached/people/byNameCode",
  request: {
    body: {
      content: {
        "application/json": {
          schema: IndexRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            count: z.number(),
            entries: z.array(z.object({
              nameCode: z.string(),
              primaryKey: z.array(z.string()),
            })),
          }),
        },
      },
      description: "List of people cache entries indexed by name code",
    },
    401: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: "Unauthorized - Invalid indexer key",
    },
    500: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: "Internal server error",
    },
  },
  tags: ["Cached"],
  summary: "Get people cache by name code index",
  description: "Returns all people cache entries indexed by name code with their primary keys. Requires valid indexer key.",
  hide: true,
});

export const cachedRouter = new OpenAPIHono();

cachedRouter.openapi(cachedByFullNameRoute, async (c) => {
  try {
    const { key } = c.req.valid("json");

    // Verify indexer key
    if (key !== INDEXER_KEY) {
      return c.json({ error: "Unauthorized - Invalid indexer key" }, 401);
    }

    const kv = await openKv();
    const entries: { fullName: string; primaryKey: string[] }[] = [];

    // List all entries with the prefix ["people", "byPersonFullName"]
    const iter = kv.list({ prefix: ["people", "byPersonFullName"] });

    for await (const entry of iter) {
      // Key format: ["people", "byPersonFullName", fullName, "membership"]
      if (entry.key.length === 4 && entry.key[3] === "membership") {
        entries.push({
          fullName: entry.key[2] as string,
          primaryKey: entry.value as string[],
        });
      }
    }

    await kv.close();

    return c.json({
      count: entries.length,
      entries,
    }, 200);
  } catch (error) {
    console.error("Error fetching cache by full name:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});

cachedRouter.openapi(cachedByNameCodeRoute, async (c) => {
  try {
    const { key } = c.req.valid("json");

    // Verify indexer key
    if (key !== INDEXER_KEY) {
      return c.json({ error: "Unauthorized - Invalid indexer key" }, 401);
    }

    const kv = await openKv();
    const entries: { nameCode: string; primaryKey: string[] }[] = [];

    // List all entries with the prefix ["people", "byNameCode"]
    const iter = kv.list({ prefix: ["people", "byNameCode"] });

    for await (const entry of iter) {
      // Key format: ["people", "byNameCode", nameCode, "information"]
      if (entry.key.length === 4 && entry.key[3] === "information") {
        entries.push({
          nameCode: entry.key[2] as string,
          primaryKey: entry.value as string[],
        });
      }
    }

    await kv.close();

    return c.json({
      count: entries.length,
      entries,
    }, 200);
  } catch (error) {
    console.error("Error fetching cache by name code:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});
