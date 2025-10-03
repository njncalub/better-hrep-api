# Better HREP API

A cleaner, well-documented proxy API for the [House of Representatives website](https://congress.gov.ph).

The original HREP API is poorly designed with inconsistent data structures, confusing IDs, and unclear field names. This proxy provides a clean, RESTful interface with proper documentation, normalized data, and OpenAPI/Swagger support.

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

Returns a paginated list of house members with their principal authored bills.

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
      "authorId": "E001",
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
      ]
    }
  ]
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

### Project Structure

```
├── lib/
│   ├── api-client.ts       # HTTP client for source API
│   └── congress-mapper.ts  # Congress ID normalization (103 → 20)
├── routes/
│   ├── congress.ts         # GET /congress
│   └── people.ts           # GET /people
├── scripts/
│   └── fetch-api.ts        # CLI tool for testing source API
├── types/
│   ├── api.ts              # Clean API response types (Zod schemas)
│   └── source.ts           # Source API response types
└── main.ts                 # App entry point
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

**Note:** The proxy automatically fetches co-authored bills for each member and includes them in the `coAuthoredDocuments` field. If the endpoint fails, an empty array is returned.


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