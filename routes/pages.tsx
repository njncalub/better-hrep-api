import { Hono, Context } from "hono";
import { Layout } from "../components/Layout.tsx";
import type { Congress, PaginatedDocuments, DocumentInfo, PaginatedPeople, Person, PaginatedCommittees } from "../types/api.ts";

const pages = new Hono();

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
    <Layout title="Better HREP - Philippine House of Representatives Data">
      <h1>Better HREP</h1>
      <p>A cleaner, well-documented interface for browsing Philippine House of Representatives data.</p>

      <div class="list-grid">
        <div class="card">
          <h3><a href="/congresses">Browse Congresses</a></h3>
          <p>View all Philippine congressional sessions and their legislative documents.</p>
        </div>

        <div class="card">
          <h3><a href="/people">Browse Representatives</a></h3>
          <p>Explore current and former members of the House of Representatives.</p>
        </div>

        <div class="card">
          <h3><a href="/committees">Browse Committees</a></h3>
          <p>View all House committees and their jurisdictions.</p>
        </div>
      </div>

      <hr />

      <h2>About</h2>
      <p>
        This is a cleaner interface for the <a href="https://congress.gov.ph" target="_blank">House of Representatives website</a>.
        All data comes from the official HREP API.
      </p>
      <p>
        For developers: Check out the <a href="/api">API documentation</a> to access this data programmatically.
      </p>
    </Layout>
  );
});

// Congresses list
pages.get("/congresses", async (c) => {
  const congresses = await fetchAPI<Congress[]>(c, "/congresses");

  return c.html(
    <Layout title="Congresses - Better HREP">
      <h1>Philippine Congresses</h1>
      <p>Browse all congressional sessions of the Philippine House of Representatives.</p>

      <div class="list-grid">
        {congresses.map((congress) => (
          <div class="card">
            <h3><a href={`/congresses/${congress.id}`}>{congress.name}</a></h3>
            <p class="meta">Congress Number: {congress.id}</p>
          </div>
        ))}
      </div>
    </Layout>
  );
});

// Single congress with bills
pages.get("/congresses/:congressNumber", async (c) => {
  const congressNumber = c.req.param("congressNumber");
  const page = c.req.query("page") || "0";
  const limit = c.req.query("limit") || "20";

  const documents = await fetchAPI<PaginatedDocuments>(c, `/congresses/${congressNumber}/documents?page=${page}&limit=${limit}`);

  return c.html(
    <Layout title={congressNumber + "th Congress - Better HREP"}>
      <h1>{congressNumber}th Congress</h1>
      <p class="meta">Showing {documents.data.length} of {documents.total} bills (Page {documents.page + 1} of {documents.totalPages})</p>

      {documents.data.map((doc) => (
        <div class="card">
          <h3>
            <a href={`/congresses/${congressNumber}/bills/${doc.documentKey}`}>
              {doc.documentKey}
            </a>
          </h3>
          <p><strong>{doc.titleFull || doc.titleShort}</strong></p>
          <p class="meta">
            Filed: {doc.dateFiled} |
            {doc.authors.length} author{doc.authors.length !== 1 ? 's' : ''} |
            {doc.coAuthors.length} co-author{doc.coAuthors.length !== 1 ? 's' : ''}
          </p>
          <p class="meta">{doc.status}</p>
        </div>
      ))}

      <nav>
        <ul>
          {documents.page > 0 && (
            <li><a href={`/congresses/${congressNumber}?page=${documents.page - 1}&limit=${limit}`}>← Previous</a></li>
          )}
          {documents.page < documents.totalPages - 1 && (
            <li><a href={`/congresses/${congressNumber}?page=${documents.page + 1}&limit=${limit}`}>Next →</a></li>
          )}
        </ul>
      </nav>
    </Layout>
  );
});

