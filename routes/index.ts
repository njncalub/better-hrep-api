import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  fetchBillByDocumentKey,
  fetchBillsSearch,
  fetchCoAuthoredBills,
  fetchCommitteeList,
  fetchHouseMembers,
  fetchHouseMembersDDL,
} from "../lib/api-client.ts";
import { mapCongressId, mapToApiId } from "../lib/congress-mapper.ts";
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

const IndexCoAuthorsRequestSchema = z.object({
  key: z.string().openapi({
    example: "your-indexer-key",
    description: "Indexer authentication key",
  }),
  congress: z.number().openapi({
    example: 20,
    description: "Congress number to index (normalized ID, e.g., 8-20)",
  }),
  personId: z.string().optional().openapi({
    example: "E001",
    description: "Optional: Index only this specific person ID",
  }),
  startIndex: z.number().optional().openapi({
    example: 0,
    description: "Optional: Start from this person index (for chunking)",
  }),
  chunkSize: z.number().optional().openapi({
    example: 10,
    description: "Optional: Process this many people (default: 10)",
  }),
});

const IndexAuthorsRequestSchema = z.object({
  key: z.string().openapi({
    example: "your-indexer-key",
    description: "Indexer authentication key",
  }),
  congress: z.number().openapi({
    example: 20,
    description: "Congress number to index (normalized ID, e.g., 8-20)",
  }),
  personId: z.string().optional().openapi({
    example: "E001",
    description: "Optional: Index only this specific person ID",
  }),
  startIndex: z.number().optional().openapi({
    example: 0,
    description: "Optional: Start from this person index (for chunking)",
  }),
  chunkSize: z.number().optional().openapi({
    example: 10,
    description: "Optional: Process this many people (default: 10)",
  }),
});

const IndexCommitteesRequestSchema = z.object({
  key: z.string().openapi({
    example: "your-indexer-key",
    description: "Indexer authentication key",
  }),
  congress: z.number().openapi({
    example: 20,
    description: "Congress number to index (normalized ID, e.g., 8-20)",
  }),
  committeeId: z.string().openapi({
    example: "0543",
    description: "Committee ID to index",
  }),
});

