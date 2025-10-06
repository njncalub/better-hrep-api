#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Unified seed script for populating KV cache
 * Usage:
 *   deno run --allow-net --allow-env --allow-read scripts/seed.ts <operation> [congress]
 *
 * Operations:
 *   people-membership           - Index people membership data
 *   people-information          - Index people information data
 *   committees-information      - Index committees information data
 *   index-coauthors <congress>  - Index co-authors for specific congress (e.g., index-coauthors 20)
 *   index-authors <congress>    - Index primary authors for specific congress (e.g., index-authors 20)
 *   index-committees <congress> - Index committees for specific congress (e.g., index-committees 20)
 *   all                         - Run all seeding operations in order (except index-coauthors, index-authors, and index-committees)
 */

// Only load .env if running locally (file exists)
try {
  await import("@std/dotenv/load");
} catch {
  // Ignore if .env doesn't exist (e.g., in CI)
}

const DEPLOYED_API_BASE_URL = Deno.env.get("DEPLOYED_API_BASE_URL") ||
  "http://localhost:8000/api";
const INDEXER_KEY = Deno.env.get("INDEXER_KEY");
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
const GITHUB_REPOSITORY = Deno.env.get("GITHUB_REPOSITORY") ||
  "njncalub/better-hrep-api";

if (!INDEXER_KEY) {
  console.error("Error: INDEXER_KEY environment variable is required");
  Deno.exit(1);
}

interface CommitteeData {
  id: number;
  committeeId: string;
  name: string;
}

/**
 * Exponential backoff retry utility
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 5000,
): Promise<{ success: boolean; data?: T; error?: string }> {
  let lastError: string = "";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      return { success: true, data: result };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`    ⚠️  Attempt ${attempt + 1} failed: ${lastError}`);
        console.log(`    ⏳ Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  return { success: false, error: lastError };
}

/**
 * Create a GitHub issue for failed indexing, or update existing one
 */
