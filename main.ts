import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { congressesRouter } from "./routes/congresses.ts";
import { peopleRouter } from "./routes/people.ts";
import { committeesRouter } from "./routes/committees.ts";
import { indexRouter } from "./routes/index.ts";
import { cachedRouter } from "./routes/cached.ts";

const app = new OpenAPIHono({ strict: false });

// Mount routes
app.route("/", congressesRouter);
app.route("/", peopleRouter);
app.route("/", committeesRouter);
app.route("/", indexRouter);
app.route("/", cachedRouter);

// The OpenAPI documentation will be available at /doc
app.doc("/doc", {
  openapi: "3.0.0",
  info: {
    version: "0.0.1",
    title: "Better HREP API",
    description: "A cleaner, well-documented proxy API for the House of Representatives website.",
  },
});

// Swagger UI at root
app.get("/", swaggerUI({ url: "/doc", title: "Better HREP API" }));

Deno.serve(app.fetch);
