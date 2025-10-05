import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { fetchHouseMembersDDL, fetchHouseMembers, fetchCommitteeList, fetchCoAuthoredBills, fetchBillsSearch } from "../lib/api-client.ts";
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

const indexCoAuthorsRoute = createRoute({
  method: "post",
  path: "/index/people/coauthors",
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
  summary: "Index co-authors data using /bills/search",
  description: "Fetches co-authored bills for each person across all their congresses using POST /bills/search. Supports chunking to avoid timeouts. Requires valid indexer key.",
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
      return c.json({ error: "Failed to fetch house members DDL reference" }, 500);
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

        const primaryKey = ["people", "byPersonId", member.author_id, "membership"];

        // Set the primary key
        atomic.set(primaryKey, normalizedMembership);

        // Set the secondary index by full name - stores the primary key
        atomic.set(
          ["people", "byPersonFullName", member.fullname, "membership"],
          primaryKey
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
            const coAuthorResponse = await fetchCoAuthoredBills(member.author_id);
            if (coAuthorResponse.success && coAuthorResponse.data?.rows) {
              coAuthoredDocuments = coAuthorResponse.data.rows.map((bill) => ({
                congress: mapCongressId(bill.congress),
                documentKey: bill.bill_no,
              }));
            }
          } catch (error) {
            console.error(`Failed to fetch co-authored bills for ${member.author_id}:`, error);
          }
          return { member, coAuthoredDocuments };
        })
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

        const primaryKey = ["people", "byPersonId", member.author_id, "information"];

        // Store to KV with key: ["people", "byPersonId", authorId, "information"]
        atomic.set(primaryKey, info);

        // If member has principal_authored_bills, create secondary index by name_code
        if (member.principal_authored_bills && member.principal_authored_bills.length > 0) {
          const nameCode = member.principal_authored_bills[0].name_code;
          if (nameCode) {
            // Create secondary index: ["people", "byNameCode", nameCode, "information"] -> primaryKey
            atomic.set(
              ["people", "byNameCode", nameCode, "information"],
              primaryKey
            );
          }
        }

        // Cache co-authored documents if available
        if (coAuthoredDocuments) {
          atomic.set(
            ["people", "byPersonId", member.author_id, "coAuthoredDocuments"],
            coAuthoredDocuments
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
          info
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

indexRouter.openapi(indexCoAuthorsRoute, async (c) => {
  try {
    const { key, personId, startIndex = 0, chunkSize = 10 } = c.req.valid("json");

    // Verify indexer key
    if (key !== INDEXER_KEY) {
      return c.json({ error: "Unauthorized - Invalid indexer key" }, 401);
    }

    const kv = await openKv();
    let indexed = 0;

    try {
      // If personId is specified, only process that person
      if (personId) {
        console.log(`Processing single person: ${personId}`);
        // Get person's congress memberships from cache
        const membershipEntry = await kv.get<number[]>(["people", "byPersonId", personId, "membership"]);

        if (!membershipEntry.value) {
          return c.json({ error: `Person ${personId} not found in cache` }, 404);
        }

        const congresses = membershipEntry.value;
        console.log(`  Congresses: ${congresses.join(", ")}`);

        // Accumulate all co-authored documents for person-centric cache
        const allCoAuthoredDocs: { congress: number; documentKey: string }[] = [];

        // Fetch co-authored bills for each congress
        for (const congress of congresses) {
          try {
            const apiCongressId = mapToApiId(congress);
            console.log(`  Fetching co-authored bills for congress ${congress} (API ID: ${apiCongressId})...`);
            const response = await fetchBillsSearch({
              page: 0,
              limit: 999,
              congress: apiCongressId,
              significance: "Both",
              field: "Author",
              numbers: "",
              author_id: personId,
              author_type: "coauthorship",
              committee_id: "",
              title: "",
            });

            if (response.success && response.data?.rows) {
              console.log(`    Found ${response.data.rows.length} co-authored bills`);
              // Cache each co-authored document (document-centric)
              const atomic = kv.atomic();
              for (const bill of response.data.rows) {
                atomic.set(
                  ["congresses", congress, bill.bill_no, "coAuthors", personId],
                  true,
                  { expireIn: 5 * 24 * 60 * 60 * 1000 } // 5 days TTL
                );
                indexed++;

                // Add to person's co-authored documents list
                allCoAuthoredDocs.push({
                  congress,
                  documentKey: bill.bill_no,
                });
              }
              await atomic.commit();
            } else {
              console.log(`    No co-authored bills found`);
            }
          } catch (error) {
            console.error(`Failed to fetch co-authored bills for ${personId} in congress ${congress}:`, error);
          }
        }

        // Cache the full co-authored documents array for person-centric access
        if (allCoAuthoredDocs.length > 0) {
          await kv.set(
            ["people", "byPersonId", personId, "coAuthoredDocuments"],
            allCoAuthoredDocs,
            { expireIn: 24 * 60 * 60 * 1000 } // 1 day TTL
          );
        }

        return c.json(
          {
            message: `Successfully indexed co-authors for person ${personId}`,
            indexed,
            peopleProcessed: 1,
            totalPeople: 1,
          },
          200
        );
      }

      // Otherwise, process a chunk of people
      const allPeopleResponse = await fetchHouseMembersDDL();

      if (!allPeopleResponse.success || !allPeopleResponse.data) {
        return c.json({ error: "Failed to fetch house members DDL reference" }, 500);
      }

      const allPeople = allPeopleResponse.data;
      const totalPeople = allPeople.length;
      const endIndex = Math.min(startIndex + chunkSize, totalPeople);
      const chunk = allPeople.slice(startIndex, endIndex);

      // Process each person in the chunk
      for (const member of chunk) {
        console.log(`  Processing ${member.author_id} (${member.fullname})...`);
        const congresses = member.membership.map(mapCongressId);
        console.log(`    Congresses: ${congresses.join(", ")}`);

        // Accumulate all co-authored documents for this person
        const allCoAuthoredDocs: { congress: number; documentKey: string }[] = [];

        // Fetch co-authored bills for each congress
        for (const congress of congresses) {
          try {
            const apiCongressId = mapToApiId(congress);
            console.log(`    Fetching co-authored bills for congress ${congress} (API ID: ${apiCongressId})...`);
            const response = await fetchBillsSearch({
              page: 0,
              limit: 999,
              congress: apiCongressId,
              significance: "Both",
              field: "Author",
              numbers: "",
              author_id: member.author_id,
              author_type: "coauthorship",
              committee_id: "",
              title: "",
            });

            if (response.success && response.data?.rows) {
              console.log(`      Found ${response.data.rows.length} co-authored bills`);
              // Cache each co-authored document (document-centric)
              const atomic = kv.atomic();
              for (const bill of response.data.rows) {
                atomic.set(
                  ["congresses", congress, bill.bill_no, "coAuthors", member.author_id],
                  true,
                  { expireIn: 5 * 24 * 60 * 60 * 1000 } // 5 days TTL
                );
                indexed++;

                // Add to person's co-authored documents list
                allCoAuthoredDocs.push({
                  congress,
                  documentKey: bill.bill_no,
                });
              }
              await atomic.commit();
            } else {
              console.log(`      No co-authored bills found`);
            }
          } catch (error) {
            console.error(`Failed to fetch co-authored bills for ${member.author_id} in congress ${congress}:`, error);
          }
        }

        // Cache the full co-authored documents array for person-centric access
        if (allCoAuthoredDocs.length > 0) {
          await kv.set(
            ["people", "byPersonId", member.author_id, "coAuthoredDocuments"],
            allCoAuthoredDocs,
            { expireIn: 24 * 60 * 60 * 1000 } // 1 day TTL
          );
        }
      }

      const nextStartIndex = endIndex < totalPeople ? endIndex : undefined;

      return c.json(
        {
          message: `Successfully indexed co-authors for ${chunk.length} people (${startIndex} to ${endIndex - 1} of ${totalPeople})`,
          indexed,
          peopleProcessed: chunk.length,
          totalPeople,
          nextStartIndex,
        },
        200
      );
    } catch (error) {
      console.error("Error in inner try block:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error indexing co-authors:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});
