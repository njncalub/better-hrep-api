# Better HREP API

A cleaner, well-documented proxy API for the [House of Representatives website](https://congress.gov.ph).

The original HREP API is poorly designed with inconsistent data structures, confusing IDs, and unclear field names. This proxy provides a clean, RESTful interface with proper documentation, normalized data, and OpenAPI/Swagger support.

## Prerequisites

- [Deno](https://deno.land/) 2.5 or later

**Install Deno:**
```bash
# macOS/Linux
curl -fsSL https://deno.land/install.sh | sh

# Windows (PowerShell)
irm https://deno.land/install.ps1 | iex
```

## Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Follow the instructions in `.env.example` to get your API credentials from the HREP website.

3. Run the development server:
   ```bash
   deno task start
   ```

4. Visit `http://localhost:8000` to see the Swagger UI documentation.

## API Endpoints

### GET /congress

Returns a list of all congress sessions, sorted by congress number (descending).

**Response:**
```json
[
  {
    "id": 20,
    "name": "20th Congress"
  },
  {
    "id": 19,
    "name": "19th Congress"
  }
]
```

**Note:** The original API uses ID `103` for the 20th Congress. This is automatically normalized to `20`.

### GET /people

Returns a paginated list of house members with their authored bills, co-authored bills, and committees.

**Query Parameters:**
- `page` (optional): Page number, 0-indexed. Default: `0`
- `limit` (optional): Items per page. Default: `100`

**Example:** `GET /people?page=0&limit=10`

**Response:**
```json
{
  "page": 0,
  "limit": 10,
  "total": 1126,
  "totalPages": 113,
  "data": [
    {
      "id": 536,
      "personId": "E001",
      "lastName": "ABAD",
      "firstName": "HENEDINA",
      "middleName": "R.",
      "suffix": null,
      "nickName": "DINA",
      "authoredDocuments": [
        {
          "congress": 17,
          "documentKey": "HB02385"
        },
        {
          "congress": 20,
          "documentKey": "HB01234"
        }
      ],
      "coAuthoredDocuments": [
        {
          "congress": 19,
          "documentKey": "HB05678"
        }
      ],
      "committees": [
        {
          "congress": 20,
          "committeeId": "0501",
          "position": "Member for the Majority",
          "journalNo": "Journal No. 007"
        }
      ]
    }
  ]
}
```

### GET /people/:personId

Returns details for a specific house member by their person ID.

**Path Parameters:**
- `personId`: Unique person identifier (e.g., `E001`)

**Example:** `GET /people/E001`

**Response:**
```json
{
  "id": 536,
  "personId": "E001",
  "lastName": "ABAD",
  "firstName": "HENEDINA",
  "middleName": "R.",
  "suffix": null,
  "nickName": "DINA",
  "congressMemberships": [20, 19, 17, 16, 15, 13],
  "authoredDocuments": [...],
  "coAuthoredDocuments": [...],
  "committees": [...]
}
```

## Development

### Running the API

```bash
deno task start
```

### Testing endpoints

Use the included fetch script to test the original HREP API:

```bash
# GET request
deno task fetch /system-config/reference-congress

# POST request
deno task fetch /house-members/list POST '{"page":0,"limit":10,"filter":""}'
```

## Key Features

- **OpenAPI/Swagger Documentation** - Interactive API docs at `/`
- **Type Safety** - Full TypeScript support with Zod validation
- **Data Normalization** - Fixes inconsistent IDs and field names
- **Pagination** - Generic pagination support for all list endpoints
- **Congress ID Mapping** - Automatically handles the 103→20 congress mapping

## Why This Exists

The original HREP API has several issues:
- Uses `103` as the ID for the 20th Congress (should be `20`)
- Inconsistent field naming (`period_from` vs `date_from`)
- No documentation or OpenAPI spec
- POST requests where GET would be more appropriate
- Nested data structures that are hard to work with

This proxy fixes all of these issues while maintaining compatibility with the source API.

## Source API Endpoints

These are the original HREP API endpoints that this proxy wraps. You can test them directly using `deno task fetch`.

### GET /system-config/reference-congress

Returns congress session reference data used for dropdown filters.

**Proxied by:** `GET /congress`

**Example:**
```bash
deno task fetch /system-config/reference-congress
```

**Issues:**
- Uses ID `103` for 20th Congress instead of `20`
- Inconsistent date fields (`period_from`/`period_to` vs `date_from`/`date_to`)
- Includes `[All Congress]` item with ID `0`

### POST /house-members/list

Returns a paginated list of house members with their details and principal authored bills.

**Proxied by:** `GET /people`

**Payload:**
```json
{
  "page": 0,
  "limit": 100,
  "filter": ""
}
```

**Example:**
```bash
deno task fetch /house-members/list POST '{"page":0,"limit":10,"filter":""}'
```

**Issues:**
- Uses POST instead of GET for a read-only operation
- Some members have `principal_authored_bills: null`
- Deeply nested data structure
- Includes many unused fields (`memberships`, `committee_membership`, `logs`, etc.)

### POST /house-members/principal-author

Returns a paginated list of bills principally authored by a specific house member.

**Proxied by:** `GET /people` and `GET /people/:personId`

**Payload:**
```json
{
  "page": 0,
  "limit": 1000,
  "filter": "",
  "author": "E001"
}
```

**Example:**
```bash
deno task fetch /house-members/principal-author POST '{"page":0,"limit":10,"filter":"","author":"E001"}'
```

**Issues:**
- Uses POST instead of GET for a read-only operation
- Often returns 500 errors for members without bills
- Data doesn't always match the `principal_authored_bills` field from `/house-members/list`

**Note:** This endpoint is unreliable and returns inconsistent data. The proxy uses `POST /bills/search` with `author_type: "authorship"` instead for more accurate and consistent results.

### POST /house-members/co-author

Returns a paginated list of bills co-authored by a specific house member.

**Proxied by:** `GET /people` (included in response)

**Payload:**
```json
{
  "page": 0,
  "limit": 1000,
  "filter": "",
  "author": "E001"
}
```

**Example:**
```bash
deno task fetch /house-members/co-author POST '{"page":0,"limit":10,"filter":"","author":"E001"}'
```

**Issues:**
- Uses POST instead of GET for a read-only operation
- Often returns 500 errors for members without co-authored bills
- Similar structure to principal authored bills but requires separate request

**Note:** This endpoint is unreliable and returns inconsistent data. The proxy uses `POST /bills/search` with `author_type: "coauthorship"` instead for more accurate results.

### POST /house-members/committee-membership

Returns committee memberships for a specific house member.

**Proxied by:** `GET /people` (included in response)

**Payload:**
```json
{
  "member_code": "E001"
}
```

**Example:**
```bash
deno task fetch /house-members/committee-membership POST '{"member_code":"E001"}'
```

**Response:**
```json
{
  "status": 200,
  "success": true,
  "data": {
    "count": 1,
    "rows": [
      {
        "no": "17",
        "congress": 103,
        "committee_code": "0501",
        "name": "ACCOUNTS",
        "author_id": "K119",
        "representative": "ACIDRE, JUDE A.",
        "title": "Member for the Majority",
        "photo": { ... },
        "journal_no": "Journal No. 007"
      }
    ]
  }
}
```

**Issues:**
- Uses POST instead of GET for a read-only operation
- Returns empty arrays for most members (possibly only current members have data)
- Response structure is not paginated but uses similar `count`/`rows` pattern

**Note:** The proxy automatically fetches committee memberships for each member and includes them in the `committees` field. If the endpoint fails or returns no data, an empty array is returned.

### GET /house-members/ddl-reference

Returns a simplified list of house members with their congress memberships. Used for dropdown lists (DDL = Drop Down List).

**Proxied by:** `POST /index/people/membership` (for caching)

**Example:**
```bash
deno task fetch /house-members/ddl-reference
```

**Response:**
```json
{
  "status": 200,
  "success": true,
  "data": [
    {
      "id": 536,
      "author_id": "E001",
      "fullname": "ABAD, HENEDINA R.",
      "nick_name": "DINA",
      "membership": [17, 16, 15, 13]
    }
  ]
}
```

**Issues:**
- Uses raw congress IDs (needs normalization, e.g., 103 → 20)
- Limited information (only membership and basic name data)

**Note:** The proxy uses this endpoint to cache congress memberships for fast lookups. Congress IDs are automatically normalized using the congress mapper.

### POST /bills/search

Searches for bills with advanced filtering options. This is the most reliable endpoint for fetching authored and co-authored bills.

**Proxied by:** `GET /people` and `GET /people/:personId` (for documents)

**Payload:**
```json
{
  "page": 0,
  "limit": 999,
  "congress": 103,
  "significance": "Both",
  "field": "Author",
  "numbers": "",
  "author_id": "E001",
  "author_type": "authorship",
  "committee_id": "",
  "title": ""
}
```

**Parameters:**
- `author_type`: `"authorship"` (principal author), `"coauthorship"` (co-author), or `"Both"`
- `congress`: Congress number (use raw API ID, e.g., 103 for 20th Congress)
- `field`: Search field (`"Author"` for author search)

**Example:**
```bash
# Authored bills
deno task fetch /bills/search POST '{"page":0,"limit":10,"congress":103,"significance":"Both","field":"Author","numbers":"","author_id":"E001","author_type":"authorship","committee_id":"","title":""}'

# Co-authored bills
deno task fetch /bills/search POST '{"page":0,"limit":10,"congress":103,"significance":"Both","field":"Author","numbers":"","author_id":"E001","author_type":"coauthorship","committee_id":"","title":""}'
```

**Advantages:**
- More reliable than `/house-members/principal-author` and `/house-members/co-author`
- Consistent data structure
- Supports filtering by congress
- Returns detailed bill information

**Note:** The proxy uses this endpoint to fetch authored and co-authored documents for each member, querying all congress sessions in parallel for better performance.

### POST /committee/list

Returns a paginated list of committees with their details.

**Proxied by:** `POST /index/committees/information` (for caching)

**Payload:**
```json
{
  "page": 0,
  "limit": 100
}
```

**Example:**
```bash
deno task fetch /committee/list POST '{"page":0,"limit":10}'
```

**Response:**
```json
{
  "status": 200,
  "success": true,
  "data": {
    "pageCount": 85,
    "count": 85,
    "rows": [
      {
        "id": 40,
        "code": "0543",
        "name": "YOUTH AND SPORTS DEVELOPMENT",
        "jurisdiction": "All matters directly and principally relating to...",
        "location": "3rd Floor Ramon V. Mitra Bldg., House of Representatives, Quezon City",
        "phone": "(02) 8-9514326  DIRECT LINE, (02) 8-9315001 LOCAL 7149 TRUNK LINE",
        "committee_secretary": "Ms.  Percie D. Managuelod",
        "members": "50 Members",
        "profile_data": "",
        "email": "committee.youthandsports@house.gov.ph",
        "type": 76,
        "type_desc": "Standing Committees",
        "chairperson": "DY, FAUSTINO MICHAEL CARLOS III T."
      }
    ]
  }
}
```

**Issues:**
- Some committees have `null` as their `code` value (these are skipped during indexing)
- Response structure uses `pageCount` instead of `totalPages`

**Note:** The proxy uses this endpoint to cache committee information to Deno KV. Committees without a code are skipped since KV keys cannot contain null values.

## Automated Indexing

The API includes automated monthly indexing via GitHub Actions to keep the cache updated.

### GitHub Secrets Setup

Configure the following secrets in your GitHub repository settings:

1. **`API_BASE_URL`** - Your deployed API URL (e.g., `https://your-api.deno.dev`)
2. **`INDEXER_KEY`** - The indexer authentication key from your `.env` file

**To add secrets:**
1. Go to your repository on GitHub
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add both `API_BASE_URL` and `INDEXER_KEY`

### Manual Indexing Trigger

You can manually trigger the indexing workflow:
1. Go to the "Actions" tab in your GitHub repository
2. Select "Monthly Data Indexing" workflow
3. Click "Run workflow"

### Indexing Schedule

The workflow runs automatically on the 1st of every month at 2:00 AM UTC. It performs:
1. Index people membership data
2. Index people information data
3. Index committees information data

## Impostor Syndrome Disclaimer

**We want your help. No, really.**

There may be a little voice inside your head that is telling you that you're not
ready to be an open source contributor; that your skills aren't nearly good
enough to contribute. What could you possibly offer a project like this one?

We assure you - the little voice in your head is wrong. If you can write code at
all, you can contribute code to open source. Contributing to open source
projects is a fantastic way to advance one's coding skills. Writing perfect code
isn't the measure of a good developer (that would disqualify all of us!); it's
trying to create something, making mistakes, and learning from those mistakes.
That's how we all improve, and we are happy to help others learn.

Being an open source contributor doesn't just mean writing code, either. You can
help out by writing documentation, tests, or even giving feedback about the
project (and yes - that includes giving feedback about the contribution
process). Some of these contributions may be the most valuable to the project as
a whole, because you're coming to the project with fresh eyes, so you can see
the errors and assumptions that seasoned contributors have glossed over.

**Remember:**

- No contribution is too small
- Everyone started somewhere
- Questions are welcome
- Mistakes are learning opportunities
- Your perspective is valuable

(Impostor syndrome disclaimer adapted from
[Adrienne Friend](https://github.com/adriennefriend/imposter-syndrome-disclaimer))

## License

This repository is dedicated to the public domain under **CC0 1.0 Universal (CC0
1.0) Public Domain Dedication**.

You can copy, modify, distribute and perform the work, even for commercial
purposes, all without asking permission.

- No Copyright
- No Rights Reserved
- No Attribution Required

For more information, see the
[CC0 1.0 Universal license](https://creativecommons.org/publicdomain/zero/1.0/).