/**
 * Parse HTML metadata files and generate JSON mappings
 *
 * This script parses authors.html and committees.html from the metadata folder
 * and generates corresponding JSON files in the mappings folder.
 */

import { DOMParser } from "jsr:@b-fuze/deno-dom";

const METADATA_DIR = "./metadata";
const MAPPINGS_DIR = "./mappings";

interface Author {
  id: string;
  name: string;
}

interface Committee {
  id: string;
  name: string;
}

/**
 * Parse authors.html and extract author mappings
 */
async function parseAuthors(): Promise<Author[]> {
  const html = await Deno.readTextFile(`${METADATA_DIR}/authors.html`);
  const doc = new DOMParser().parseFromString(html, "text/html");

  if (!doc) {
    throw new Error("Failed to parse authors.html");
  }

  const options = doc.querySelectorAll("option[value]");
  const authors: Author[] = [];

  for (const option of options) {
    const value = option.getAttribute("value");
    const text = option.textContent?.trim();

    if (value && text && value !== "") {
      authors.push({
        id: value,
        name: text,
      });
    }
  }

  return authors;
}

/**
 * Parse committees.html and extract committee mappings
 */
async function parseCommittees(): Promise<Committee[]> {
  const html = await Deno.readTextFile(`${METADATA_DIR}/committees.html`);
  const doc = new DOMParser().parseFromString(html, "text/html");

  if (!doc) {
    throw new Error("Failed to parse committees.html");
  }

  const options = doc.querySelectorAll("option[value]");
  const committees: Committee[] = [];

  for (const option of options) {
    const value = option.getAttribute("value");
    const text = option.textContent?.trim();

    if (value && text && value !== "") {
      committees.push({
        id: value,
        name: text,
      });
    }
  }

  return committees;
}

/**
 * Main function
 */
async function main() {
  console.log("Parsing metadata files...");

  // Create mappings directory if it doesn't exist
  try {
    await Deno.mkdir(MAPPINGS_DIR, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error;
    }
  }

  // Parse authors
  console.log("Parsing authors.html...");
  const authors = await parseAuthors();
  console.log(`Found ${authors.length} authors`);

  // Parse committees
  console.log("Parsing committees.html...");
  const committees = await parseCommittees();
  console.log(`Found ${committees.length} committees`);

  // Write JSON files
  console.log("Writing authors.json...");
  await Deno.writeTextFile(
    `${MAPPINGS_DIR}/authors.json`,
    JSON.stringify(authors, null, 2)
  );

  console.log("Writing committees.json...");
  await Deno.writeTextFile(
    `${MAPPINGS_DIR}/committees.json`,
    JSON.stringify(committees, null, 2)
  );

  console.log("Done!");
  console.log(`Generated files:`);
  console.log(`  - ${MAPPINGS_DIR}/authors.json (${authors.length} entries)`);
  console.log(`  - ${MAPPINGS_DIR}/committees.json (${committees.length} entries)`);
}

if (import.meta.main) {
  main();
}