async function createGitHubIssue(
  title: string,
  body: string,
  uniqueLabel: string,
): Promise<boolean> {
  if (!GITHUB_TOKEN) {
    console.log("    ℹ️  GITHUB_TOKEN not set, skipping issue creation");
    return false;
  }

  try {
    // Search for existing issues with this unique label
    const searchQuery = encodeURIComponent(
      `repo:${GITHUB_REPOSITORY} label:indexing-error label:${uniqueLabel}`,
    );
    const searchResponse = await fetch(
      `https://api.github.com/search/issues?q=${searchQuery}`,
      {
        headers: {
          "Authorization": `Bearer ${GITHUB_TOKEN}`,
          "Accept": "application/vnd.github+json",
        },
      },
    );

    if (!searchResponse.ok) {
      console.log(
        `    ⚠️  Failed to search for existing issues: ${searchResponse.status}`,
      );
      // Fall through to create new issue
    } else {
      const searchResults = await searchResponse.json();

      if (searchResults.total_count > 0) {
        const existingIssue = searchResults.items[0];
        const isOpen = existingIssue.state === "open";

        // Add a comment to the existing issue
        const commentBody = `## Update: ${new Date().toISOString()}

${body}

---
*This issue was automatically updated by the indexing workflow.*`;

        const commentResponse = await fetch(existingIssue.comments_url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${GITHUB_TOKEN}`,
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ body: commentBody }),
        });

        if (!commentResponse.ok) {
          console.log(
            `    ⚠️  Failed to comment on issue: ${commentResponse.status}`,
          );
          return false;
        }

        // If closed, reopen it
        if (!isOpen) {
          const reopenResponse = await fetch(existingIssue.url, {
            method: "PATCH",
            headers: {
              "Authorization": `Bearer ${GITHUB_TOKEN}`,
              "Accept": "application/vnd.github+json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ state: "open" }),
          });

          if (!reopenResponse.ok) {
            console.log(
              `    ⚠️  Failed to reopen issue: ${reopenResponse.status}`,
            );
          } else {
            console.log(
              `    ✓ Reopened and updated issue: ${existingIssue.html_url}`,
            );
            return true;
          }
        }

        console.log(`    ✓ Updated existing issue: ${existingIssue.html_url}`);
        return true;
      }
    }

    // No existing issue found, create a new one
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPOSITORY}/issues`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GITHUB_TOKEN}`,
          "Accept": "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          body,
          labels: ["indexing-error", "automated", uniqueLabel],
        }),
      },
    );

    if (!response.ok) {
      console.log(
        `    ⚠️  Failed to create GitHub issue: ${response.status} ${response.statusText}`,
      );
      return false;
    }

    const issue = await response.json();
    console.log(`    ✓ Created GitHub issue: ${issue.html_url}`);
    return true;
  } catch (error) {
    console.log(
      `    ⚠️  Error creating GitHub issue: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return false;
  }
}

async function indexPeopleMembership() {
  console.log("\n=== Indexing People Membership ===");
  const response = await fetch(
    `${DEPLOYED_API_BASE_URL}/index/people/membership`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: INDEXER_KEY }),
    },
  );

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
  const response = await fetch(
    `${DEPLOYED_API_BASE_URL}/index/people/information`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: INDEXER_KEY }),
    },
  );

  if (!response.ok) {
    console.error(`Failed: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.error(text);
    return false;
  }

  const result = await response.json();
  console.log(
    `✓ Success: Indexed ${result.indexed} people information records`,
  );
  return true;
}

async function indexCommitteesInformation() {
  console.log("\n=== Indexing Committees Information ===");
  const response = await fetch(
    `${DEPLOYED_API_BASE_URL}/index/committees/information`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: INDEXER_KEY }),
    },
  );

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

async function indexCoAuthors(congress: number) {
  console.log(
    `\n=== Indexing Co-Authors for Congress ${congress} (using /bills/search) ===`,
  );

  // Fetch congress membership data from our own API
  console.log("Fetching people list from API...");
  const infoResponse = await fetch(`${DEPLOYED_API_BASE_URL}/info/people`);

  if (!infoResponse.ok) {
    console.error(
      `Failed to fetch people list: ${infoResponse.status} ${infoResponse.statusText}`,
    );
    return false;
  }

  const infoData = await infoResponse.json();

  if (!infoData.success || !infoData.data) {
    console.error("Failed to fetch people list: API returned error");
    return false;
  }

  // Get array of person IDs for this congress
  const personIds = infoData.data[congress.toString()] ?? [];

  console.log(
    `Found ${personIds.length} people who are members of congress ${congress}`,
  );

  let totalIndexed = 0;
  let processedCount = 0;

  // Process each person individually
  const failedItems: Array<{ personId: string; error: string }> = [];

  for (const personId of personIds) {
    processedCount++;

    console.log(
      `\n[${processedCount}/${personIds.length}] Processing ${personId}...`,
    );

    const retryResult = await retryWithBackoff(async () => {
      const response = await fetch(
        `${DEPLOYED_API_BASE_URL}/index/documents/coauthors`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: INDEXER_KEY,
            congress,
            personId,
          }),
        },
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${response.status} ${response.statusText}\n${text}`);
      }

      return await response.json();
    });

    if (!retryResult.success) {
      console.error(`  ✗ Failed after 3 retries: ${retryResult.error}`);
      failedItems.push({
        personId,
        error: retryResult.error || "Unknown error",
      });
      continue;
    }

    const result = retryResult.data!;
    console.log(`  ✓ Indexed ${result.indexed} co-author relationships`);
    totalIndexed += result.indexed;
  }

  // Create GitHub issues for failed items
  if (failedItems.length > 0) {
    console.log(
      `\n⚠️  ${failedItems.length} items failed. Creating GitHub issues...`,
    );
    for (const { personId, error } of failedItems) {
      const title =
        `[Indexing Error] Failed to index co-authors for person ${personId} in congress ${congress}`;
      const body = `## Indexing Error

**Operation:** Index Co-Authors
**Congress:** ${congress}
**Person ID:** ${personId}

**Error:**
\`\`\`
${error}
\`\`\`

**Details:**
- Failed after 3 retry attempts with exponential backoff
- Timestamp: ${new Date().toISOString()}

**Action Required:**
Please investigate why the indexing failed for this person and re-run the indexing operation manually if needed.

**Manual Re-run Command:**
\`\`\`bash
deno task seed index-coauthors ${congress}
\`\`\`

Or via API:
\`\`\`bash
curl -X POST ${DEPLOYED_API_BASE_URL}/index/documents/coauthors \\
  -H "Content-Type: application/json" \\
  -d '{"key": "YOUR_INDEXER_KEY", "congress": ${congress}, "personId": "${personId}"}'
\`\`\`
`;
      await createGitHubIssue(
        title,
        body,
        `coauthors-${personId}-congress-${congress}`,
      );
    }
  }

  console.log(`\n✓ Co-author indexing complete!`);
  console.log(`  Total people processed: ${processedCount}`);
  console.log(`  Total relationships indexed: ${totalIndexed}`);
  return true;
}

