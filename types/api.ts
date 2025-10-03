/**
 * API types - These represent the cleaned/normalized response structures
 * that our proxy API will return to clients
 */

import { z } from "@hono/zod-openapi";

/**
 * Cleaned congress session data
 */
export const CongressSchema = z
  .object({
    id: z.number().openapi({
      example: 20,
      description: "Congress number (e.g., 20 for 20th Congress)",
    }),
    name: z.string().openapi({
      example: "20th Congress",
      description: "Display name of the congress session",
    }),
  })
  .openapi("Congress");

export type Congress = z.infer<typeof CongressSchema>;

/**
 * Array of congress sessions
 */
export const CongressListSchema = z.array(CongressSchema).openapi("CongressList");

export type CongressList = z.infer<typeof CongressListSchema>;

/**
 * Document reference
 */
export const DocumentSchema = z
  .object({
    congress: z.number().openapi({
      example: 17,
      description: "Congress number (normalized, e.g., 103 → 20)",
    }),
    documentKey: z.string().openapi({
      example: "HB02385",
      description: "Document number",
    }),
  })
  .openapi("Document");

export type Document = z.infer<typeof DocumentSchema>;

/**
 * Cleaned person (house member) data
 */
export const PersonSchema = z
  .object({
    id: z.number().openapi({
      example: 536,
      description: "Unique database ID from the source API",
    }),
    authorId: z.string().openapi({
      example: "E001",
      description: "Unique author identifier",
    }),
    lastName: z.string().openapi({
      example: "Abad",
      description: "Last name",
    }),
    firstName: z.string().openapi({
      example: "Henedina",
      description: "First name",
    }),
    middleName: z.string().openapi({
      example: "R.",
      description: "Middle name or initial",
    }),
    suffix: z.string().nullable().openapi({
      example: "Jr.",
      description: "Name suffix (e.g., Jr., Sr., III)",
    }),
    nickName: z.string().openapi({
      example: "Dina",
      description: "Nickname or preferred name",
    }),
    principalAuthoredBills: z.array(DocumentSchema).openapi({
      example: [
        { congress: 17, documentKey: "HB02385" },
        { congress: 17, documentKey: "HB02386" },
      ],
      description: "List of bills principally authored",
    }),
  })
  .openapi("Person");

export type Person = z.infer<typeof PersonSchema>;

/**
 * Generic paginated response with metadata
 */
export function createPaginatedResponseSchema<T extends z.ZodTypeAny>(
  dataSchema: T,
  schemaName: string
) {
  return z
    .object({
      page: z.number().openapi({
        example: 0,
        description: "Current page number (0-indexed)",
      }),
      limit: z.number().openapi({
        example: 100,
        description: "Number of items per page",
      }),
      total: z.number().openapi({
        example: 1126,
        description: "Total number of items",
      }),
      totalPages: z.number().openapi({
        example: 12,
        description: "Total number of pages",
      }),
      data: z.array(dataSchema).openapi({
        description: "Array of items",
      }),
    })
    .openapi(schemaName);
}

/**
 * Paginated response for people
 */
export const PaginatedPeopleSchema = createPaginatedResponseSchema(
  PersonSchema,
  "PaginatedPeople"
);

export type PaginatedPeople = z.infer<typeof PaginatedPeopleSchema>;
