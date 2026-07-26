import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = process.cwd();
const ignoredDirectories = new Set([".git", "dist", "node_modules"]);
const markdownLinkPattern = /!?\[[^\]]*]\(([^)]+)\)/g;
const failures = [];

async function collectMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(absolutePath)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(absolutePath);
    }
  }

  return files;
}

function normalizeDestination(rawDestination) {
  const withoutTitle = rawDestination.trim().replace(
    /^<([^>]+)>$|^(\S+)(?:\s+["'][^"']*["'])$/,
    (_, angled, plain) => angled ?? plain,
  );
  return withoutTitle.split("#", 1)[0].split("?", 1)[0];
}

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

for (const markdownFile of await collectMarkdownFiles(repositoryRoot)) {
  const contents = await readFile(markdownFile, "utf8");

  for (const match of contents.matchAll(markdownLinkPattern)) {
    const destination = normalizeDestination(match[1]);
    if (
      !destination ||
      destination.startsWith("#") ||
      /^[a-z][a-z\d+.-]*:/i.test(destination)
    ) {
      continue;
    }

    let decodedDestination;
    try {
      decodedDestination = decodeURIComponent(destination);
    } catch {
      failures.push(
        `${path.relative(repositoryRoot, markdownFile)}: invalid URL encoding in ${destination}`,
      );
      continue;
    }

    const target = path.resolve(path.dirname(markdownFile), decodedDestination);
    if (!target.startsWith(`${repositoryRoot}${path.sep}`) && target !== repositoryRoot) {
      failures.push(
        `${path.relative(repositoryRoot, markdownFile)}: link escapes repository: ${destination}`,
      );
      continue;
    }
    if (!(await exists(target))) {
      failures.push(
        `${path.relative(repositoryRoot, markdownFile)}: missing target ${destination}`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("All local Markdown links resolve.");
}
