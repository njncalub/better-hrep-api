import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { fetchHouseMembersDDL } from "../lib/api-client.ts";
import { mapCongressId } from "../lib/congress-mapper.ts";

const InfoResponseSchema = z.object({
  status: z.number(),
  success: z.boolean(),
  data: z.record(z.string(), z.array(z.string())),
});

const infoRoute = createRoute({
  method: "get",
  path: "/info/people",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: InfoResponseSchema,
        },
      },
      description: "Congress membership data organized by congress number",
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
  tags: ["Info"],
  summary: "Get congress membership information",
  description:
    "Returns a mapping of congress numbers to arrays of author IDs. This endpoint proxies /house-members/ddl-reference and transforms the data for easier consumption by indexing scripts.",
});

export const infoRouter = new OpenAPIHono();

infoRouter.openapi(infoRoute, async (c) => {
  try {
    // Fetch from HREP API (server-side, so authentication works)
    const response = await fetchHouseMembersDDL();

    if (!response.success || !response.data) {
      return c.json(
        { error: "Failed to fetch house members DDL reference" },
        500,
      );
    }

    // Transform data: congress number -> array of author IDs
    const congressMap: Record<string, string[]> = {};

    for (const member of response.data) {
      // Normalize congress IDs (103 -> 20, etc.)
      const normalizedCongresses = member.membership.map(mapCongressId);

      for (const congress of normalizedCongresses) {
        const congressKey = congress.toString();
        if (!congressMap[congressKey]) {
          congressMap[congressKey] = [];
        }
        congressMap[congressKey].push(member.author_id);
      }
    }

    // Sort keys numerically (8, 9, 10, ..., 20) and sort person IDs alphabetically within each congress
    const sortedCongressMap: Record<string, string[]> = {};
    const sortedKeys = Object.keys(congressMap).sort((a, b) =>
      parseInt(a) - parseInt(b)
    );

    for (const key of sortedKeys) {
      sortedCongressMap[key] = congressMap[key].sort();
    }

    return c.json(
      {
        status: 200,
        success: true,
        data: sortedCongressMap,
      },
      200,
    );
  } catch (error) {
    console.error("Error fetching info:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
