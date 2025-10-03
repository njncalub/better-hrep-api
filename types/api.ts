/**
 * API types - These represent the cleaned/normalized response structures
 * that our proxy API will return to clients
 */

import { z } from "@hono/zod-openapi";

/**
 * Congress data
 */
export const CongressSchema = z
  .object({
    id: z.number().openapi({
      example: 20,
      description: "Congress number (e.g., 20 for 20th Congress)",
    }),
    name: z.string().openapi({
      example: "20th Congress",
      description: "Display name of the congress",
    }),
  })
  .openapi("Congress");

export type Congress = z.infer<typeof CongressSchema>;

/**
 * Array of congresses
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
 * Committee membership
 */
export const CommitteeSchema = z
  .object({
    congress: z.number().openapi({
      example: 20,
      description: "Congress number (normalized, e.g., 103 → 20)",
    }),
    committeeId: z.string().openapi({
      example: "0501",
      description: "Committee code/ID",
    }),
    name: z.string().openapi({
      example: "ACCOUNTS",
      description: "Committee name",
    }),
    position: z.string().openapi({
      example: "Member for the Majority",
      description: "Position/title in the committee",
    }),
    journalNo: z.string().openapi({
      example: "Journal No. 007",
      description: "Journal number reference",
    }),
  })
  .openapi("Committee");

export type Committee = z.infer<typeof CommitteeSchema>;

/**
 * Cleaned person (house member) data
 */
export const PersonSchema = z
  .object({
    id: z.number().openapi({
      example: 536,
      description: "Unique database ID from the source API",
    }),
    personId: z.string().openapi({
      example: "E001",
      description: "Unique person identifier",
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
    congressMemberships: z.array(z.number()).openapi({
      example: [20, 19, 17, 16],
      description: "List of congress numbers where this person was a member",
    }),
    authoredDocuments: z.array(DocumentSchema).openapi({
      example: [
        { congress: 17, documentKey: "HB02385" },
        { congress: 17, documentKey: "HB02386" },
      ],
      description: "List of documents principally authored",
    }),
    coAuthoredDocuments: z.array(DocumentSchema).openapi({
      example: [
        { congress: 19, documentKey: "HB01234" },
        { congress: 20, documentKey: "HB05678" },
      ],
      description: "List of documents co-authored",
    }),
    committees: z.array(CommitteeSchema).openapi({
      example: [
        { id: 1, name: "Committee on Appropriations", position: "Member" },
        { id: 2, name: "Committee on Ways and Means", position: "Vice Chair" },
      ],
      description: "List of committee memberships",
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

/**
 * Committee information
 */
export const CommitteeInfoSchema = z
  .object({
    id: z.number().openapi({
      example: 40,
      description: "Unique database ID from the source API",
    }),
    committeeId: z.string().openapi({
      example: "0543",
      description: "Committee code/ID",
    }),
    name: z.string().openapi({
      example: "YOUTH AND SPORTS DEVELOPMENT",
      description: "Committee name",
    }),
    phone: z.string().nullable().openapi({
      example: "(02) 8-9514326",
      description: "Committee phone number",
    }),
    jurisdiction: z.string().nullable().openapi({
      example: "All matters directly and principally relating to...",
      description: "Committee jurisdiction",
    }),
    location: z.string().nullable().openapi({
      example: "3rd Floor Ramon V. Mitra Bldg., House of Representatives, Quezon City",
      description: "Committee office location",
    }),
    type: z.string().openapi({
      example: "Standing Committees",
      description: "Committee type description",
    }),
  })
  .openapi("CommitteeInfo");

export type CommitteeInfo = z.infer<typeof CommitteeInfoSchema>;

/**
 * Paginated response for committees
 */
export const PaginatedCommitteesSchema = createPaginatedResponseSchema(
  CommitteeInfoSchema,
  "PaginatedCommittees"
);

export type PaginatedCommittees = z.infer<typeof PaginatedCommitteesSchema>;
