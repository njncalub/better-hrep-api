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
