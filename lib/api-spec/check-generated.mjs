import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiSpecDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(apiSpecDir, "..", "..");
const generatedPaths = [
  "lib/api-client-react/src/generated",
  "lib/api-zod/src/generated",
];

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    ...options,
  });
}

let committedDiff = false;
try {
  git(["diff", "--quiet", "HEAD", "--", ...generatedPaths], {
    stdio: "ignore",
  });
} catch (error) {
  if (error.status !== 1) {
    throw error;
  }
  committedDiff = true;
}

const untrackedGeneratedFiles = git([
  "ls-files",
  "--others",
  "--exclude-standard",
  "--",
  ...generatedPaths,
]).trim();

if (!committedDiff && !untrackedGeneratedFiles) {
  console.log("Generated OpenAPI clients match the committed specification.");
  process.exit(0);
}

console.error(
  [
    "OpenAPI generated clients are out of date.",
    "Regeneration changed the committed React and/or Zod client output.",
    "Update the specification, generated clients, and compatibility processing together, then commit the regenerated output.",
    "",
    "Changed tracked files:",
  ].join("\n"),
);

if (committedDiff) {
  console.error(
    git(["diff", "--name-status", "HEAD", "--", ...generatedPaths]).trim(),
  );
}

if (untrackedGeneratedFiles) {
  console.error("\nUntracked generated files:");
  console.error(untrackedGeneratedFiles);
}

process.exit(1);