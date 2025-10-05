import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  fetchHouseMembers,
  fetchCommitteeMembership,
  fetchBillsSearch,
  fetchCongressReference,
} from "../lib/api-client.ts";
import { mapCongressId, mapToApiId } from "../lib/congress-mapper.ts";
import { openKv } from "../lib/kv.ts";
import { PaginatedPeopleSchema, PersonSchema, type Person, type Document, type Committee } from "../types/api.ts";
import type { HouseMemberItem } from "../types/source.ts";

const QuerySchema = z.object({
  page: z.string().optional().openapi({
    param: {
      name: "page",
      in: "query",
    },
    example: "0",
    description: "Page number (0-indexed)",
  }),
  limit: z.string().optional().openapi({
    param: {
      name: "limit",
      in: "query",
    },
    example: "25",
    description: "Number of items per page",
  }),
});

const ParamsSchema = z.object({
  personId: z.string().openapi({
    param: {
      name: "personId",
      in: "path",
    },
    example: "E001",
    description: "Unique person identifier",
  }),
});

const peopleRoute = createRoute({
  method: "get",
  path: "/people",
  request: {
    query: QuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: PaginatedPeopleSchema,
        },
      },
      description: "Paginated list of people",
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
  tags: ["People"],
  summary: "Get all house members",
  description: "Returns a paginated list of house members with their principal authored bills",
});

const personByIdRoute = createRoute({
  method: "get",
  path: "/people/{personId}",
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: PersonSchema,
        },
      },
      description: "Person details",
    },
    404: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: "Person not found",
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
  tags: ["People"],
  summary: "Get a specific person by ID",
  description: "Returns details for a specific house member by their person ID. Uses cached data when available for fast responses.",
});

/**
 * Transform source API data to cleaned API format
 * Reads from cache populated by indexing endpoints
 */
async function transformHouseMember(member: HouseMemberItem, latestCongress: number, kv: Deno.Kv): Promise<Person> {
  try {
    // Get all data from cache (populated by indexing endpoints)
    const [membershipEntry, authoredEntry, coAuthoredEntry, committeesEntry] = await Promise.all([
      kv.get<number[]>(["people", "byPersonId", member.author_id, "membership"]),
      kv.get<Document[]>(["people", "byPersonId", member.author_id, "authoredDocuments"]),
      kv.get<Document[]>(["people", "byPersonId", member.author_id, "coAuthoredDocuments"]),
      kv.get<Committee[]>(["people", "byPersonId", member.author_id, "committees"]),
    ]);

    const congresses = membershipEntry.value ?? [];
    const authoredDocuments = authoredEntry.value ?? [];
    const coAuthoredDocuments = coAuthoredEntry.value ?? [];
    const committees = committeesEntry.value ?? [];

    return {
      id: member.id,
      personId: member.author_id,
      lastName: member.last_name,
      firstName: member.first_name,
      middleName: member.middle_name,
      suffix: member.suffix,
      nickName: member.nick_name,
      congresses,
      authoredDocuments,
      coAuthoredDocuments,
      committees,
    };
  } catch (error) {
    console.error(`Error transforming member ${member.author_id}:`, error);
    throw error;
  }
}

export const peopleRouter = new OpenAPIHono();

