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
 *   all                   - Run all seeding operations in order
 */

// Only load .env if running locally (file exists)
try {
  await import("jsr:@std/dotenv/load");
} catch {
  // Ignore if .env doesn't exist (e.g., in CI)
}

const API_BASE_URL = Deno.env.get("API_BASE_URL") || "http://localhost:8000";
const INDEXER_KEY = Deno.env.get("INDEXER_KEY");

if (!INDEXER_KEY) {
  console.error("Error: INDEXER_KEY environment variable is required");
  Deno.exit(1);
}

async function indexPeopleMembership() {
  console.log("\n=== Indexing People Membership ===");
  const response = await fetch(`${API_BASE_URL}/index/people/membership`, {
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
  const response = await fetch(`${API_BASE_URL}/index/people/information`, {
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
  const response = await fetch(`${API_BASE_URL}/index/committees/information`, {
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
  console.log(`API Base URL: ${API_BASE_URL}`);

  let page = 0;
  const limit = 25;
  let totalProcessed = 0;

  while (true) {
    console.log(`\nFetching page ${page}...`);

    const url = `${API_BASE_URL}/people?page=${page}&limit=${limit}`;

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
  console.error("  all                   - Run all seeding operations in order");
  Deno.exit(1);
}

console.log(`Starting seed operation: ${operation}`);
console.log(`API Base URL: ${API_BASE_URL}`);

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

  case "all":
    console.log("Running all seeding operations...");
    const membership = await indexPeopleMembership();
    const information = await indexPeopleInformation();
    const committees = await indexCommitteesInformation();
    const crawl = await crawlPeople();
    success = membership && information && committees && crawl;
    break;

  default:
    console.error(`Error: Unknown operation "${operation}"`);
    console.error("\nAvailable operations: people-membership, people-information, committees-information, crawl-people, all");
    Deno.exit(1);
}

if (success) {
  console.log("\n✓ Seed operation completed successfully!");
  Deno.exit(0);
} else {
  console.error("\n✗ Seed operation failed");
  Deno.exit(1);
}
