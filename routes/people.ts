import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { fetchHouseMembers, fetchCoAuthoredBills } from "../lib/api-client.ts";
import { mapCongressId } from "../lib/congress-mapper.ts";
import { PaginatedPeopleSchema, type Person, type Document } from "../types/api.ts";
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

  return {
    id: member.id,
    authorId: member.author_id,
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
