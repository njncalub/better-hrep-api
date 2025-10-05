import "jsr:@std/dotenv/load";
import type {
  CongressReferenceResponse,
  HouseMembersResponse,
  CoAuthoredBillsResponse,
  CommitteeMembershipResponse,
  HouseMemberDDLResponse,
  BillsSearchResponse,
  CommitteeListResponse,
  BillsListResponse,
} from "../types/source.ts";

const BASE_API_URL = Deno.env.get("BASE_API_URL")!;
const X_HREP_WEBSITE_BACKEND = Deno.env.get("X_HREP_WEBSITE_BACKEND")!;

if (!BASE_API_URL || !X_HREP_WEBSITE_BACKEND) {
  throw new Error("BASE_API_URL and X_HREP_WEBSITE_BACKEND environment variables must be set");
}

export interface FetchOptions {
  method?: string;
  body?: unknown;
}

/**
 * Generic function to fetch from the source HREP API
 */
export async function fetchFromAPI<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { method = "GET", body } = options;
  const url = `${BASE_API_URL}${path}`;

  const fetchOptions: RequestInit = {
    method,
    headers: {
      "X-Hrep-Website-Backend": X_HREP_WEBSITE_BACKEND,
      "Content-Type": "application/json",
    },
  };

  if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch congress reference data from /system-config/reference-congress
 */
export function fetchCongressReference(): Promise<CongressReferenceResponse> {
  return fetchFromAPI<CongressReferenceResponse>("/system-config/reference-congress");
}

/**
 * Fetch house members list from /house-members/list
 */
export function fetchHouseMembers(
  page: number = 0,
  limit: number = 100,
  filter: string = ""
): Promise<HouseMembersResponse> {
  return fetchFromAPI<HouseMembersResponse>("/house-members/list", {
    method: "POST",
    body: { page, limit, filter },
  });
}

/**
 * Fetch co-authored bills for a specific author from /house-members/co-author
 */
export function fetchCoAuthoredBills(
  author: string,
  page: number = 0,
  limit: number = 1000,
  filter: string = ""
): Promise<CoAuthoredBillsResponse> {
  return fetchFromAPI<CoAuthoredBillsResponse>("/house-members/co-author", {
    method: "POST",
    body: { page, limit, filter, author },
  });
}

/**
 * Fetch committee membership for a specific member from /house-members/committee-membership
 */
export function fetchCommitteeMembership(
  memberCode: string
): Promise<CommitteeMembershipResponse> {
  return fetchFromAPI<CommitteeMembershipResponse>("/house-members/committee-membership", {
    method: "POST",
    body: { member_code: memberCode },
  });
}

/**
 * Fetch house members DDL reference from GET /house-members/ddl-reference
 * This returns a simplified list with membership congress numbers
 */
export function fetchHouseMembersDDL(): Promise<HouseMemberDDLResponse> {
  return fetchFromAPI<HouseMemberDDLResponse>("/house-members/ddl-reference");
}

/**
 * Fetch principal authored bills for a specific author from /house-members/principal-author
 */
export function fetchPrincipalAuthoredBills(
  author: string,
  page: number = 0,
  limit: number = 1000,
  filter: string = ""
): Promise<CoAuthoredBillsResponse> {
  return fetchFromAPI<CoAuthoredBillsResponse>("/house-members/principal-author", {
    method: "POST",
    body: { page, limit, filter, author },
  });
}

/**
 * Search bills from POST /bills/search
 */
export function fetchBillsSearch(params: {
  page?: number;
  limit?: number;
  congress: number;
  significance?: string;
  field?: string;
  numbers?: string;
  author_id: string;
  author_type: "authorship" | "coauthorship" | "Both";
  committee_id?: string;
  title?: string;
}): Promise<BillsSearchResponse> {
  const {
    page = 0,
    limit = 999,
    congress,
    significance = "Both",
    field = "Author",
    numbers = "",
    author_id,
    author_type,
    committee_id = "",
    title = "",
  } = params;

  return fetchFromAPI<BillsSearchResponse>("/bills/search", {
    method: "POST",
    body: {
      page,
      limit,
      congress,
      significance,
      field,
      numbers,
      author_id,
      author_type,
      committee_id,
      title,
    },
  });
}

/**
 * Fetch committee list from POST /committee/list
 */
export function fetchCommitteeList(
  page: number = 0,
  limit: number = 100
): Promise<CommitteeListResponse> {
  return fetchFromAPI<CommitteeListResponse>("/committee/list", {
    method: "POST",
    body: { page, limit },
  });
}

/**
 * Fetch bills list from POST /bills/list
 */
export function fetchBillsList(
  page: number = 0,
  limit: number = 10,
  congress: number,
  filter: string = ""
): Promise<BillsListResponse> {
  return fetchFromAPI<BillsListResponse>("/bills/list", {
    method: "POST",
    body: { page, limit, congress, filter },
  });
}

/**
 * Fetch specific bill from POST /bills/search by document key
 */
export function fetchBillByDocumentKey(
  congress: number,
  documentKey: string
): Promise<BillsSearchResponse> {
  return fetchFromAPI<BillsSearchResponse>("/bills/search", {
    method: "POST",
    body: {
      page: 0,
      limit: 999,
      congress,
      significance: "Both",
      field: "Bills",
      numbers: documentKey,
      author_id: "",
      author_type: "Both",
      committee_id: "",
      title: "",
    },
  });
}
