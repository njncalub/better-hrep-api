#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Script to crawl all pages of /people endpoint
 * This populates the document authorship cache by requesting each page
 */

import "jsr:@std/dotenv/load";

const API_BASE_URL = Deno.env.get("API_BASE_URL") || "http://localhost:8000";

async function crawlPeople() {
  console.log("Starting /people crawler...");
  console.log(`API Base URL: ${API_BASE_URL}`);

  let page = 0;
  const limit = 100; // Process 100 people per page
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

      // Add a small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`Error fetching page ${page}:`, error);
      break;
    }
  }

  console.log(`\nCrawling complete! Total people processed: ${totalProcessed}`);
  console.log("Document authorship cache has been populated.");
}

// Run the crawler
crawlPeople();
