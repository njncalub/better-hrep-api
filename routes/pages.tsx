import { Context, Hono } from "hono";
import { trimTrailingSlash } from "hono/trailing-slash";
import { Layout } from "../components/Layout.tsx";
import { PersonCard } from "../components/PersonCard.tsx";
import { CongressBadges } from "../components/CongressBadges.tsx";
import { Pagination } from "../components/Pagination.tsx";
import type {
  CommitteeInfo,
  Congress,
  DocumentInfo,
  PaginatedCommittees,
  PaginatedDocuments,
  PaginatedPeople,
  Person,
} from "../types/api.ts";

const pages = new Hono();

// Remove trailing slashes and redirect
pages.use("*", trimTrailingSlash());

// Helper function to get base URL
function getBaseUrl(c: Context): string {
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}`;
}

// Helper function to fetch from API
async function fetchAPI<T>(c: Context, path: string): Promise<T> {
  const baseUrl = getBaseUrl(c);
  const response = await fetch(`${baseUrl}/api${path}`);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  return response.json();
}

// Homepage
pages.get("/", (c) => {
  return c.html(
    <Layout title="Better HREP API - Philippine House of Representatives Data">
      <div class="hero">
        <h1>Better HREP API</h1>
        <p>
          A clean, well-documented interface for browsing Philippine House of
          Representatives legislative data
        </p>
      </div>

      <section>
        <h2>Browse Data</h2>
        <div class="list-grid">
          <article class="card">
            <h3>
              <a href="/congresses">Congresses</a>
            </h3>
            <p>
              View all Philippine congressional sessions and their legislative
              documents
            </p>
          </article>

          <article class="card">
            <h3>
              <a href="/people">Representatives</a>
            </h3>
            <p>
              Explore current and former members of the House of Representatives
            </p>
          </article>

          <article class="card">
            <h3>
              <a href="/committees">Committees</a>
            </h3>
            <p>View all House committees and their jurisdictions</p>
          </article>
        </div>
      </section>

      <section>
        <h2>For Developers</h2>
        <p>
          This project provides both a web interface and a RESTful API for
          accessing Philippine legislative data. The API offers clean,
          normalized data structures with full OpenAPI documentation.
        </p>
        <p>
          <a href="/api" role="button">View API Documentation</a>
        </p>
      </section>

      <section>
        <h2>About This Project</h2>
        <p>
          Better HREP API is an open-source proxy that provides a cleaner
          interface to the{" "}
          <a
            href="https://congress.gov.ph"
            target="_blank"
            rel="noopener noreferrer"
          >
            House of Representatives website
          </a>. All data comes from the official HREP API and is presented in a
          more accessible format.
        </p>
        <p>
          <strong>Key Features:</strong>
        </p>
        <ul>
          <li>Clean, normalized data structures</li>
          <li>Full OpenAPI/Swagger documentation</li>
          <li>Type-safe TypeScript implementation</li>
          <li>Responsive web interface</li>
          <li>RESTful API endpoints</li>
        </ul>
      </section>
    </Layout>,
  );
});

// Congresses list
pages.get("/congresses", async (c) => {
  const congresses = await fetchAPI<Congress[]>(c, "/congresses");

  return c.html(
    <Layout title="Congresses - Better HREP API">
      <div>
        <h1>Philippine Congresses</h1>
        <p>
          Browse all congressional sessions of the Philippine House of
          Representatives
        </p>
      </div>

      <div class="list-grid">
        {congresses.map((congress) => (
          <article class="card">
            <h3>
              <a href={`/congresses/${congress.id}`}>{congress.name}</a>
            </h3>
            <p class="meta">Congress Number: {congress.id}</p>
          </article>
        ))}
      </div>
    </Layout>,
  );
});

// Single congress with bills
pages.get("/congresses/:congressNumber", async (c) => {
  const congressNumber = c.req.param("congressNumber");
  const page = c.req.query("page") || "0";
  const limit = c.req.query("limit") || "20";

  const documents = await fetchAPI<PaginatedDocuments>(
    c,
    `/congresses/${congressNumber}/documents?page=${page}&limit=${limit}`,
  );

  return c.html(
    <Layout title={congressNumber + "th Congress - Better HREP API"}>
      <h1>{congressNumber}th Congress</h1>
      <p class="meta">
        Showing {documents.data.length} of {documents.total} bills (Page{" "}
        {documents.page + 1} of {documents.totalPages})
      </p>

      <div class="bills-list">
        {documents.data.map((doc) => (
          <article class="bill-card">
            <div class="bill-header">
              <h3>
                <a
                  href={`/congresses/${congressNumber}/documents/${doc.documentKey}`}
                >
                  {doc.documentKey}
                </a>
              </h3>
              <span class="bill-date">{doc.dateFiled}</span>
            </div>
            <p class="bill-title">{doc.titleFull || doc.titleShort}</p>
            <div class="bill-meta">
              <span class="bill-meta-item">
                <strong>{doc.authors.length}</strong>{" "}
                author{doc.authors.length !== 1 ? "s" : ""}
              </span>
              <span class="bill-meta-item">
                <strong>{doc.coAuthors.length}</strong>{" "}
                co-author{doc.coAuthors.length !== 1 ? "s" : ""}
              </span>
            </div>
            <p class="bill-status">{doc.status}</p>
          </article>
        ))}
      </div>

      <nav>
        <ul>
          {documents.page > 0 && (
            <li>
              <a
                href={`/congresses/${congressNumber}?page=${
                  documents.page - 1
                }&limit=${limit}`}
              >
                ← Previous
              </a>
            </li>
          )}
          {documents.page < documents.totalPages - 1 && (
            <li>
              <a
                href={`/congresses/${congressNumber}?page=${
                  documents.page + 1
                }&limit=${limit}`}
              >
                Next →
              </a>
            </li>
          )}
        </ul>
      </nav>
    </Layout>,
  );
});

// Single bill detail
pages.get("/congresses/:congressNumber/documents/:documentKey", async (c) => {
  const congressNumber = c.req.param("congressNumber");
  const documentKey = c.req.param("documentKey");

  try {
    const bill = await fetchAPI<DocumentInfo>(
      c,
      `/congresses/${congressNumber}/documents/${documentKey}`,
    );

    return c.html(
      <Layout
        title={bill.documentKey + " - " + congressNumber +
          "th Congress - Better HREP API"}
      >
        <nav>
          <a href={`/congresses/${congressNumber}`}>
            ← Back to {congressNumber}th Congress
          </a>
        </nav>

        <h1>{bill.documentKey}</h1>
        <p class="meta">
          {bill.billType && bill.significance &&
            `${bill.billType} | ${bill.significance}`}
          {bill.billType && !bill.significance && bill.billType}
          {!bill.billType && bill.significance && bill.significance}
        </p>

        <h2>Title</h2>
        <p>{bill.titleFull || bill.titleShort}</p>

        {bill.abstract && (
          <>
            <h2>Abstract</h2>
            <p>{bill.abstract}</p>
          </>
        )}

        <h2>Details</h2>
        <ul>
          <li>
            <strong>Session:</strong> {bill.sessionNumber}
          </li>
          <li>
            <strong>Date Filed:</strong> {bill.dateFiled}
          </li>
          <li>
            <strong>Status:</strong> {bill.status}
          </li>
          <li>
            <strong>Download:</strong>{" "}
            <a href={bill.downloadUrl} target="_blank">PDF</a>
          </li>
        </ul>

        <h2>Authors ({bill.authors.length})</h2>
        <div class="people-grid">
          {bill.authors.map((author) => (
            <PersonCard person={author} showStats={false} />
          ))}
        </div>

        {bill.coAuthors.length > 0 && (
          <>
            <h2>Co-Authors ({bill.coAuthors.length})</h2>
            <div class="people-grid">
              {bill.coAuthors.map((coAuthor) => (
                <PersonCard person={coAuthor} showStats={false} />
              ))}
            </div>
          </>
        )}
      </Layout>,
    );
  } catch (_error) {
    return c.html(
      <Layout title="Document Not Found - Better HREP API">
        <h1>Document Not Found</h1>
        <p>
          The document {documentKey} was not found in the {congressNumber}th Congress.
        </p>
        <p>
          <a href={`/congresses/${congressNumber}`}>
            ← Back to {congressNumber}th Congress
          </a>
        </p>
      </Layout>,
      404,
    );
  }
});

// People list
pages.get("/people", async (c) => {
  const page = c.req.query("page") || "0";
  const limit = c.req.query("limit") || "20";

  const people = await fetchAPI<PaginatedPeople>(
    c,
    `/people?page=${page}&limit=${limit}`,
  );

  return c.html(
    <Layout title="Representatives - Better HREP API">
      <h1>House Representatives</h1>
      <p class="meta">
        Showing {people.data.length} of {people.total} representatives (Page
        {" "}
        {people.page + 1} of {people.totalPages})
      </p>

      <div class="people-grid">
        {people.data.map((person) => <PersonCard person={person} showStats />)}
      </div>

      <Pagination
        currentPage={people.page}
        totalPages={people.totalPages}
        baseUrl="/people"
        limit={limit}
      />
    </Layout>,
  );
});

// Single person detail
pages.get("/people/:personId", async (c) => {
  const personId = c.req.param("personId");

  const person = await fetchAPI<Person>(c, `/people/${personId}`);

  return c.html(
    <Layout
      title={person.firstName + " " + person.lastName + " - Better HREP API"}
    >
      <nav>
        <a href="/people">← Back to Representatives</a>
      </nav>

      <h1>
        {person.firstName} {person.middleName} {person.lastName}
        {person.suffix ? ` ${person.suffix}` : ""}
      </h1>
      <p class="meta">Person ID: {person.personId}</p>
      <CongressBadges congresses={person.congresses} />

      <h2>Authored ({person.authoredDocuments.length})</h2>
      {person.authoredDocuments.length > 0
        ? (
          <>
            {(() => {
              // Group bills by congress
              const billsByCongress = person.authoredDocuments.reduce(
                (acc, doc) => {
                  if (!acc[doc.congress]) {
                    acc[doc.congress] = [];
                  }
                  acc[doc.congress].push(doc);
                  return acc;
                },
                {} as Record<number, typeof person.authoredDocuments>,
              );

              // Sort congresses in descending order
              const sortedCongresses = Object.keys(billsByCongress)
                .map(Number)
                .sort((a, b) => b - a);

              return sortedCongresses.map((congress) => (
                <details
                  class="congress-section"
                  open={congress === sortedCongresses[0]}
                >
                  <summary class="congress-summary">
                    {congress}th Congress ({billsByCongress[congress].length})
                  </summary>
                  <ul class="bills-list-compact">
                    {billsByCongress[congress].map((doc) => (
                      <li>
                        <a
                          href={`/congresses/${doc.congress}/documents/${doc.documentKey}`}
                        >
                          {doc.documentKey}
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              ));
            })()}
          </>
        )
        : <p>No authored documents found.</p>}

      <h2>Co-Authored ({person.coAuthoredDocuments.length})</h2>
      {person.coAuthoredDocuments.length > 0
        ? (
          <>
            {(() => {
              // Group bills by congress
              const billsByCongress = person.coAuthoredDocuments.reduce(
                (acc, doc) => {
                  if (!acc[doc.congress]) {
                    acc[doc.congress] = [];
                  }
                  acc[doc.congress].push(doc);
                  return acc;
                },
                {} as Record<number, typeof person.coAuthoredDocuments>,
              );

              // Sort congresses in descending order
              const sortedCongresses = Object.keys(billsByCongress)
                .map(Number)
                .sort((a, b) => b - a);

              return sortedCongresses.map((congress) => (
                <details
                  class="congress-section"
                  open={congress === sortedCongresses[0]}
                >
                  <summary class="congress-summary">
                    {congress}th Congress ({billsByCongress[congress].length})
                  </summary>
                  <ul class="bills-list-compact">
                    {billsByCongress[congress].map((doc) => (
                      <li>
                        <a
                          href={`/congresses/${doc.congress}/documents/${doc.documentKey}`}
                        >
                          {doc.documentKey}
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              ));
            })()}
          </>
        )
        : <p>No co-authored documents found.</p>}

      {person.committees.length > 0 && (
        <>
          <h2>Committee Memberships ({person.committees.length})</h2>
          <div class="list-grid">
            {person.committees.map((committee) => (
              <div class="card">
                <h3>{committee.name}</h3>
                <p class="meta">{committee.position}</p>
                <p class="meta">
                  {committee.congress}th Congress | {committee.journalNo}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </Layout>,
  );
});

// Committees list
pages.get("/committees", async (c) => {
  const page = c.req.query("page") || "0";
  const limit = c.req.query("limit") || "20";

  const committees = await fetchAPI<PaginatedCommittees>(
    c,
    `/committees?page=${page}&limit=${limit}`,
  );

  return c.html(
    <Layout title="Committees - Better HREP API">
      <h1>House Committees</h1>
      <p class="meta">
        Showing {committees.data.length} of {committees.total} committees (Page
        {" "}
        {committees.page + 1} of {committees.totalPages})
      </p>

      <div class="list-grid-single">
        {committees.data.map((committee) => (
          <div class="card">
            <h3>
              <a href={`/committees/${committee.committeeId}`}>
                {committee.name}
              </a>
            </h3>
            <p class="meta">{committee.type}</p>
            {committee.jurisdiction && (
              <p>{committee.jurisdiction.substring(0, 200)}...</p>
            )}
          </div>
        ))}
      </div>

      <Pagination
        currentPage={committees.page}
        totalPages={committees.totalPages}
        baseUrl="/committees"
        limit={limit}
      />
    </Layout>,
  );
});

// Single committee detail
pages.get("/committees/:committeeId", async (c) => {
  const committeeId = c.req.param("committeeId");

  try {
    const committee = await fetchAPI<CommitteeInfo>(
      c,
      `/committees/${committeeId}`,
    );

    // Group documents by congress
    const documentsByCongress: Record<
      number,
      Array<{ congress: number; documentKey: string }>
    > = {};

    if (committee.documents) {
      for (const doc of committee.documents) {
        if (!documentsByCongress[doc.congress]) {
          documentsByCongress[doc.congress] = [];
        }
        documentsByCongress[doc.congress].push(doc);
      }
    }

    // Sort congress numbers in descending order
    const sortedCongresses = Object.keys(documentsByCongress)
      .map(Number)
      .sort((a, b) => b - a);

    return c.html(
      <Layout title={committee.name + " - Better HREP API"}>
        <nav>
          <a href="/committees">← Back to Committees</a>
        </nav>

        <h1>{committee.name}</h1>
        <p class="meta">Committee ID: {committee.committeeId}</p>
        <p class="meta">{committee.type}</p>

        {committee.jurisdiction && (
          <>
            <h2>Jurisdiction</h2>
            <p>{committee.jurisdiction}</p>
          </>
        )}

        <h2>Contact Information</h2>
        <ul>
          {committee.phone && (
            <li>
              <strong>Phone:</strong> {committee.phone}
            </li>
          )}
          {committee.location && (
            <li>
              <strong>Location:</strong> {committee.location}
            </li>
          )}
        </ul>

        {committee.documents && committee.documents.length > 0 && (
          <>
            <h2>Documents ({committee.documents.length})</h2>
            {sortedCongresses.map((congress) => (
              <div key={congress}>
                <h3>
                  Congress {congress} ({documentsByCongress[congress].length})
                </h3>
                <ul>
                  {documentsByCongress[congress].map((doc) => (
                    <li key={doc.documentKey}>
                      <a
                        href={`/congresses/${doc.congress}/documents/${doc.documentKey}`}
                      >
                        {doc.documentKey}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        )}
      </Layout>,
    );
  } catch (_error) {
    return c.html(
      <Layout title="Committee Not Found - Better HREP API">
        <h1>Committee Not Found</h1>
        <p>The committee with ID {committeeId} was not found.</p>
        <p>
          <a href="/committees">← Back to Committees</a>
        </p>
      </Layout>,
      404,
    );
  }
});

export { pages };
