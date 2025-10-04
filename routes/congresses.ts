import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { fetchCongressReference, fetchBillsList } from "../lib/api-client.ts";
import { mapCongressId, mapToApiId } from "../lib/congress-mapper.ts";
import { CongressListSchema, type Congress, PaginatedDocumentsSchema, type DocumentInfo, type Reading, type Referral } from "../types/api.ts";
import type { CongressReferenceItem, BillListItem } from "../types/source.ts";

const congressesRoute = createRoute({
  method: "get",
  path: "/congresses",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: CongressListSchema,
        },
      },
      description: "List of all congresses",
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
  tags: ["Congresses"],
  summary: "Get all congresses",
  description: "Returns a cleaned list of all congresses from the HREP API",
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

/**
 * Route definition for GET /congresses/{congressNumber}/documents
 */
const congressDocumentsRoute = createRoute({
  method: "get",
  path: "/congresses/{congressNumber}/documents",
  request: {
    params: z.object({
      congressNumber: z.string().openapi({
        param: {
          name: "congressNumber",
          in: "path",
        },
        example: "20",
        description: "Congress number (e.g., 20 for 20th Congress)",
      }),
    }),
    query: z.object({
      page: z.string().optional().openapi({
        example: "0",
        description: "Page number (0-indexed)",
      }),
      limit: z.string().optional().openapi({
        example: "10",
        description: "Number of items per page",
      }),
      filter: z.string().optional().openapi({
        example: "",
        description: "Search filter",
      }),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: PaginatedDocumentsSchema,
        },
      },
      description: "Paginated list of documents for the congress",
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
  tags: ["Congresses"],
  summary: "Get documents for a specific congress",
  description: "Returns a paginated list of bills/documents for a specific congress. Fetches from the source API and validates author names against the people cache.",
});

/**
 * Helper function to transform author/coauthor data with person information
 */
async function transformAuthor(
  kv: Deno.Kv,
  author: { name: string; name_code: string }
) {
  // Try to find by name_code first
  const nameCodeIndexResult = await kv.get([
    "people",
    "byNameCode",
    author.name_code,
    "information",
  ]);

  if (nameCodeIndexResult.value) {
    // Secondary index contains the primary key to information
    const infoPrimaryKey = nameCodeIndexResult.value as string[];

    // Get the author_id from the primary key
    const authorId = infoPrimaryKey[2] as string;

    // Fetch person information
    const personInfoResult = await kv.get(infoPrimaryKey);

    if (personInfoResult.value) {
      const personInfo = personInfoResult.value as {
        id: number;
        lastName: string;
        firstName: string;
        middleName: string;
        suffix: string | null;
        nickName: string;
      };

      // Fetch membership data
      const membershipResult = await kv.get([
        "people",
        "byPersonId",
        authorId,
        "membership",
      ]);
      const membership = membershipResult.value as number[] || [];

      return {
        keyName: author.name, // Use name from bill data
        keyNameCode: author.name_code,
        personId: authorId,
        ...personInfo,
        congresses: membership,
      };
    }
  }

  // Fallback: Try to find by fullname
  const secondaryIndexResult = await kv.get([
    "people",
    "byPersonFullName",
    author.name,
    "membership",
  ]);

  if (secondaryIndexResult.value) {
    // Secondary index contains the primary key
    const primaryKey = secondaryIndexResult.value as string[];

    // Fetch the actual membership data from the primary key
    const membershipResult = await kv.get(primaryKey);
    const membership = membershipResult.value as number[];

    // Get the author_id from the primary key
    const authorId = primaryKey[2] as string;

    // Fetch person information
    const personInfoResult = await kv.get([
      "people",
      "byPersonId",
      authorId,
      "information",
    ]);

    if (personInfoResult.value) {
      const personInfo = personInfoResult.value as {
        id: number;
        lastName: string;
        firstName: string;
        middleName: string;
        suffix: string | null;
        nickName: string;
      };

      return {
        keyName: secondaryIndexResult.key[2] as string, // fullname from cache
        keyNameCode: author.name_code,
        personId: authorId,
        ...personInfo,
        congresses: membership,
      };
    }
  }

  // Final fallback if not found in cache at all
  return {
    keyName: author.name,
    keyNameCode: author.name_code,
  };
}

/**
 * Transform source BillListItem to DocumentInfo
 * Note: This is async now because it needs to verify author names against KV
 */
async function transformBillToDocument(bill: BillListItem): Promise<DocumentInfo> {
  const normalizedCongress = mapCongressId(bill.congress);

  const kv = await Deno.openKv();

  // Build authors array from the authors field
  const authors = await Promise.all(
    (bill.authors || []).map((author) => transformAuthor(kv, author))
  );

  // Build coAuthors array from the coauthors field
  const coAuthors = await Promise.all(
    (bill.coauthors || []).map((coauthor) => transformAuthor(kv, coauthor))
  );

  kv.close();

  return {
    id: bill.id,
    congress: normalizedCongress,
    documentKey: bill.bill_no,
    sessionNumber: bill.session_no,
    titleFull: bill.title_full,
    titleShort: bill.title_short,
    abstract: bill.abstract,
    dateFiled: bill.date_filed,
    status: bill.status,
    downloadUrl: bill.text_as_filed,
    authors,
    coAuthors,
    billType: bill.bill_type,
    significance: bill.significance_desc,
  };
}

export const congressesRouter = new OpenAPIHono();

congressesRouter.openapi(congressesRoute, async (c) => {
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

congressesRouter.openapi(congressDocumentsRoute, async (c) => {
  try {
    const { congressNumber } = c.req.valid("param");
    const { page = "0", limit = "10", filter = "" } = c.req.valid("query");

    const congressNum = parseInt(congressNumber, 10);
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    // Convert congress number to API ID (20 → 103)
    const apiCongressId = mapToApiId(congressNum);

    // Fetch from the source API
    const response = await fetchBillsList(pageNum, limitNum, apiCongressId, filter);

    if (!response.success || !response.data) {
      return c.json({ error: "Failed to fetch bills from source API" }, 500);
    }

    // Transform bills to documents
    const documents = await Promise.all(
      response.data.rows.map(bill => transformBillToDocument(bill))
    );

    const total = response.data.count;
    const totalPages = Math.ceil(total / limitNum);

    return c.json(
      {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        data: documents,
      },
      200
    );
  } catch (error) {
    console.error("Error fetching congress documents:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});
