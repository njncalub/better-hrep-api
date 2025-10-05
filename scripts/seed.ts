#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Unified seed script for populating KV cache
 * Usage:
 *   deno run --allow-net --allow-env --allow-read scripts/seed.ts <operation>
 *
 * Operations:
 *   people-membership      - Index people membership data
 *   people-information     - Index people information data
 *   committees-information - Index committees information data
 *   crawl-people          - Crawl all /people pages to populate document cache
 *   index-coauthors       - Index co-authors using /bills/search (chunks of 10 people)
 *   all                   - Run all seeding operations in order
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

async function indexCoAuthors() {
  console.log("\n=== Indexing Co-Authors (using /bills/search) ===");

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

  const people = ddlData.data;
  console.log(`Found ${people.length} people to process`);

  let totalIndexed = 0;
  let processedCount = 0;

  // Process each person individually
  for (const person of people) {
    processedCount++;
    const personId = person.author_id;
    const fullName = person.fullname;

    console.log(`\n[${processedCount}/${people.length}] Processing ${personId} (${fullName})...`);

    const response = await fetch(`${DEPLOYED_API_BASE_URL}/index/people/coauthors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: INDEXER_KEY,
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

// Main execution
const operation = Deno.args[0];

if (!operation) {
  console.error("Error: Operation argument is required");
  console.error("\nUsage: deno run --allow-net --allow-env --allow-read scripts/seed.ts <operation>");
  console.error("\nAvailable operations:");
  console.error("  people-membership      - Index people membership data");
  console.error("  people-information     - Index people information data");
  console.error("  committees-information - Index committees information data");
  console.error("  crawl-people          - Crawl all /people pages to populate document cache");
  console.error("  index-coauthors       - Index co-authors using /bills/search (chunks of 10 people)");
  console.error("  all                   - Run all seeding operations in order");
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

  case "index-coauthors":
    success = await indexCoAuthors();
    break;

  case "all": {
    console.log("Running all seeding operations...");
    const membership = await indexPeopleMembership();
    const information = await indexPeopleInformation();
    const committees = await indexCommitteesInformation();
    const crawl = await crawlPeople();
    const coauthors = await indexCoAuthors();
    success = membership && information && committees && crawl && coauthors;
    break;
  }

  default:
    console.error(`Error: Unknown operation "${operation}"`);
    console.error("\nAvailable operations: people-membership, people-information, committees-information, crawl-people, index-coauthors, all");
    Deno.exit(1);
}

if (success) {
  console.log("\n✓ Seed operation completed successfully!");
  Deno.exit(0);
} else {
  console.error("\n✗ Seed operation failed");
  Deno.exit(1);
}
