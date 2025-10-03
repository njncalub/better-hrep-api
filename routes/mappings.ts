import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

const AuthorSchema = z.object({
  id: z.string().openapi({
    example: "E001",
    description: "Author ID",
  }),
  name: z.string().openapi({
    example: "ABAD, HENEDINA R.",
    description: "Author name",
  }),
});

const CommitteeSchema = z.object({
  id: z.string().openapi({
    example: "0501",
    description: "Committee ID",
  }),
  name: z.string().openapi({
    example: "ACCOUNTS",
    description: "Committee name",
  }),
});

const authorsRoute = createRoute({
  method: "get",
  path: "/mappings/authors",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(AuthorSchema),
        },
      },
      description: "List of all authors",
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
  tags: ["Mappings"],
  summary: "Get all authors",
  description: "Returns a list of all authors with their IDs and names",
});

const committeesRoute = createRoute({
  method: "get",
  path: "/mappings/committees",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(CommitteeSchema),
        },
      },
      description: "List of all committees",
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
  tags: ["Mappings"],
  summary: "Get all committees",
  description: "Returns a list of all committees with their IDs and names",
});

export const mappingsRouter = new OpenAPIHono();

mappingsRouter.openapi(authorsRoute, async (c) => {
  try {
    const authors = JSON.parse(
      await Deno.readTextFile("./mappings/authors.json")
    );
    return c.json(authors, 200);
  } catch (error) {
    console.error("Error reading authors.json:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});

mappingsRouter.openapi(committeesRoute, async (c) => {
  try {
    const committees = JSON.parse(
      await Deno.readTextFile("./mappings/committees.json")
    );
    return c.json(committees, 200);
  } catch (error) {
    console.error("Error reading committees.json:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});
