/**
 * Congress ID Mapper
 *
 * The HREP API uses inconsistent IDs for congress sessions.
 * Most notably, the 20th Congress uses ID 103 instead of 20.
 * This library normalizes these IDs to their correct congress numbers.
 */

/**
 * Map of incorrect HREP API congress IDs to correct congress numbers
 */
const CONGRESS_ID_MAP: Record<number, number> = {
  103: 20, // 20th Congress incorrectly uses ID 103 in the API
};

/**
 * Converts a HREP API congress ID to the correct congress number
 *
 * @param apiId - The congress ID from the HREP API
 * @returns The correct congress number
 *
 * @example
 * ```ts
 * mapCongressId(103) // returns 20
 * mapCongressId(19)  // returns 19
 * ```
 */
export function mapCongressId(apiId: number): number {
  return CONGRESS_ID_MAP[apiId] ?? apiId;
}

/**
 * Converts a congress number back to the HREP API's expected ID
 *
 * @param congressNumber - The actual congress number
 * @returns The ID that the HREP API expects
 *
 * @example
 * ```ts
 * mapToApiId(20) // returns 103
 * mapToApiId(19) // returns 19
 * ```
 */
export function mapToApiId(congressNumber: number): number {
  // Reverse lookup in the map
  for (const [apiId, correctNumber] of Object.entries(CONGRESS_ID_MAP)) {
    if (correctNumber === congressNumber) {
      return parseInt(apiId, 10);
    }
  }
  return congressNumber;
}
