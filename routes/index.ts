import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { fetchHouseMembersDDL, fetchHouseMembers, fetchCommitteeList } from "../lib/api-client.ts";
import { mapCongressId } from "../lib/congress-mapper.ts";

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

const indexPeopleMembershipRoute = createRoute({
  method: "post",
  path: "/index/people/membership",
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
            message: z.string(),
            indexed: z.number(),
          }),
        },
      },
      description: "Successfully indexed membership data",
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
  tags: ["Index"],
  summary: "Index people membership data to KV cache",
  description: "Fetches membership data from /house-members/ddl-reference and caches it to Deno KV. This improves performance for /people endpoints by avoiding full pagination. Requires valid indexer key.",
});

const indexPeopleInformationRoute = createRoute({
  method: "post",
  path: "/index/people/information",
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
            message: z.string(),
            indexed: z.number(),
          }),
        },
      },
      description: "Successfully indexed information data",
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
  tags: ["Index"],
  summary: "Index people information (names) to KV cache",
  description: "Fetches all house members from /house-members/list and caches their name information to Deno KV. This improves performance for /people endpoints by avoiding full pagination. Requires valid indexer key.",
});

const indexCommitteesInformationRoute = createRoute({
  method: "post",
  path: "/index/committees/information",
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
            message: z.string(),
            indexed: z.number(),
          }),
        },
      },
      description: "Successfully indexed committee information",
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
  tags: ["Index"],
  summary: "Index committees information to KV cache",
  description: "Fetches all committees from /committee/list and caches their information to Deno KV. Requires valid indexer key.",
});

export const indexRouter = new OpenAPIHono();

indexRouter.openapi(indexPeopleMembershipRoute, async (c) => {
  try {
    const { key } = c.req.valid("json");

    // Verify indexer key
    if (key !== INDEXER_KEY) {
      return c.json({ error: "Unauthorized - Invalid indexer key" }, 401);
    }

    const kv = await Deno.openKv();
    const response = await fetchHouseMembersDDL();

    if (!response.success || !response.data) {
      return c.json({ error: "Failed to fetch house members DDL reference" }, 500);
    }

    let indexed = 0;

    // Batch KV writes for better performance
    const batchSize = 100;
    for (let i = 0; i < response.data.length; i += batchSize) {
      const batch = response.data.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (member) => {
          // Normalize congress IDs (103 → 20)
          const normalizedMembership = member.membership.map(mapCongressId);

          // Store to KV with key: ["people", "byPersonId", authorId, "membership"]
          await kv.set(
            ["people", "byPersonId", member.author_id, "membership"],
            normalizedMembership
          );

          indexed++;
        })
      );
    }

    kv.close();

    return c.json(
      {
        message: `Successfully indexed membership data for ${indexed} people`,
        indexed,
      },
      200
    );
  } catch (error) {
    console.error("Error indexing membership data:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});

indexRouter.openapi(indexPeopleInformationRoute, async (c) => {
  try {
    const { key } = c.req.valid("json");

    // Verify indexer key
    if (key !== INDEXER_KEY) {
      return c.json({ error: "Unauthorized - Invalid indexer key" }, 401);
    }

    const kv = await Deno.openKv();
    let indexed = 0;
    let page = 0;
    const limit = 100;

    // Loop through all pages from POST /house-members/list
    while (true) {
      const response = await fetchHouseMembers(page, limit);

      if (!response.success || !response.data) {
        kv.close();
        return c.json({ error: "Failed to fetch house members" }, 500);
      }

      // Batch index members' information in parallel
      await Promise.all(
        response.data.rows.map(async (member) => {
          const info = {
            id: member.id,
            lastName: member.last_name,
            firstName: member.first_name,
            middleName: member.middle_name,
            suffix: member.suffix,
            nickName: member.nick_name,
          };

          // Store to KV with key: ["people", "byPersonId", authorId, "information"]
          await kv.set(
            ["people", "byPersonId", member.author_id, "information"],
            info
          );

          indexed++;
        })
      );

      // Check if we've processed all pages
      const totalPages = Math.ceil(response.data.count / limit);
      if (page >= totalPages - 1) {
        break;
      }

      page++;
    }

    kv.close();

    return c.json(
      {
        message: `Successfully indexed information data for ${indexed} people`,
        indexed,
      },
      200
    );
  } catch (error) {
    console.error("Error indexing information data:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});

indexRouter.openapi(indexCommitteesInformationRoute, async (c) => {
  try {
    const { key } = c.req.valid("json");

    // Verify indexer key
    if (key !== INDEXER_KEY) {
      return c.json({ error: "Unauthorized - Invalid indexer key" }, 401);
    }

    const kv = await Deno.openKv();
    let indexed = 0;
    let page = 0;
    const limit = 100;

    // Loop through all pages from POST /committee/list
    while (true) {
      const response = await fetchCommitteeList(page, limit);

      if (!response.success || !response.data) {
        kv.close();
        return c.json({ error: "Failed to fetch committees" }, 500);
      }

      // Batch writes for better performance
      const batchSize = 50;
      for (let i = 0; i < response.data.rows.length; i += batchSize) {
        const batch = response.data.rows.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (committee) => {
            // Skip committees without a code
            if (!committee.code) {
              console.warn("Skipping committee without code:", committee.name);
              return;
            }

            const info = {
              id: committee.id,
              code: committee.code.trim(),
              name: committee.name.trim(),
              phone: committee.phone?.trim() || null,
              jurisdiction: committee.jurisdiction?.trim() || null,
              location: committee.location?.trim() || null,
              type_desc: committee.type_desc.trim(),
            };

            // Store to KV with key: ["committees", "byCommitteeId", code, "information"]
            await kv.set(
              ["committees", "byCommitteeId", committee.code, "information"],
              info
            );

            indexed++;
          })
        );
      }

      // Check if we've processed all pages
      const totalPages = Math.ceil(response.data.count / limit);
      if (page >= totalPages - 1) {
        break;
      }

      page++;
    }

    kv.close();

    return c.json(
      {
        message: `Successfully indexed committee information for ${indexed} committees`,
        indexed,
      },
      200
    );
  } catch (error) {
    console.error("Error indexing committee information:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});
