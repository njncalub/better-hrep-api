import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  CommitteeInfoSchema,
  PaginatedCommitteesSchema,
} from "../types/api.ts";

const committeeListRoute = createRoute({
  method: "get",
  path: "/committees",
  request: {
    query: z.object({
      page: z
        .string()
        .optional()
        .openapi({
          param: {
            name: "page",
            in: "query",
          },
          example: "0",
          description: "Page number (0-indexed)",
        }),
      limit: z
        .string()
        .optional()
        .openapi({
          param: {
            name: "limit",
            in: "query",
          },
          example: "100",
          description: "Number of items per page",
        }),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: PaginatedCommitteesSchema,
        },
      },
      description: "List of committees",
    },
  },
  tags: ["Committees"],
  summary: "Get all committees",
  description: "Returns a paginated list of all committees from the cache.",
});

const committeeByIdRoute = createRoute({
  method: "get",
  path: "/committees/{committeeId}",
  request: {
    params: z.object({
      committeeId: z.string().openapi({
        param: {
          name: "committeeId",
          in: "path",
        },
        example: "0543",
        description: "Committee code/ID",
      }),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: CommitteeInfoSchema,
        },
      },
      description: "Committee details",
    },
    404: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: "Committee not found",
    },
  },
  tags: ["Committees"],
  summary: "Get committee by ID",
  description: "Returns details for a specific committee from the cache.",
});

export const committeesRouter = new OpenAPIHono();

committeesRouter.openapi(committeeListRoute, async (c) => {
  const { page = "0", limit = "100" } = c.req.valid("query");
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  try {
    const kv = await Deno.openKv();

    // Get all committee keys from KV
    const entries = kv.list<{
      id: number;
      code: string;
      name: string;
      phone: string | null;
      jurisdiction: string | null;
      location: string | null;
      type_desc: string;
    }>({ prefix: ["committees", "byCommitteeId"] });

    const committees = [];
    for await (const entry of entries) {
      // Only get "information" entries
      if (entry.key[3] === "information") {
        committees.push(entry.value);
      }
    }

    kv.close();

    // Sort by name
    committees.sort((a, b) => a.name.localeCompare(b.name));

    // Calculate pagination
    const total = committees.length;
    const totalPages = Math.ceil(total / limitNum);
    const start = pageNum * limitNum;
    const end = start + limitNum;
    const paginatedCommittees = committees.slice(start, end);

    // Transform to API schema
    const data = paginatedCommittees.map((committee) => ({
      id: committee.id,
      committeeId: committee.code,
      name: committee.name,
      phone: committee.phone,
      jurisdiction: committee.jurisdiction,
      location: committee.location,
      type: committee.type_desc,
    }));

    return c.json({
      page: pageNum,
      limit: limitNum,
      total,
      totalPages,
      data,
    });
  } catch (error) {
    console.error("Error fetching committees:", error);
    return c.json({ error: "Failed to fetch committees" }, 500);
  }
});

committeesRouter.openapi(committeeByIdRoute, async (c) => {
  const { committeeId } = c.req.valid("param");

  try {
    const kv = await Deno.openKv();

    const entry = await kv.get<{
      id: number;
      code: string;
      name: string;
      phone: string | null;
      jurisdiction: string | null;
      location: string | null;
      type_desc: string;
    }>(["committees", "byCommitteeId", committeeId, "information"]);

    kv.close();

    if (!entry.value) {
      return c.json({ error: "Committee not found" }, 404);
    }

    const committee = entry.value;

    return c.json({
      id: committee.id,
      committeeId: committee.code,
      name: committee.name,
      phone: committee.phone,
      jurisdiction: committee.jurisdiction,
      location: committee.location,
      type: committee.type_desc,
    });
  } catch (error) {
    console.error("Error fetching committee:", error);
    return c.json({ error: "Failed to fetch committee" }, 500);
  }
});
