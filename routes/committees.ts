import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  CommitteeInfoSchema,
  PaginatedCommitteesSchema,
} from "../types/api.ts";
import { openKv } from "../lib/kv.ts";

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
          example: "25",
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
  tags: ["Committees"],
  summary: "Get committee by ID",
  description: "Returns details for a specific committee from the cache.",
});

export const committeesRouter = new OpenAPIHono();

committeesRouter.openapi(committeeListRoute, async (c) => {
  const { page = "0", limit = "25" } = c.req.valid("query");
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  try {
    const kv = await openKv();

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
    }, 200);
  } catch (error) {
    console.error("Error fetching committees:", error);
    return c.json({ error: "Failed to fetch committees" }, 500);
  }
});

committeesRouter.openapi(committeeByIdRoute, async (c) => {
  const { committeeId } = c.req.valid("param");

  try {
    const kv = await openKv();

    const entry = await kv.get<{
      id: number;
      code: string;
      name: string;
      phone: string | null;
      jurisdiction: string | null;
      location: string | null;
      type_desc: string;
    }>(["committees", "byCommitteeId", committeeId, "information"]);

    if (!entry.value) {
      await kv.close();
      return c.json({ error: "Committee not found" }, 404);
    }

    const committee = entry.value;

    // Fetch all documents associated with this committee from cache
    // Cache key pattern: ["congresses", congress, documentKey, "committees", committeeId]
    const documents: Array<{ congress: number; documentKey: string }> = [];

    // List all entries under congresses prefix
    const congressEntries = kv.list({ prefix: ["congresses"] });

    for await (const congressEntry of congressEntries) {
      // Key format: ["congresses", congress, documentKey, "committees", committeeId]
      if (
        congressEntry.key.length === 5 &&
        congressEntry.key[3] === "committees" &&
        congressEntry.key[4] === committeeId &&
        congressEntry.value === true
      ) {
        const congress = congressEntry.key[1] as number;
        const documentKey = congressEntry.key[2] as string;
        documents.push({ congress, documentKey });
      }
    }

    await kv.close();

    // Sort documents by congress (descending) then by documentKey
    documents.sort((a, b) => {
      if (a.congress !== b.congress) {
        return b.congress - a.congress; // Descending by congress
      }
      return a.documentKey.localeCompare(b.documentKey);
    });

    return c.json({
      id: committee.id,
      committeeId: committee.code,
      name: committee.name,
      phone: committee.phone,
      jurisdiction: committee.jurisdiction,
      location: committee.location,
      type: committee.type_desc,
      documents,
    }, 200);
  } catch (error) {
    console.error("Error fetching committee:", error);
    return c.json({ error: "Failed to fetch committee" }, 500);
  }
});
