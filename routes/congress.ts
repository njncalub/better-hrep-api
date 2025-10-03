import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { fetchCongressReference } from "../lib/api-client.ts";
import { mapCongressId } from "../lib/congress-mapper.ts";
import { CongressListSchema, type Congress } from "../types/api.ts";
import type { CongressReferenceItem } from "../types/source.ts";

const congressRoute = createRoute({
  method: "get",
  path: "/congress",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: CongressListSchema,
        },
      },
      description: "List of all congress sessions",
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
  tags: ["Congress"],
  summary: "Get all congress sessions",
  description: "Returns a cleaned list of all congress sessions from the HREP API",
});

/**
 * Transform source API data to cleaned API format
 */
function transformCongressItem(item: CongressReferenceItem): Congress | null {
  // Skip the "[All Congress]" item
  if (item.id === 0) {
    return null;
  }

  // Map the API's congress ID to the correct congress number
  // This handles cases like ID 103 -> 20th Congress
  const congressNumber = mapCongressId(item.id);

  return {
    id: congressNumber,
    name: item.value,
  };
}

export const congressRouter = new OpenAPIHono();

congressRouter.openapi(congressRoute, async (c) => {
  try {
    const response = await fetchCongressReference();

    if (!response.success || !response.data) {
      return c.json({ error: "Failed to fetch congress data" }, 500);
    }

    const congressList = response.data
      .map(transformCongressItem)
      .filter((item): item is Congress => item !== null)
      .sort((a, b) => b.id - a.id); // Sort descending by congress number

    return c.json(congressList, 200);
  } catch (error) {
    console.error("Error fetching congress data:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});