const IndexDocumentsInformationRequestSchema = z.object({
  key: z.string().openapi({
    example: "your-indexer-key",
    description: "Indexer authentication key",
  }),
  congress: z.number().openapi({
    example: 20,
    description: "Congress number (normalized ID, e.g., 8-20)",
  }),
  documentKey: z.string().openapi({
    example: "HB00001",
    description: "Document key to index (e.g., HB00001)",
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
  description:
    "Fetches membership data from /house-members/ddl-reference and caches it to Deno KV. This improves performance for /people endpoints by avoiding full pagination. Requires valid indexer key.",
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
  description:
    "Fetches all house members from /house-members/list and caches their name information to Deno KV. This improves performance for /people endpoints by avoiding full pagination. Requires valid indexer key.",
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
  description:
    "Fetches all committees from /committee/list and caches their information to Deno KV. Requires valid indexer key.",
});

const indexCoAuthorsRoute = createRoute({
  method: "post",
  path: "/index/documents/coauthors",
  request: {
    body: {
      content: {
        "application/json": {
          schema: IndexCoAuthorsRequestSchema,
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
            peopleProcessed: z.number(),
            totalPeople: z.number(),
            nextStartIndex: z.number().optional(),
          }),
        },
      },
      description: "Successfully indexed co-authors data",
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
    404: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: "Person not found in cache",
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
  summary: "Index document co-authors data using /bills/search",
  description:
    "Fetches co-authored bills for a specific congress using POST /bills/search. Caches co-author relationships for each document. Supports processing specific person or chunking all people. Requires valid indexer key.",
});

const indexAuthorsRoute = createRoute({
  method: "post",
  path: "/index/documents/authors",
  request: {
    body: {
      content: {
        "application/json": {
          schema: IndexAuthorsRequestSchema,
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
            peopleProcessed: z.number(),
            totalPeople: z.number(),
            nextStartIndex: z.number().optional(),
          }),
        },
      },
      description: "Successfully indexed authors data",
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
    404: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: "Person not found in cache",
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
  summary: "Index document authors data using /bills/search",
  description:
    "Fetches authored bills for a specific congress using POST /bills/search. Caches primary author relationships for each document. Supports processing specific person or chunking all people. Requires valid indexer key.",
});

const indexCommitteesRoute = createRoute({
  method: "post",
  path: "/index/documents/committees",
  request: {
    body: {
      content: {
        "application/json": {
          schema: IndexCommitteesRequestSchema,
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
      description: "Successfully indexed committee documents data",
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
  summary: "Index committee documents data using /bills/search",
  description:
    "Fetches bills for a specific committee and congress using POST /bills/search with field='Committees'. Caches committee-document relationships. Requires valid indexer key.",
});

const indexDocumentsInformationRoute = createRoute({
  method: "post",
  path: "/index/documents/information",
  request: {
    body: {
      content: {
        "application/json": {
          schema: IndexDocumentsInformationRequestSchema,
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
      description: "Successfully indexed document information",
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
    404: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: "Document not found",
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
  summary: "Index document information (title, dateFiled) to KV cache",
  description:
    "Fetches bill information for a specific document and congress, then caches title and dateFiled to Deno KV. This enables displaying document titles on person pages without fetching full document details. Requires valid indexer key.",
});

export const indexRouter = new OpenAPIHono();

indexRouter.openapi(indexPeopleMembershipRoute, async (c) => {
  try {
    const { key } = c.req.valid("json");

    // Verify indexer key
    if (key !== INDEXER_KEY) {
      return c.json({ error: "Unauthorized - Invalid indexer key" }, 401);
    }

    const kv = await openKv();
    const response = await fetchHouseMembersDDL();

    if (!response.success || !response.data) {
      return c.json(
        { error: "Failed to fetch house members DDL reference" },
        500,
      );
    }

    let indexed = 0;

    // Batch KV writes for better performance
    const batchSize = 100;
    for (let i = 0; i < response.data.length; i += batchSize) {
      const batch = response.data.slice(i, i + batchSize);

      // Use atomic operation to batch all writes for this batch
      const atomic = kv.atomic();

      for (const member of batch) {
        // Normalize congress IDs (103 → 20)
        const normalizedMembership = member.membership.map(mapCongressId);

        const primaryKey = [
          "people",
          "byPersonId",
          member.author_id,
          "membership",
        ];

        // Set the primary key
        atomic.set(primaryKey, normalizedMembership);

        // Set the secondary index by full name - stores the primary key
        atomic.set(
          ["people", "byPersonFullName", member.fullname, "membership"],
          primaryKey,
        );

        indexed++;
      }

      // Commit all writes in a single operation
      await atomic.commit();
    }

    kv.close();

    return c.json(
      {
        message: `Successfully indexed membership data for ${indexed} people`,
        indexed,
      },
      200,
    );
  } catch (error) {
    console.error("Error indexing membership data:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
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

    const kv = await openKv();
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

      // Fetch co-authored bills first (needs API calls, can't be in atomic)
      const membersWithCoAuthored = await Promise.all(
        response.data.rows.map(async (member) => {
          let coAuthoredDocuments = null;
          try {
            const coAuthorResponse = await fetchCoAuthoredBills(
              member.author_id,
            );
            if (coAuthorResponse.success && coAuthorResponse.data?.rows) {
              coAuthoredDocuments = coAuthorResponse.data.rows.map((bill) => ({
                congress: mapCongressId(bill.congress),
                documentKey: bill.bill_no,
              }));
            }
          } catch (error) {
            console.error(
              `Failed to fetch co-authored bills for ${member.author_id}:`,
              error,
            );
          }
          return { member, coAuthoredDocuments };
        }),
      );

      // Use atomic operation to batch all KV writes
      const atomic = kv.atomic();

      for (const { member, coAuthoredDocuments } of membersWithCoAuthored) {
        const info = {
          id: member.id,
          lastName: member.last_name,
          firstName: member.first_name,
          middleName: member.middle_name,
          suffix: member.suffix,
          nickName: member.nick_name,
        };

        const primaryKey = [
          "people",
          "byPersonId",
          member.author_id,
          "information",
        ];

        // Store to KV with key: ["people", "byPersonId", authorId, "information"]
        atomic.set(primaryKey, info);

        // If member has principal_authored_bills, create secondary index by name_code
        if (
          member.principal_authored_bills &&
          member.principal_authored_bills.length > 0
        ) {
          const nameCode = member.principal_authored_bills[0].name_code;
          if (nameCode) {
            // Create secondary index: ["people", "byNameCode", nameCode, "information"] -> primaryKey
            atomic.set(
              ["people", "byNameCode", nameCode, "information"],
              primaryKey,
            );
          }
        }

        // Cache co-authored documents if available
        if (coAuthoredDocuments) {
          atomic.set(
            ["people", "byPersonId", member.author_id, "coAuthoredDocuments"],
            coAuthoredDocuments,
          );
        }

        indexed++;
      }

      // Commit all writes in a single operation
      await atomic.commit();

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
      200,
    );
  } catch (error) {
    console.error("Error indexing information data:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
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

    const kv = await openKv();
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

      // Use atomic operation to batch all KV writes
      const atomic = kv.atomic();

      for (const committee of response.data.rows) {
        // Skip committees without a code
        if (!committee.code) {
          console.warn("Skipping committee without code:", committee.name);
          continue;
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
        atomic.set(
          ["committees", "byCommitteeId", committee.code, "information"],
          info,
        );

        indexed++;
      }

      // Commit all writes in a single operation
      await atomic.commit();

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
        message:
          `Successfully indexed committee information for ${indexed} committees`,
        indexed,
      },
      200,
    );
  } catch (error) {
    console.error("Error indexing committee information:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});

indexRouter.openapi(indexCoAuthorsRoute, async (c) => {
  try {
    const { key, congress, personId, startIndex = 0, chunkSize = 10 } = c.req
      .valid("json");

    // Verify indexer key
    if (key !== INDEXER_KEY) {
      return c.json({ error: "Unauthorized - Invalid indexer key" }, 401);
    }

    const kv = await openKv();
    let indexed = 0;

    try {
      // If personId is specified, only process that person
      if (personId) {
        console.log(
          `Processing single person: ${personId} for congress ${congress}`,
        );

        const apiCongressId = mapToApiId(congress);
        console.log(
          `  Fetching co-authored bills for congress ${congress} (API ID: ${apiCongressId})...`,
        );

        // Paginate through all results with limit 50
        let page = 0;
        let totalBills = 0;
        const limit = 50;
        const seenBills = new Set<string>();
        const newDocuments: Array<{ congress: number; documentKey: string }> =
          [];

        while (true) {
          const response = await fetchBillsSearch({
            page,
            limit,
            congress: apiCongressId,
            significance: "Both",
            field: "Author",
            numbers: "",
            author_id: personId,
            author_type: "coauthorship",
            committee_id: "",
            title: "",
          });

          if (
            !response.success || !response.data?.rows ||
            response.data.rows.length === 0
          ) {
            break;
          }

          // Check if we've seen all bills in this page (pagination loop detection)
          const newBillsCount = response.data.rows.filter((bill) =>
            !seenBills.has(bill.bill_no)
          ).length;
          if (newBillsCount === 0) {
            console.log(
              `    Page ${page}: All bills already seen, stopping pagination`,
            );
            break;
          }

          console.log(
            `    Page ${page}: Found ${newBillsCount} new co-authored bills (${response.data.rows.length} total in response)`,
          );

          // Cache each co-authored document (document-centric)
          const atomic = kv.atomic();
          for (const bill of response.data.rows) {
            if (!seenBills.has(bill.bill_no)) {
              atomic.set(
                ["congresses", congress, bill.bill_no, "coAuthors", personId],
                true,
              );
              indexed++;
              totalBills++;
              seenBills.add(bill.bill_no);
              newDocuments.push({ congress, documentKey: bill.bill_no });
            }
          }
          await atomic.commit();

          page++;
        }

        console.log(`    Total: ${totalBills} co-authored bills indexed`);

        // Write person-centric cache
        const existingEntry = await kv.get<
          Array<{ congress: number; documentKey: string }>
        >(
          ["people", "byPersonId", personId, "coAuthoredDocuments"],
        );
        const existingDocs = existingEntry.value || [];
        const filteredDocs = existingDocs.filter((doc) =>
          doc.congress !== congress
        );
        const mergedDocs = [...filteredDocs, ...newDocuments];

        await kv.set(
          ["people", "byPersonId", personId, "coAuthoredDocuments"],
          mergedDocs,
        );
        console.log(
          `    Updated person-centric cache: ${mergedDocs.length} total co-authored documents`,
        );

        return c.json(
          {
            message:
              `Successfully indexed co-authors for person ${personId} in congress ${congress}`,
            indexed,
            peopleProcessed: 1,
            totalPeople: 1,
          },
          200,
        );
      }

      // Otherwise, process a chunk of people
      const allPeopleResponse = await fetchHouseMembersDDL();

      if (!allPeopleResponse.success || !allPeopleResponse.data) {
        return c.json(
          { error: "Failed to fetch house members DDL reference" },
          500,
        );
      }

      // Filter to only people who are members of the specified congress
      const filteredPeople = allPeopleResponse.data.filter((person) =>
        person.membership.map(mapCongressId).includes(congress)
      );

      const totalPeople = filteredPeople.length;
      const endIndex = Math.min(startIndex + chunkSize, totalPeople);
      const chunk = filteredPeople.slice(startIndex, endIndex);

      console.log(
        `Processing congress ${congress}: ${chunk.length} people (${startIndex} to ${
          endIndex - 1
        } of ${totalPeople})`,
      );

      // Process each person in the chunk
      for (const member of chunk) {
        console.log(`  Processing ${member.author_id} (${member.fullname})...`);

        const apiCongressId = mapToApiId(congress);
        console.log(
          `    Fetching co-authored bills for congress ${congress} (API ID: ${apiCongressId})...`,
        );

        // Paginate through all results with limit 50
        let page = 0;
        let totalBills = 0;
        const limit = 50;
        const seenBills = new Set<string>();
        const newDocuments: Array<{ congress: number; documentKey: string }> =
          [];

        while (true) {
          const response = await fetchBillsSearch({
            page,
            limit,
            congress: apiCongressId,
            significance: "Both",
            field: "Author",
            numbers: "",
            author_id: member.author_id,
            author_type: "coauthorship",
            committee_id: "",
            title: "",
          });

          if (
            !response.success || !response.data?.rows ||
            response.data.rows.length === 0
          ) {
            break;
          }

          // Check if we've seen all bills in this page (pagination loop detection)
          const newBillsCount = response.data.rows.filter((bill) =>
            !seenBills.has(bill.bill_no)
          ).length;
          if (newBillsCount === 0) {
            console.log(
              `      Page ${page}: All bills already seen, stopping pagination`,
            );
            break;
          }

          console.log(
            `      Page ${page}: Found ${newBillsCount} new co-authored bills (${response.data.rows.length} total in response)`,
          );

          // Cache each co-authored document (document-centric)
          const atomic = kv.atomic();
          for (const bill of response.data.rows) {
            if (!seenBills.has(bill.bill_no)) {
              atomic.set(
                [
                  "congresses",
                  congress,
                  bill.bill_no,
                  "coAuthors",
                  member.author_id,
                ],
                true,
              );
              indexed++;
              totalBills++;
              seenBills.add(bill.bill_no);
              newDocuments.push({ congress, documentKey: bill.bill_no });
            }
          }
          await atomic.commit();

          page++;
        }

        console.log(`      Total: ${totalBills} co-authored bills indexed`);

        // Write person-centric cache
        const existingEntry = await kv.get<
          Array<{ congress: number; documentKey: string }>
        >(
          ["people", "byPersonId", member.author_id, "coAuthoredDocuments"],
        );
        const existingDocs = existingEntry.value || [];
        const filteredDocs = existingDocs.filter((doc) =>
          doc.congress !== congress
        );
        const mergedDocs = [...filteredDocs, ...newDocuments];

        await kv.set(
          ["people", "byPersonId", member.author_id, "coAuthoredDocuments"],
          mergedDocs,
        );
        console.log(
          `      Updated person-centric cache: ${mergedDocs.length} total co-authored documents`,
        );
      }

      const nextStartIndex = endIndex < totalPeople ? endIndex : undefined;

      return c.json(
        {
          message:
            `Successfully indexed co-authors for ${chunk.length} people in congress ${congress} (${startIndex} to ${
              endIndex - 1
            } of ${totalPeople})`,
          indexed,
          peopleProcessed: chunk.length,
          totalPeople,
          nextStartIndex,
        },
        200,
      );
    } catch (error) {
      console.error("Error in inner try block:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error indexing co-authors:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});

indexRouter.openapi(indexAuthorsRoute, async (c) => {
  try {
    const { key, congress, personId, startIndex = 0, chunkSize = 10 } = c.req
      .valid("json");

    // Verify indexer key
    if (key !== INDEXER_KEY) {
      return c.json({ error: "Unauthorized - Invalid indexer key" }, 401);
    }

    const kv = await openKv();
    let indexed = 0;

    try {
      // If personId is specified, only process that person
      if (personId) {
        console.log(
          `Processing single person: ${personId} for congress ${congress}`,
        );

        const apiCongressId = mapToApiId(congress);
        console.log(
          `  Fetching authored bills for congress ${congress} (API ID: ${apiCongressId})...`,
        );

        // Paginate through all results with limit 50
        let page = 0;
        let totalBills = 0;
        const limit = 50;
        const seenBills = new Set<string>();
        const newDocuments: Array<{ congress: number; documentKey: string }> =
          [];

        while (true) {
          const response = await fetchBillsSearch({
            page,
            limit,
            congress: apiCongressId,
            significance: "Both",
            field: "Author",
            numbers: "",
            author_id: personId,
            author_type: "authorship",
            committee_id: "",
            title: "",
          });

          if (
            !response.success || !response.data?.rows ||
            response.data.rows.length === 0
          ) {
            break;
          }

          // Check if we've seen all bills in this page (pagination loop detection)
          const newBillsCount = response.data.rows.filter((bill) =>
            !seenBills.has(bill.bill_no)
          ).length;
          if (newBillsCount === 0) {
            console.log(
              `    Page ${page}: All bills already seen, stopping pagination`,
            );
            break;
          }

          console.log(
            `    Page ${page}: Found ${newBillsCount} new authored bills (${response.data.rows.length} total in response)`,
          );

          // Cache each authored document (document-centric)
          const atomic = kv.atomic();
          for (const bill of response.data.rows) {
            if (!seenBills.has(bill.bill_no)) {
              atomic.set(
                ["congresses", congress, bill.bill_no, "authors", personId],
                true,
              );
              indexed++;
              totalBills++;
              seenBills.add(bill.bill_no);
              newDocuments.push({ congress, documentKey: bill.bill_no });
            }
          }
          await atomic.commit();

          page++;
        }

        console.log(`    Total: ${totalBills} authored bills indexed`);

        // Write person-centric cache
        const existingEntry = await kv.get<
          Array<{ congress: number; documentKey: string }>
        >(
          ["people", "byPersonId", personId, "authoredDocuments"],
        );
        const existingDocs = existingEntry.value || [];
        const filteredDocs = existingDocs.filter((doc) =>
          doc.congress !== congress
        );
        const mergedDocs = [...filteredDocs, ...newDocuments];

        await kv.set(
          ["people", "byPersonId", personId, "authoredDocuments"],
          mergedDocs,
        );
        console.log(
          `    Updated person-centric cache: ${mergedDocs.length} total authored documents`,
        );

        return c.json(
          {
            message:
              `Successfully indexed authors for person ${personId} in congress ${congress}`,
            indexed,
            peopleProcessed: 1,
            totalPeople: 1,
          },
          200,
        );
      }

      // Otherwise, process a chunk of people
      const allPeopleResponse = await fetchHouseMembersDDL();

      if (!allPeopleResponse.success || !allPeopleResponse.data) {
        return c.json(
          { error: "Failed to fetch house members DDL reference" },
          500,
        );
      }

      // Filter to only people who are members of the specified congress
      const filteredPeople = allPeopleResponse.data.filter((person) =>
        person.membership.map(mapCongressId).includes(congress)
      );

      const totalPeople = filteredPeople.length;
      const endIndex = Math.min(startIndex + chunkSize, totalPeople);
      const chunk = filteredPeople.slice(startIndex, endIndex);

      console.log(
        `Processing congress ${congress}: ${chunk.length} people (${startIndex} to ${
          endIndex - 1
        } of ${totalPeople})`,
      );

      // Process each person in the chunk
      for (const member of chunk) {
        console.log(`  Processing ${member.author_id} (${member.fullname})...`);

        const apiCongressId = mapToApiId(congress);
        console.log(
          `    Fetching authored bills for congress ${congress} (API ID: ${apiCongressId})...`,
        );

        // Paginate through all results with limit 50
        let page = 0;
        let totalBills = 0;
        const limit = 50;
        const seenBills = new Set<string>();
        const newDocuments: Array<{ congress: number; documentKey: string }> =
          [];

        while (true) {
          const response = await fetchBillsSearch({
            page,
            limit,
            congress: apiCongressId,
            significance: "Both",
            field: "Author",
            numbers: "",
            author_id: member.author_id,
            author_type: "authorship",
            committee_id: "",
            title: "",
          });

          if (
            !response.success || !response.data?.rows ||
            response.data.rows.length === 0
          ) {
            break;
          }

          // Check if we've seen all bills in this page (pagination loop detection)
          const newBillsCount = response.data.rows.filter((bill) =>
            !seenBills.has(bill.bill_no)
          ).length;
          if (newBillsCount === 0) {
            console.log(
              `      Page ${page}: All bills already seen, stopping pagination`,
            );
            break;
          }

          console.log(
            `      Page ${page}: Found ${newBillsCount} new authored bills (${response.data.rows.length} total in response)`,
          );

          // Cache each authored document (document-centric)
          const atomic = kv.atomic();
          for (const bill of response.data.rows) {
            if (!seenBills.has(bill.bill_no)) {
              atomic.set(
                [
                  "congresses",
                  congress,
                  bill.bill_no,
                  "authors",
                  member.author_id,
                ],
                true,
              );
              indexed++;
              totalBills++;
              seenBills.add(bill.bill_no);
              newDocuments.push({ congress, documentKey: bill.bill_no });
            }
          }
          await atomic.commit();

          page++;
        }

        console.log(`      Total: ${totalBills} authored bills indexed`);

        // Write person-centric cache
        const existingEntry = await kv.get<
          Array<{ congress: number; documentKey: string }>
        >(
          ["people", "byPersonId", member.author_id, "authoredDocuments"],
        );
        const existingDocs = existingEntry.value || [];
        const filteredDocs = existingDocs.filter((doc) =>
          doc.congress !== congress
        );
        const mergedDocs = [...filteredDocs, ...newDocuments];

        await kv.set(
          ["people", "byPersonId", member.author_id, "authoredDocuments"],
          mergedDocs,
        );
        console.log(
          `      Updated person-centric cache: ${mergedDocs.length} total authored documents`,
        );
      }

      const nextStartIndex = endIndex < totalPeople ? endIndex : undefined;

      return c.json(
        {
          message:
            `Successfully indexed authors for ${chunk.length} people in congress ${congress} (${startIndex} to ${
              endIndex - 1
            } of ${totalPeople})`,
          indexed,
          peopleProcessed: chunk.length,
          totalPeople,
          nextStartIndex,
        },
        200,
      );
    } catch (error) {
      console.error("Error in inner try block:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error indexing authors:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});

indexRouter.openapi(indexCommitteesRoute, async (c) => {
  try {
    const { key, congress, committeeId } = c.req.valid("json");

    // Verify indexer key
    if (key !== INDEXER_KEY) {
      return c.json({ error: "Unauthorized - Invalid indexer key" }, 401);
    }

    const kv = await openKv();
    let indexed = 0;

    try {
      console.log(
        `Processing committee: ${committeeId} for congress ${congress}`,
      );

      const apiCongressId = mapToApiId(congress);
      console.log(
        `  Fetching bills for congress ${congress} (API ID: ${apiCongressId})...`,
      );

      // Paginate through all results with limit 50
      let page = 0;
      let totalBills = 0;
      const limit = 50;
      const seenBills = new Set<string>();

      while (true) {
        const response = await fetchBillsSearch({
          page,
          limit,
          congress: apiCongressId,
          significance: "Both",
          field: "Committees",
          numbers: "",
          author_id: "",
          author_type: "Both",
          committee_id: committeeId,
          title: "",
        });

        if (
          !response.success || !response.data?.rows ||
          response.data.rows.length === 0
        ) {
          break;
        }

        // Check if we've seen all bills in this page (pagination loop detection)
        const newBillsCount = response.data.rows.filter((bill) =>
          !seenBills.has(bill.bill_no)
        ).length;
        if (newBillsCount === 0) {
          console.log(
            `    Page ${page}: All bills already seen, stopping pagination`,
          );
          break;
        }

        console.log(
          `    Page ${page}: Found ${newBillsCount} new bills for committee (${response.data.rows.length} total in response)`,
        );

        // Cache each committee-document relationship (document-centric)
        const atomic = kv.atomic();
        for (const bill of response.data.rows) {
          if (!seenBills.has(bill.bill_no)) {
            atomic.set(
              ["congresses", congress, bill.bill_no, "committees", committeeId],
              true,
            );
            indexed++;
            totalBills++;
            seenBills.add(bill.bill_no);
          }
        }
        await atomic.commit();

        page++;
      }

      console.log(
        `    Total: ${totalBills} bills indexed for committee ${committeeId}`,
      );

      kv.close();

      return c.json(
        {
          message:
            `Successfully indexed committee ${committeeId} in congress ${congress}`,
          indexed,
        },
        200,
      );
    } catch (error) {
      kv.close();
      console.error("Error in inner try block:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error indexing committees:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});

indexRouter.openapi(indexDocumentsInformationRoute, async (c) => {
  try {
    const { key, congress, documentKey } = c.req.valid("json");

    // Verify indexer key
    if (key !== INDEXER_KEY) {
      return c.json({ error: "Unauthorized - Invalid indexer key" }, 401);
    }

    const kv = await openKv();
    console.log(
      `Indexing document information: ${documentKey} for congress ${congress}`,
    );

    // Convert congress number to API ID (20 → 103)
    const apiCongressId = mapToApiId(congress);

    // Fetch document data from source API
    const response = await fetchBillByDocumentKey(apiCongressId, documentKey);

    if (!response.success || !response.data) {
      await kv.close();
      return c.json({ error: "Failed to fetch bill from source API" }, 500);
    }

    // Check if we got any results
    if (response.data.rows.length === 0) {
      await kv.close();
      return c.json({ error: "Document not found" }, 404);
    }

    const bill = response.data.rows[0];

    // Cache document information: title and dateFiled
    await kv.set(["congresses", congress, documentKey, "information"], {
      titleFull: bill.title_full,
      titleShort: bill.title_short,
      dateFiled: bill.date_filed,
    });

    await kv.close();

    console.log(
      `  ✓ Indexed document information for ${documentKey} in congress ${congress}`,
    );

    return c.json(
      {
        message:
          `Successfully indexed document information for ${documentKey} in congress ${congress}`,
        indexed: 1,
      },
      200,
    );
  } catch (error) {
    console.error("Error indexing document information:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
