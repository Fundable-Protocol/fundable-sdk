import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const [contractName, wasmArgument] = process.argv
  .slice(2)
  .filter((argument) => argument !== "--");

if (!contractName || !wasmArgument) {
  throw new Error(
    "Usage: node scripts/generate-stellar-binding.mjs <contract-name> /absolute/path/to/contract.wasm",
  );
}

const wasmPath = resolve(wasmArgument);
const temporaryDirectory = await mkdtemp(
  join(tmpdir(), `fundable-${contractName}-binding-`),
);
const generatedDirectory = join(temporaryDirectory, contractName);

const generation = spawnSync(
  "stellar",
  [
    "contract",
    "bindings",
    "typescript",
    "--wasm",
    wasmPath,
    "--output-dir",
    generatedDirectory,
  ],
  { stdio: "inherit" },
);

if (generation.error) {
  throw generation.error;
}

if (generation.status !== 0) {
  process.exitCode = generation.status ?? 1;
  throw new Error(`Stellar CLI failed to generate the ${contractName} binding`);
}

const generatedPath = join(generatedDirectory, "src", "index.ts");
const destinationPath = resolve(
  `src/generated/${contractName}/src/index.ts`,
);
const browserGlobalMutation = /if \(typeof window !== "undefined"\) \{\n  \/\/@ts-ignore Buffer exists\n  window\.Buffer = window\.Buffer \|\| Buffer;\n\}\n+/;
const generatedSource = await readFile(generatedPath, "utf8");

if (!browserGlobalMutation.test(generatedSource)) {
  throw new Error(
    "Generated binding format changed: expected Buffer browser-global block was not found",
  );
}

// The SDK imports Buffer directly; mutating window.Buffer would be a surprising
// package side effect for browser consumers.
const sdkSource = generatedSource.replace(browserGlobalMutation, "");
await writeFile(destinationPath, `${sdkSource.trimEnd()}\n`, "utf8");

console.log(`Updated ${destinationPath} from ${wasmPath}`);