async function indexAuthors(congress: number) {
  console.log(
    `\n=== Indexing Authors for Congress ${congress} (using /bills/search) ===`,
  );

  // Fetch congress membership data from our own API
  console.log("Fetching people list from API...");
  const infoResponse = await fetch(`${DEPLOYED_API_BASE_URL}/info/people`);

  if (!infoResponse.ok) {
    console.error(
      `Failed to fetch people list: ${infoResponse.status} ${infoResponse.statusText}`,
    );
    return false;
  }

  const infoData = await infoResponse.json();

  if (!infoData.success || !infoData.data) {
    console.error("Failed to fetch people list: API returned error");
    return false;
  }

  // Get array of person IDs for this congress
  const personIds = infoData.data[congress.toString()] ?? [];

  console.log(
    `Found ${personIds.length} people who are members of congress ${congress}`,
  );

  let totalIndexed = 0;
  let processedCount = 0;

  // Process each person individually
  const failedItems: Array<{ personId: string; error: string }> = [];

  for (const personId of personIds) {
    processedCount++;

    console.log(
      `\n[${processedCount}/${personIds.length}] Processing ${personId}...`,
    );

    const retryResult = await retryWithBackoff(async () => {
      const response = await fetch(
        `${DEPLOYED_API_BASE_URL}/index/documents/authors`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: INDEXER_KEY,
            congress,
            personId,
          }),
        },
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${response.status} ${response.statusText}\n${text}`);
      }

      return await response.json();
    });

    if (!retryResult.success) {
      console.error(`  ✗ Failed after 3 retries: ${retryResult.error}`);
      failedItems.push({
        personId,
        error: retryResult.error || "Unknown error",
      });
      continue;
    }

    const result = retryResult.data!;
    console.log(`  ✓ Indexed ${result.indexed} author relationships`);
    totalIndexed += result.indexed;
  }

  // Create GitHub issues for failed items
  if (failedItems.length > 0) {
    console.log(
      `\n⚠️  ${failedItems.length} items failed. Creating GitHub issues...`,
    );
    for (const { personId, error } of failedItems) {
      const title =
        `[Indexing Error] Failed to index authors for person ${personId} in congress ${congress}`;
      const body = `## Indexing Error

**Operation:** Index Authors
**Congress:** ${congress}
**Person ID:** ${personId}

**Error:**
\`\`\`
${error}
\`\`\`

**Details:**
- Failed after 3 retry attempts with exponential backoff
- Timestamp: ${new Date().toISOString()}

**Action Required:**
Please investigate why the indexing failed for this person and re-run the indexing operation manually if needed.

**Manual Re-run Command:**
\`\`\`bash
deno task seed index-authors ${congress}
\`\`\`

Or via API:
\`\`\`bash
curl -X POST ${DEPLOYED_API_BASE_URL}/index/documents/authors \\
  -H "Content-Type: application/json" \\
  -d '{"key": "YOUR_INDEXER_KEY", "congress": ${congress}, "personId": "${personId}"}'
\`\`\`
`;
      await createGitHubIssue(
        title,
        body,
        `authors-${personId}-congress-${congress}`,
      );
    }
  }

  console.log(`\n✓ Author indexing complete!`);
  console.log(`  Total people processed: ${processedCount}`);
  console.log(`  Total relationships indexed: ${totalIndexed}`);
  return true;
}

