import "jsr:@std/dotenv/load";
import type { CongressReferenceResponse, HouseMembersResponse } from "../types/source.ts";

const BASE_API_URL = Deno.env.get("BASE_API_URL")!;
const X_HREP_WEBSITE_BACKEND = Deno.env.get("X_HREP_WEBSITE_BACKEND")!;

if (!BASE_API_URL || !X_HREP_WEBSITE_BACKEND) {
  throw new Error("BASE_API_URL and X_HREP_WEBSITE_BACKEND must be set in .env file");
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
