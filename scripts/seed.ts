#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Unified seed script for populating KV cache
 * Usage:
 *   deno run --allow-net --allow-env --allow-read scripts/seed.ts <operation> [congress]
 *
 * Operations:
 *   people-membership      - Index people membership data
 *   people-information     - Index people information data
 *   committees-information - Index committees information data
 *   crawl-people          - Crawl all /people pages to populate document cache
 *   index-coauthors <congress> - Index co-authors for specific congress (e.g., index-coauthors 20)
 *   index-authors <congress>   - Index primary authors for specific congress (e.g., index-authors 20)
 *   all                   - Run all seeding operations in order (except index-coauthors and index-authors)
 */

// Only load .env if running locally (file exists)
try {
  await import("@std/dotenv/load");
} catch {
  // Ignore if .env doesn't exist (e.g., in CI)
}

const DEPLOYED_API_BASE_URL = Deno.env.get("DEPLOYED_API_BASE_URL") || "http://localhost:8000/api";
const INDEXER_KEY = Deno.env.get("INDEXER_KEY");
const HREP_API_BASE_URL = Deno.env.get("HREP_API_BASE_URL");
const X_HREP_WEBSITE_BACKEND = Deno.env.get("X_HREP_WEBSITE_BACKEND");

if (!INDEXER_KEY) {
  console.error("Error: INDEXER_KEY environment variable is required");
  Deno.exit(1);
}

if (!HREP_API_BASE_URL || !X_HREP_WEBSITE_BACKEND) {
  console.error("Error: HREP_API_BASE_URL and X_HREP_WEBSITE_BACKEND environment variables are required");
  Deno.exit(1);
}

async function indexPeopleMembership() {
  console.log("\n=== Indexing People Membership ===");
  const response = await fetch(`${DEPLOYED_API_BASE_URL}/index/people/membership`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: INDEXER_KEY }),
  });

  if (!response.ok) {
    console.error(`Failed: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.error(text);
    return false;
  }

  const result = await response.json();
  console.log(`✓ Success: Indexed ${result.indexed} people memberships`);
  return true;
}

async function indexPeopleInformation() {
  console.log("\n=== Indexing People Information ===");
  const response = await fetch(`${DEPLOYED_API_BASE_URL}/index/people/information`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: INDEXER_KEY }),
  });

  if (!response.ok) {
    console.error(`Failed: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.error(text);
    return false;
  }

  const result = await response.json();
  console.log(`✓ Success: Indexed ${result.indexed} people information records`);
  return true;
}

async function indexCommitteesInformation() {
  console.log("\n=== Indexing Committees Information ===");
  const response = await fetch(`${DEPLOYED_API_BASE_URL}/index/committees/information`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: INDEXER_KEY }),
  });

  if (!response.ok) {
    console.error(`Failed: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.error(text);
    return false;
  }

  const result = await response.json();
  console.log(`✓ Success: Indexed ${result.indexed} committees`);
  return true;
}

async function crawlPeople() {
  console.log("\n=== Crawling People Pages ===");
  console.log(`API Base URL: ${DEPLOYED_API_BASE_URL}`);

  let page = 0;
  const limit = 25;
  let totalProcessed = 0;

  while (true) {
    console.log(`\nFetching page ${page}...`);

    const url = `${DEPLOYED_API_BASE_URL}/people?page=${page}&limit=${limit}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        console.error(`Failed to fetch page ${page}: ${response.status} ${response.statusText}`);
        break;
      }

      const data = await response.json();

      const peopleCount = data.data?.length || 0;
      totalProcessed += peopleCount;

      console.log(`  Processed ${peopleCount} people (total: ${totalProcessed}/${data.total})`);

      // Check if we've reached the end
      if (page >= data.totalPages - 1) {
        console.log("\nReached last page!");
        break;
      }

      page++;

    } catch (error) {
      console.error(`Error fetching page ${page}:`, error);
      break;
    }
  }

  console.log(`\n✓ Crawling complete! Total people processed: ${totalProcessed}`);
  console.log("Document authorship cache has been populated.");
  return true;
}

async function indexCoAuthors(congress: number) {
  console.log(`\n=== Indexing Co-Authors for Congress ${congress} (using /bills/search) ===`);

  // Fetch the list of all people from HREP API
  console.log("Fetching people list from HREP API...");
  const ddlResponse = await fetch(`${HREP_API_BASE_URL}/house-members/ddl-reference`, {
    headers: {
      "X-HREP-WEBSITE-BACKEND": X_HREP_WEBSITE_BACKEND!,
    },
  });

  if (!ddlResponse.ok) {
    console.error(`Failed to fetch people list: ${ddlResponse.status} ${ddlResponse.statusText}`);
    return false;
  }

  const ddlData = await ddlResponse.json();

  if (!ddlData.success || !ddlData.data) {
    console.error("Failed to fetch people list: API returned error");
    return false;
  }

  // Import mapCongressId to normalize congress IDs
  const { mapCongressId } = await import("../lib/congress-mapper.ts");

  // Filter to only people who are members of the specified congress
  const allPeople = ddlData.data;
  const people = allPeople.filter((person: any) =>
    person.membership.map(mapCongressId).includes(congress)
  );

  console.log(`Found ${people.length} people (out of ${allPeople.length} total) who are members of congress ${congress}`);

  let totalIndexed = 0;
  let processedCount = 0;

  // Process each person individually
  for (const person of people) {
    processedCount++;
    const personId = person.author_id;
    const fullName = person.fullname;

    console.log(`\n[${processedCount}/${people.length}] Processing ${personId} (${fullName})...`);

    const response = await fetch(`${DEPLOYED_API_BASE_URL}/index/documents/coauthors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: INDEXER_KEY,
        congress,
        personId,
      }),
    });

    if (!response.ok) {
      console.error(`  ✗ Failed: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error(text);
      continue; // Skip this person and continue with the next
    }

    const result = await response.json();
    console.log(`  ✓ Indexed ${result.indexed} co-author relationships`);
    totalIndexed += result.indexed;
  }

  console.log(`\n✓ Co-author indexing complete!`);
  console.log(`  Total people processed: ${processedCount}`);
  console.log(`  Total relationships indexed: ${totalIndexed}`);
  return true;
}