async function indexCommittees(congress: number) {
  console.log(
    `\n=== Indexing Committees for Congress ${congress} (using /bills/search) ===`,
  );

  // Fetch all committees from the API
  console.log("Fetching committee list from API...");

  let allCommittees: Array<{ id: number; code: string; name: string }> = [];
  let page = 0;
  const limit = 100;

  // Fetch all committees (paginated)
  while (true) {
    const response = await fetch(
      `${DEPLOYED_API_BASE_URL}/committees?page=${page}&limit=${limit}`,
    );

    if (!response.ok) {
      console.error(
        `Failed to fetch committees: ${response.status} ${response.statusText}`,
      );
      return false;
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      break;
    }

    allCommittees = allCommittees.concat(data.data.map((c: CommitteeData) => ({
      id: c.id,
      code: c.committeeId,
      name: c.name,
    })));

    // Check if we've reached the end
    if (page >= data.totalPages - 1) {
      break;
    }

    page++;
  }

  console.log(`Found ${allCommittees.length} committees`);

  let totalIndexed = 0;
  let processedCount = 0;

  // Process each committee
  const failedItems: Array<
    { committeeId: string; committeeName: string; error: string }
  > = [];

  for (const committee of allCommittees) {
    processedCount++;

    console.log(
      `\n[${processedCount}/${allCommittees.length}] Processing ${committee.code} (${committee.name})...`,
    );

    const retryResult = await retryWithBackoff(async () => {
      const response = await fetch(
        `${DEPLOYED_API_BASE_URL}/index/documents/committees`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: INDEXER_KEY,
            congress,
            committeeId: committee.code,
          }),
        },
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${response.status} ${response.statusText}\n${text}`);
      }

      return await response.json();
    });

    if (!retryResult.success) {
      console.error(`  ✗ Failed after 3 retries: ${retryResult.error}`);
      failedItems.push({
        committeeId: committee.code,
        committeeName: committee.name,
        error: retryResult.error || "Unknown error",
      });
      continue;
    }

    const result = retryResult.data!;
    console.log(
      `  ✓ Indexed ${result.indexed} committee-document relationships`,
    );
    totalIndexed += result.indexed;
  }

  // Create GitHub issues for failed items
  if (failedItems.length > 0) {
    console.log(
      `\n⚠️  ${failedItems.length} items failed. Creating GitHub issues...`,
    );
    for (const { committeeId, committeeName, error } of failedItems) {
      const title =
        `[Indexing Error] Failed to index committee ${committeeId} in congress ${congress}`;
      const body = `## Indexing Error

**Operation:** Index Committees
**Congress:** ${congress}
**Committee ID:** ${committeeId}
**Committee Name:** ${committeeName}

**Error:**
\`\`\`
${error}
\`\`\`

**Details:**
- Failed after 3 retry attempts with exponential backoff
- Timestamp: ${new Date().toISOString()}

**Action Required:**
Please investigate why the indexing failed for this committee and re-run the indexing operation manually if needed.

**Manual Re-run Command:**
\`\`\`bash
deno task seed index-committees ${congress}
\`\`\`

Or via API:
\`\`\`bash
curl -X POST ${DEPLOYED_API_BASE_URL}/index/documents/committees \\
  -H "Content-Type: application/json" \\
  -d '{"key": "YOUR_INDEXER_KEY", "congress": ${congress}, "committeeId": "${committeeId}"}'
\`\`\`
`;
      await createGitHubIssue(
        title,
        body,
        `committee-${committeeId}-congress-${congress}`,
      );
    }
  }

  console.log(`\n✓ Committee indexing complete!`);
  console.log(`  Total committees processed: ${processedCount}`);
  console.log(`  Total relationships indexed: ${totalIndexed}`);
  return true;
}

