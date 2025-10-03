import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { congressRouter } from "./routes/congress.ts";

const app = new OpenAPIHono();

// Mount routes
app.route("/", congressRouter);

// The OpenAPI documentation will be available at /doc
app.doc("/doc", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "Better HREP API",
    description: "A cleaner, well-documented proxy API for the House of Representatives website",
  },
});

// Swagger UI at root
app.get("/", swaggerUI({ url: "/doc" }));

Deno.serve(app.fetch);
