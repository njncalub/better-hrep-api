import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { fetchHouseMembers, fetchCoAuthoredBills, fetchCommitteeMembership } from "../lib/api-client.ts";
import { mapCongressId } from "../lib/congress-mapper.ts";
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
    example: "100",
    description: "Number of items per page (max 1126)",
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
  summary: "Get a specific person by ID (⚠️ SLOW - Not Recommended)",
  description: "⚠️ **WARNING: This endpoint is slow and should be avoided.** The source HREP API does not provide a way to fetch a single person by ID, so this endpoint must paginate through all members until the requested person is found. This can take several seconds. **Recommendation:** Use `GET /people` with pagination instead and filter client-side.",
});

/**
 * Transform source API data to cleaned API format
 */
async function transformHouseMember(member: HouseMemberItem): Promise<Person> {
  // Fetch co-authored bills for this member
  let coAuthoredDocuments: Document[] = [];
  try {
    const coAuthorResponse = await fetchCoAuthoredBills(member.author_id);
    if (coAuthorResponse.success && coAuthorResponse.data?.rows) {
      coAuthoredDocuments = coAuthorResponse.data.rows.map((bill) => ({
        congress: mapCongressId(bill.congress),
        documentKey: bill.bill_no,
      }));
    }
  } catch (error) {
    // If co-author endpoint fails, just return empty array
    console.error(`Failed to fetch co-authored bills for ${member.author_id}:`, error);
  }

  // Fetch committee memberships for this member
  let committees: Committee[] = [];
  try {
    const committeeResponse = await fetchCommitteeMembership(member.author_id);
    if (committeeResponse.success && committeeResponse.data?.rows) {
      committees = committeeResponse.data.rows.map((committee) => ({
        congress: mapCongressId(committee.congress),
        committeeId: committee.committee_code,
        position: committee.title,
        journalNo: committee.journal_no,
      }));
    }
  } catch (error) {
    // If committee endpoint fails, just return empty array
    console.error(`Failed to fetch committees for ${member.author_id}:`, error);
  }

  return {
    id: member.id,
    personId: member.author_id,
    lastName: member.last_name,
    firstName: member.first_name,
    middleName: member.middle_name,
    suffix: member.suffix,
    nickName: member.nick_name,
    authoredDocuments:
      member.principal_authored_bills?.map((bill) => ({
        congress: mapCongressId(bill.congress),
        documentKey: bill.bill_no,
      })) ?? [],
    coAuthoredDocuments,
    committees,
  };
}

export const peopleRouter = new OpenAPIHono();

peopleRouter.openapi(peopleRoute, async (c) => {
  try {
    const { page: pageStr, limit: limitStr } = c.req.valid("query");
    const page = pageStr ? parseInt(pageStr, 10) : 0;
    const limit = limitStr ? parseInt(limitStr, 10) : 100;

    const response = await fetchHouseMembers(page, limit);

    if (!response.success || !response.data) {
      return c.json({ error: "Failed to fetch house members" }, 500);
    }

    const people = await Promise.all(response.data.rows.map(transformHouseMember));
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

    // Paginate through members until we find the person
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
    const person = await transformHouseMember(member);

    return c.json(person, 200);
  } catch (error) {
    console.error("Error fetching person:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});