peopleRouter.openapi(peopleRoute, async (c) => {
  try {
    const { page: pageStr, limit: limitStr } = c.req.valid("query");
    const page = pageStr ? parseInt(pageStr, 10) : 0;
    const limit = limitStr ? parseInt(limitStr, 10) : 10;

    // Get latest congress number
    const congressResponse = await fetchCongressReference();
    if (!congressResponse.success || !congressResponse.data) {
      return c.json({ error: "Failed to fetch congress reference" }, 500);
    }
    const latestCongress = Math.max(
      ...congressResponse.data
        .filter(c => c.id !== 0)
        .map(c => mapCongressId(c.id))
    );

    const response = await fetchHouseMembers(page, limit);

    if (!response.success || !response.data) {
      return c.json({ error: "Failed to fetch house members" }, 500);
    }

    // Open single KV connection for the entire batch
    const kv = await openKv();

    try {
      // Process members sequentially to avoid overwhelming the system
      const people: Person[] = [];
      for (const member of response.data.rows) {
        try {
          const person = await transformHouseMember(member, latestCongress, kv);
          people.push(person);
        } catch (error) {
          console.error(`Failed to transform member ${member.author_id}, skipping:`, error);
          // Continue processing other members even if one fails
        }
      }
      const totalPages = Math.ceil(response.data.count / limit);

      return c.json(
        {
          page,
          limit,
          total: response.data.count,
          totalPages,
          data: people,
        },
        200
      );
    } finally {
      // Always close KV connection
      await kv.close();
    }
  } catch (error) {
    console.error("Error fetching house members:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});

peopleRouter.openapi(personByIdRoute, async (c) => {
  try {
    const { personId } = c.req.valid("param");

    // Get latest congress number
    const congressResponse = await fetchCongressReference();
    if (!congressResponse.success || !congressResponse.data) {
      return c.json({ error: "Failed to fetch congress reference" }, 500);
    }
    const latestCongress = Math.max(
      ...congressResponse.data
        .filter(c => c.id !== 0)
        .map(c => mapCongressId(c.id))
    );

    const kv = await openKv();

    // Try to get cached data first
    const infoEntry = await kv.get<{
      id: number;
      lastName: string;
      firstName: string;
      middleName: string;
      suffix: string | null;
      nickName: string;
    }>(["people", "byPersonId", personId, "information"]);

    await kv.close();

    // If we have cached info, use it; otherwise fallback to pagination
    let person: Person;

    if (infoEntry.value) {
      // Build person from cache
      const info = infoEntry.value;

      // Get membership and document data from cache
      const kv2 = await openKv();
      const [membershipEntry, authoredEntry, coAuthoredEntry, committeesEntry] = await Promise.all([
        kv2.get<number[]>(["people", "byPersonId", personId, "membership"]),
        kv2.get<Document[]>(["people", "byPersonId", personId, "authoredDocuments"]),
        kv2.get<Document[]>(["people", "byPersonId", personId, "coAuthoredDocuments"]),
        kv2.get<Committee[]>(["people", "byPersonId", personId, "committees"]),
      ]);
      await kv2.close();

      const membershipCongresses = membershipEntry.value ?? [];
      const cachedAuthored = authoredEntry.value;
      const cachedCoAuthored = coAuthoredEntry.value;
      const cachedCommittees = committeesEntry.value;

      // If we have all cached data, use it (zero API calls!)
      if (cachedAuthored && cachedCoAuthored && cachedCommittees) {
        person = {
          id: info.id,
          personId,
          lastName: info.lastName,
          firstName: info.firstName,
          middleName: info.middleName,
          suffix: info.suffix,
          nickName: info.nickName,
          congresses: membershipCongresses,
          authoredDocuments: cachedAuthored,
          coAuthoredDocuments: cachedCoAuthored,
          committees: cachedCommittees,
        };
      } else {
        // Fallback: Fetch from API if cache is incomplete
        const [authoredResults, coAuthoredResults, committeeResponse] = await Promise.all([
          // Fetch authored documents for all congresses in parallel
          cachedAuthored ? Promise.resolve([cachedAuthored]) : Promise.all(
            membershipCongresses.map(async (congress) => {
              try {
                const apiCongressId = mapToApiId(congress);
                const response = await fetchBillsSearch({
                  congress: apiCongressId,
                  author_id: personId,
                  author_type: "authorship",
                });
                if (response.success && response.data?.rows) {
                  return response.data.rows.map((bill) => ({
                    congress: mapCongressId(bill.congress),
                    documentKey: bill.bill_no,
                  }));
                }
                return [];
              } catch (error) {
                console.error(`Failed to fetch authored bills for ${personId} in congress ${congress}:`, error);
                return [];
              }
            })
          ),
          // Fetch co-authored documents for all congresses in parallel
          cachedCoAuthored ? Promise.resolve([cachedCoAuthored]) : Promise.all(
            membershipCongresses.map(async (congress) => {
              try {
                const apiCongressId = mapToApiId(congress);
                const response = await fetchBillsSearch({
                  congress: apiCongressId,
                  author_id: personId,
                  author_type: "coauthorship",
                });
                if (response.success && response.data?.rows) {
                  return response.data.rows.map((bill) => ({
                    congress: mapCongressId(bill.congress),
                    documentKey: bill.bill_no,
                  }));
                }
                return [];
              } catch (error) {
                console.error(`Failed to fetch co-authored bills for ${personId} in congress ${congress}:`, error);
                return [];
              }
            })
          ),
          // Fetch committee memberships
          cachedCommittees ? Promise.resolve({ status: 200, success: true, data: { count: cachedCommittees.length, rows: [] } }) : fetchCommitteeMembership(personId).catch((error) => {
            console.error(`Failed to fetch committees for ${personId}:`, error);
            return { status: 500, success: false, data: { count: 0, rows: [] } };
          }),
        ]);

        // Flatten results
        const authoredDocuments = cachedAuthored ?? authoredResults.flat();
        const coAuthoredDocuments = cachedCoAuthored ?? coAuthoredResults.flat();
        const committees: Committee[] = cachedCommittees ?? (
          committeeResponse.success && committeeResponse.data?.rows
            ? committeeResponse.data.rows.map((committee) => ({
                congress: mapCongressId(committee.congress),
                committeeId: committee.committee_code,
                name: committee.name,
                position: committee.title,
                journalNo: committee.journal_no,
              }))
            : []
        );

        person = {
          id: info.id,
          personId,
          lastName: info.lastName,
          firstName: info.firstName,
          middleName: info.middleName,
          suffix: info.suffix,
          nickName: info.nickName,
          congresses: membershipCongresses,
          authoredDocuments,
          coAuthoredDocuments,
          committees,
        };
      }
    } else {
      // Fallback: Paginate through members until we find the person
      const limit = 100;
      let page = 0;
      let member: HouseMemberItem | undefined;

      while (true) {
        const response = await fetchHouseMembers(page, limit);

        if (!response.success || !response.data) {
          return c.json({ error: "Failed to fetch house members" }, 500);
        }

        // Search in current page
        member = response.data.rows.find((m) => m.author_id === personId);

        if (member) {
          break; // Found the person
        }

        // Check if we've reached the end
        const totalPages = Math.ceil(response.data.count / limit);
        if (page >= totalPages - 1) {
          // Person not found after checking all pages
          return c.json({ error: `Person with ID ${personId} not found` }, 404);
        }

        page++;
      }

      // Transform the member data
      person = await transformHouseMember(member, latestCongress, kv);
    }

    return c.json(person, 200);
  } catch (error) {
    console.error("Error fetching person:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});