async function indexAuthors(congress: number) {
  console.log(`\n=== Indexing Authors for Congress ${congress} (using /bills/search) ===`);

  // Fetch the list of all people from HREP API
  console.log("Fetching people list from HREP API...");
  const ddlResponse = await fetch(`${HREP_API_BASE_URL}/house-members/ddl-reference`, {
    headers: {
      "X-HREP-WEBSITE-BACKEND": X_HREP_WEBSITE_BACKEND!,
    },
  });

  if (!ddlResponse.ok) {
    console.error(`Failed to fetch people list: ${ddlResponse.status} ${ddlResponse.statusText}`);
    return false;
  }

  const ddlData = await ddlResponse.json();

  if (!ddlData.success || !ddlData.data) {
    console.error("Failed to fetch people list: API returned error");
    return false;
  }

  // Import mapCongressId to normalize congress IDs
  const { mapCongressId } = await import("../lib/congress-mapper.ts");

  // Filter to only people who are members of the specified congress
  const allPeople = ddlData.data;
  const people = allPeople.filter((person: any) =>
    person.membership.map(mapCongressId).includes(congress)
  );

  console.log(`Found ${people.length} people (out of ${allPeople.length} total) who are members of congress ${congress}`);

  let totalIndexed = 0;
  let processedCount = 0;

  // Process each person individually
  for (const person of people) {
    processedCount++;
    const personId = person.author_id;
    const fullName = person.fullname;

    console.log(`\n[${processedCount}/${people.length}] Processing ${personId} (${fullName})...`);

    const response = await fetch(`${DEPLOYED_API_BASE_URL}/index/documents/authors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: INDEXER_KEY,
        congress,
        personId,
      }),
    });

    if (!response.ok) {
      console.error(`  ✗ Failed: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error(text);
      continue; // Skip this person and continue with the next
    }

    const result = await response.json();
    console.log(`  ✓ Indexed ${result.indexed} author relationships`);
    totalIndexed += result.indexed;
  }

  console.log(`\n✓ Author indexing complete!`);
  console.log(`  Total people processed: ${processedCount}`);
  console.log(`  Total relationships indexed: ${totalIndexed}`);
  return true;
}

// Main execution
const operation = Deno.args[0];

if (!operation) {
  console.error("Error: Operation argument is required");
  console.error("\nUsage: deno run --allow-net --allow-env --allow-read scripts/seed.ts <operation> [congress]");
  console.error("\nAvailable operations:");
  console.error("  people-membership      - Index people membership data");
  console.error("  people-information     - Index people information data");
  console.error("  committees-information - Index committees information data");
  console.error("  crawl-people          - Crawl all /people pages to populate document cache");
  console.error("  index-coauthors <congress> - Index co-authors for specific congress (e.g., index-coauthors 20)");
  console.error("  index-authors <congress>   - Index primary authors for specific congress (e.g., index-authors 20)");
  console.error("  all                   - Run all seeding operations in order (except index-coauthors and index-authors)");
  Deno.exit(1);
}

console.log(`Starting seed operation: ${operation}`);
console.log(`API Base URL: ${DEPLOYED_API_BASE_URL}`);

let success = false;

switch (operation) {
  case "people-membership":
    success = await indexPeopleMembership();
    break;

  case "people-information":
    success = await indexPeopleInformation();
    break;

  case "committees-information":
    success = await indexCommitteesInformation();
    break;

  case "crawl-people":
    success = await crawlPeople();
    break;

  case "index-coauthors": {
    const congress = parseInt(Deno.args[1], 10);
    if (isNaN(congress)) {
      console.error("Error: Congress number is required for index-coauthors operation");
      console.error("Usage: deno run --allow-net --allow-env --allow-read scripts/seed.ts index-coauthors <congress>");
      console.error("Example: deno run --allow-net --allow-env --allow-read scripts/seed.ts index-coauthors 20");
      Deno.exit(1);
    }
    success = await indexCoAuthors(congress);
    break;
  }

  case "index-authors": {
    const congress = parseInt(Deno.args[1], 10);
    if (isNaN(congress)) {
      console.error("Error: Congress number is required for index-authors operation");
      console.error("Usage: deno run --allow-net --allow-env --allow-read scripts/seed.ts index-authors <congress>");
      console.error("Example: deno run --allow-net --allow-env --allow-read scripts/seed.ts index-authors 20");
      Deno.exit(1);
    }
    success = await indexAuthors(congress);
    break;
  }

  case "all": {
    console.log("Running all seeding operations (except index-coauthors and index-authors)...");
    const membership = await indexPeopleMembership();
    const information = await indexPeopleInformation();
    const committees = await indexCommitteesInformation();
    const crawl = await crawlPeople();
    success = membership && information && committees && crawl;
    break;
  }

  default:
    console.error(`Error: Unknown operation "${operation}"`);
    console.error("\nAvailable operations: people-membership, people-information, committees-information, crawl-people, index-coauthors <congress>, index-authors <congress>, all");
    Deno.exit(1);
}

if (success) {
  console.log("\n✓ Seed operation completed successfully!");
  Deno.exit(0);
} else {
  console.error("\n✗ Seed operation failed");
  Deno.exit(1);
}
