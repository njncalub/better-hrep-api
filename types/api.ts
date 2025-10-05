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
    congresses: z.array(z.number()).openapi({
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
    documents: z.array(DocumentSchema).openapi({
      example: [
        { congress: 20, documentKey: "HB00001" },
        { congress: 20, documentKey: "HB00123" },
      ],
      description: "List of documents referred to this committee",
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

/**
 * Reading information (first, second, third reading)
 */
export const ReadingSchema = z
  .object({
    id: z.number().openapi({
      example: 2,
      description: "Reading record ID",
    }),
    congress: z.number().openapi({
      example: 20,
      description: "Congress number",
    }),
    billNo: z.string().openapi({
      example: "HB00001",
      description: "Bill number",
    }),
    report: z.string().optional().openapi({
      example: "Committee Report No. 123",
      description: "Committee report number",
    }),
    referral: z.string().optional().openapi({
      example: "E505",
      description: "Committee referral code",
    }),
    refName: z.string().optional().openapi({
      example: "AGRICULTURE AND FOOD",
      description: "Committee name",
    }),
    dateRead: z.string().optional().openapi({
      example: "2025-07-29",
      description: "Date of reading",
    }),
  })
  .openapi("Reading");

export type Reading = z.infer<typeof ReadingSchema>;

/**
 * Referral information
 */
export const ReferralSchema = z
  .object({
    committee: z.string().openapi({
      example: "AGRICULTURE AND FOOD",
      description: "Committee name",
    }),
    sequence: z.string().openapi({
      example: "1.0",
      description: "Referral sequence number",
    }),
  })
  .openapi("Referral");

export type Referral = z.infer<typeof ReferralSchema>;

/**
 * Author information
 */
export const AuthorSchema = z
  .object({
    personId: z.string().openapi({
      example: "F061",
      description: "Person ID from the people index",
    }),
    id: z.number().openapi({
      example: 240,
      description: "Person database ID",
    }),
    lastName: z.string().openapi({
      example: "ROMUALDEZ",
      description: "Last name",
    }),
    firstName: z.string().openapi({
      example: "FERDINAND MARTIN",
      description: "First name",
    }),
    middleName: z.string().openapi({
      example: "G.",
      description: "Middle name or initial",
    }),
    suffix: z.string().nullable().openapi({
      example: null,
      description: "Name suffix (e.g., Jr., Sr., III)",
    }),
    nickName: z.string().openapi({
      example: "HON. FERDINAND MARTIN G. ROMUALDEZ",
      description: "Nickname or preferred name",
    }),
    congresses: z.array(z.number()).openapi({
      example: [20, 19, 18],
      description: "Congress membership numbers",
    }),
  })
  .openapi("Author");

export type Author = z.infer<typeof AuthorSchema>;

/**
 * Committee information in document context
 */
export const CommitteeInDocumentSchema = z
  .object({
    committeeId: z.string().openapi({
      example: "0543",
      description: "Committee code/ID",
    }),
    id: z.number().openapi({
      example: 40,
      description: "Committee database ID",
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
      example: "Youth and sports development programs",
      description: "Committee jurisdiction",
    }),
    location: z.string().nullable().openapi({
      example: "Room 305, South Wing",
      description: "Committee office location",
    }),
    type_desc: z.string().openapi({
      example: "Standing Committee",
      description: "Committee type description",
    }),
  })
  .openapi("CommitteeInDocument");

export type CommitteeInDocument = z.infer<typeof CommitteeInDocumentSchema>;

/**
 * Document/Bill detailed information
 */
export const DocumentInfoSchema = z
  .object({
    id: z.number().openapi({
      example: 82865,
      description: "Unique database ID",
    }),
    congress: z.number().openapi({
      example: 20,
      description: "Congress number (normalized, e.g., 103 → 20)",
    }),
    documentKey: z.string().openapi({
      example: "HB00001",
      description: "Bill/document number",
    }),
    sessionNumber: z.string().openapi({
      example: "20-1RS-002",
      description: "Session number",
    }),
    titleFull: z.string().openapi({
      example: "AN ACT STRENGTHENING THE REGULATORY POWERS...",
      description: "Full title of the bill",
    }),
    titleShort: z.string().openapi({
      example: "Agricultural Tariffication Act Amendment",
      description: "Short title of the bill",
    }),
    abstract: z.string().openapi({
      example: "This bill amends Republic Act No. 8178...",
      description: "Abstract/summary of the bill",
    }),
    dateFiled: z.string().openapi({
      example: "2025-06-30",
      description: "Date the bill was filed",
    }),
    status: z.string().openapi({
      example: "Referred to the Technical Working Group (TWG) on 2025-08-20",
      description: "Current status of the bill",
    }),
    downloadUrl: z.string().openapi({
      example: "https://docs.congress.hrep.online/legisdocs/basic_20/HB00001.pdf",
      description: "URL to download the bill PDF",
    }),
    authors: z.array(AuthorSchema).openapi({
      example: [
        { keyName: "ROMUALDEZ, FERDINAND MARTIN G.", keyNameCode: "Romualdez (F.M.)" },
        { keyName: "ACIDRE, JUDE A.", keyNameCode: "Acidre" },
      ],
      description: "List of authors",
    }),
    coAuthors: z.array(AuthorSchema).openapi({
      example: [
        { keyName: "DE VENECIA, MARIA GEORGINA P.", keyNameCode: "De Venecia" },
        { keyName: "RIVERA, NOEL \"Bong\" N.", keyNameCode: "Rivera" },
      ],
      description: "List of co-authors",
    }),
    committees: z.array(CommitteeInDocumentSchema).openapi({
      example: [
        {
          committeeId: "0543",
          id: 40,
          name: "YOUTH AND SPORTS DEVELOPMENT",
          phone: "(02) 8-9514326",
          jurisdiction: null,
          location: null,
          type_desc: "Standing Committee",
        },
      ],
      description: "List of committees",
    }),
    billType: z.string().openapi({
      example: "House Bill",
      description: "Type of bill/document",
    }),
    significance: z.string().openapi({
      example: "National",
      description: "Significance level of the bill",
    }),
  })
  .openapi("DocumentInfo");

export type DocumentInfo = z.infer<typeof DocumentInfoSchema>;

/**
 * Paginated response for documents
 */
export const PaginatedDocumentsSchema = createPaginatedResponseSchema(
  DocumentInfoSchema,
  "PaginatedDocuments"
);

export type PaginatedDocuments = z.infer<typeof PaginatedDocumentsSchema>;