// Main execution
const operation = Deno.args[0];

if (!operation) {
  console.error("Error: Operation argument is required");
  console.error(
    "\nUsage: deno run --allow-net --allow-env --allow-read scripts/seed.ts <operation> [congress]",
  );
  console.error("\nAvailable operations:");
  console.error("  people-membership      - Index people membership data");
  console.error("  people-information     - Index people information data");
  console.error("  committees-information - Index committees information data");
  console.error(
    "  index-coauthors <congress>  - Index co-authors for specific congress (e.g., index-coauthors 20)",
  );
  console.error(
    "  index-authors <congress>    - Index primary authors for specific congress (e.g., index-authors 20)",
  );
  console.error(
    "  index-committees <congress> - Index committees for specific congress (e.g., index-committees 20)",
  );
  console.error(
    "  all                    - Run all seeding operations in order (except index-coauthors, index-authors, and index-committees)",
  );
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

  case "index-coauthors": {
    const congress = parseInt(Deno.args[1], 10);
    if (isNaN(congress)) {
      console.error(
        "Error: Congress number is required for index-coauthors operation",
      );
      console.error(
        "Usage: deno run --allow-net --allow-env --allow-read scripts/seed.ts index-coauthors <congress>",
      );
      console.error(
        "Example: deno run --allow-net --allow-env --allow-read scripts/seed.ts index-coauthors 20",
      );
      Deno.exit(1);
    }
    success = await indexCoAuthors(congress);
    break;
  }

  case "index-authors": {
    const congress = parseInt(Deno.args[1], 10);
    if (isNaN(congress)) {
      console.error(
        "Error: Congress number is required for index-authors operation",
      );
      console.error(
        "Usage: deno run --allow-net --allow-env --allow-read scripts/seed.ts index-authors <congress>",
      );
      console.error(
        "Example: deno run --allow-net --allow-env --allow-read scripts/seed.ts index-authors 20",
      );
      Deno.exit(1);
    }
    success = await indexAuthors(congress);
    break;
  }

  case "index-committees": {
    const congress = parseInt(Deno.args[1], 10);
    if (isNaN(congress)) {
      console.error(
        "Error: Congress number is required for index-committees operation",
      );
      console.error(
        "Usage: deno run --allow-net --allow-env --allow-read scripts/seed.ts index-committees <congress>",
      );
      console.error(
        "Example: deno run --allow-net --allow-env --allow-read scripts/seed.ts index-committees 20",
      );
      Deno.exit(1);
    }
    success = await indexCommittees(congress);
    break;
  }

  case "all": {
    console.log(
      "Running all seeding operations (except index-coauthors, index-authors, and index-committees)...",
    );
    const membership = await indexPeopleMembership();
    const information = await indexPeopleInformation();
    const committees = await indexCommitteesInformation();
    success = membership && information && committees;
    break;
  }

  default:
    console.error(`Error: Unknown operation "${operation}"`);
    console.error(
      "\nAvailable operations: people-membership, people-information, committees-information, index-coauthors <congress>, index-authors <congress>, index-committees <congress>, all",
    );
    Deno.exit(1);
}

if (success) {
  console.log("\n✓ Seed operation completed successfully!");
  Deno.exit(0);
} else {
  console.error("\n✗ Seed operation failed");
  Deno.exit(1);
}
