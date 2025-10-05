import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { Hono } from "hono";
import { trimTrailingSlash } from "hono/trailing-slash";
import { congressesRouter } from "./routes/congresses.ts";
import { peopleRouter } from "./routes/people.ts";
import { committeesRouter } from "./routes/committees.ts";
import { indexRouter } from "./routes/index.ts";
import { cachedRouter } from "./routes/cached.ts";
import { infoRouter } from "./routes/info.ts";
import { pages } from "./routes/pages.tsx";

const app = new Hono();
const apiApp = new OpenAPIHono({ strict: false });

// Remove trailing slashes and redirect
app.use("*", trimTrailingSlash());
apiApp.use("*", trimTrailingSlash());

// Mount API routes under /api
apiApp.route("/", congressesRouter);
apiApp.route("/", peopleRouter);
apiApp.route("/", committeesRouter);
apiApp.route("/", indexRouter);
apiApp.route("/", cachedRouter);
apiApp.route("/", infoRouter);

// The OpenAPI documentation will be available at /api/doc
apiApp.doc("/doc", {
  openapi: "3.0.0",
  info: {
    version: "0.0.1",
    title: "Better HREP API",
    description: "A cleaner, well-documented proxy API for the House of Representatives website.",
  },
  servers: [
    {
      url: "/api",
      description: "API server",
    },
  ],
});

// Mount the API app under /api
app.route("/api", apiApp);

// Swagger UI at /api
app.get("/api", swaggerUI({ url: "/api/doc", title: "Better HREP API" }));

// Mount web interface pages
app.route("/", pages);

Deno.serve(app.fetch);