// Single bill detail
pages.get("/congresses/:congressNumber/bills/:documentKey", async (c) => {
  const congressNumber = c.req.param("congressNumber");
  const documentKey = c.req.param("documentKey");

  const bill = await fetchAPI<DocumentInfo>(c, `/congresses/${congressNumber}/documents/${documentKey}`);

  return c.html(
    <Layout title={bill.documentKey + " - " + congressNumber + "th Congress - Better HREP"}>
      <nav>
        <a href={`/congresses/${congressNumber}`}>← Back to {congressNumber}th Congress</a>
      </nav>

      <h1>{bill.documentKey}</h1>
      <p class="meta">{bill.billType} | {bill.significance}</p>

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
        <li><strong>Session:</strong> {bill.sessionNumber}</li>
        <li><strong>Date Filed:</strong> {bill.dateFiled}</li>
        <li><strong>Status:</strong> {bill.status}</li>
        <li><strong>Download:</strong> <a href={bill.downloadUrl} target="_blank">PDF</a></li>
      </ul>

      <h2>Authors ({bill.authors.length})</h2>
      <div class="list-grid">
        {bill.authors.map((author) => (
          <div class="card">
            <h3><a href={`/people/${author.personId}`}>{author.firstName} {author.lastName}</a></h3>
            <p class="meta">Congresses: {author.congresses.join(", ")}</p>
          </div>
        ))}
      </div>

      {bill.coAuthors.length > 0 && (
        <>
          <h2>Co-Authors ({bill.coAuthors.length})</h2>
          <div class="list-grid">
            {bill.coAuthors.map((coAuthor) => (
              <div class="card">
                <h3><a href={`/people/${coAuthor.personId}`}>{coAuthor.firstName} {coAuthor.lastName}</a></h3>
                <p class="meta">Congresses: {coAuthor.congresses.join(", ")}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </Layout>
  );
});

// People list
pages.get("/people", async (c) => {
  const page = c.req.query("page") || "0";
  const limit = c.req.query("limit") || "20";

  const people = await fetchAPI<PaginatedPeople>(c, `/people?page=${page}&limit=${limit}`);

  return c.html(
    <Layout title="Representatives - Better HREP">
      <h1>House Representatives</h1>
      <p class="meta">Showing {people.data.length} of {people.total} representatives (Page {people.page + 1} of {people.totalPages})</p>

      <div class="list-grid">
        {people.data.map((person) => (
          <div class="card">
            <h3><a href={`/people/${person.personId}`}>{person.firstName} {person.lastName}</a></h3>
            <p class="meta">
              {person.authoredDocuments.length} authored bills |
              {person.coAuthoredDocuments.length} co-authored bills
            </p>
            <p class="meta">Congresses: {person.congresses.join(", ")}</p>
          </div>
        ))}
      </div>

      <nav>
        <ul>
          {people.page > 0 && (
            <li><a href={`/people?page=${people.page - 1}&limit=${limit}`}>← Previous</a></li>
          )}
          {people.page < people.totalPages - 1 && (
            <li><a href={`/people?page=${people.page + 1}&limit=${limit}`}>Next →</a></li>
          )}
        </ul>
      </nav>
    </Layout>
  );
});

// Single person detail
pages.get("/people/:personId", async (c) => {
  const personId = c.req.param("personId");

  const person = await fetchAPI<Person>(c, `/people/${personId}`);

  return c.html(
    <Layout title={person.firstName + " " + person.lastName + " - Better HREP"}>
      <nav>
        <a href="/people">← Back to Representatives</a>
      </nav>

      <h1>{person.firstName} {person.middleName} {person.lastName}{person.suffix ? ` ${person.suffix}` : ''}</h1>
      <p class="meta">Person ID: {person.personId}</p>
      <p class="meta">Congresses: {person.congresses.join(", ")}</p>

      <h2>Authored Bills ({person.authoredDocuments.length})</h2>
      {person.authoredDocuments.length > 0 ? (
        <div class="list-grid">
          {person.authoredDocuments.map((doc) => (
            <div class="card">
              <h3>
                <a href={`/congresses/${doc.congress}/bills/${doc.documentKey}`}>
                  {doc.documentKey}
                </a>
              </h3>
              <p class="meta">{doc.congress}th Congress</p>
            </div>
          ))}
        </div>
      ) : (
        <p>No authored bills found.</p>
      )}

      <h2>Co-Authored Bills ({person.coAuthoredDocuments.length})</h2>
      {person.coAuthoredDocuments.length > 0 ? (
        <div class="list-grid">
          {person.coAuthoredDocuments.map((doc) => (
            <div class="card">
              <h3>
                <a href={`/congresses/${doc.congress}/bills/${doc.documentKey}`}>
                  {doc.documentKey}
                </a>
              </h3>
              <p class="meta">{doc.congress}th Congress</p>
            </div>
          ))}
        </div>
      ) : (
        <p>No co-authored bills found.</p>
      )}

      {person.committees.length > 0 && (
        <>
          <h2>Committee Memberships ({person.committees.length})</h2>
          <div class="list-grid">
            {person.committees.map((committee) => (
              <div class="card">
                <h3>{committee.name}</h3>
                <p class="meta">{committee.position}</p>
                <p class="meta">{committee.congress}th Congress | {committee.journalNo}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </Layout>
  );
});

// Committees list
pages.get("/committees", async (c) => {
  const page = c.req.query("page") || "0";
  const limit = c.req.query("limit") || "20";

  const committees = await fetchAPI<PaginatedCommittees>(c, `/committees?page=${page}&limit=${limit}`);

  return c.html(
    <Layout title="Committees - Better HREP">
      <h1>House Committees</h1>
      <p class="meta">Showing {committees.data.length} of {committees.total} committees (Page {committees.page + 1} of {committees.totalPages})</p>

      {committees.data.map((committee) => (
        <div class="card">
          <h3><a href={`/committees/${committee.committeeId}`}>{committee.name}</a></h3>
          <p class="meta">{committee.type}</p>
          {committee.jurisdiction && <p>{committee.jurisdiction.substring(0, 200)}...</p>}
        </div>
      ))}

      <nav>
        <ul>
          {committees.page > 0 && (
            <li><a href={`/committees?page=${committees.page - 1}&limit=${limit}`}>← Previous</a></li>
          )}
          {committees.page < committees.totalPages - 1 && (
            <li><a href={`/committees?page=${committees.page + 1}&limit=${limit}`}>Next →</a></li>
          )}
        </ul>
      </nav>
    </Layout>
  );
});

// Single committee detail
pages.get("/committees/:committeeId", async (c) => {
  const committeeId = c.req.param("committeeId");

  // For now, we need to fetch from the list since there's no single committee endpoint
  const committees = await fetchAPI<PaginatedCommittees>(c, `/committees?page=0&limit=999`);
  const committee = committees.data.find((c) => c.committeeId === committeeId);

  if (!committee) {
    return c.html(
      <Layout title="Committee Not Found - Better HREP">
        <h1>Committee Not Found</h1>
        <p>The committee with ID {committeeId} was not found.</p>
        <p><a href="/committees">← Back to Committees</a></p>
      </Layout>,
      404
    );
  }

  return c.html(
    <Layout title={committee.name + " - Better HREP"}>
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
        {committee.phone && <li><strong>Phone:</strong> {committee.phone}</li>}
        {committee.location && <li><strong>Location:</strong> {committee.location}</li>}
      </ul>
    </Layout>
  );
});

export { pages };
