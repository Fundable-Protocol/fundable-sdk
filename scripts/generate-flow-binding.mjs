import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const wasmArgument = process.argv.slice(2).find((argument) => argument !== "--");

if (!wasmArgument) {
  throw new Error("Usage: pnpm generate:flow -- /absolute/path/to/flow.wasm");
}

const wasmPath = resolve(wasmArgument);
const temporaryDirectory = await mkdtemp(join(tmpdir(), "fundable-flow-binding-"));
const generatedDirectory = join(temporaryDirectory, "flow");

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
  throw new Error("Stellar CLI failed to generate the Flow binding");
}

const generatedPath = join(generatedDirectory, "src", "index.ts");
const destinationPath = resolve("src/generated/flow/src/index.ts");
const browserGlobalMutation = `if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}





`;
const generatedSource = await readFile(generatedPath, "utf8");

if (!generatedSource.includes(browserGlobalMutation)) {
  throw new Error(
    "Generated binding format changed: expected Buffer browser-global block was not found",
  );
}

// The SDK imports Buffer directly; mutating window.Buffer would be a surprising
// package side effect for browser consumers.
const sdkSource = generatedSource.replace(browserGlobalMutation, "");
await writeFile(destinationPath, `${sdkSource.trimEnd()}\n`, "utf8");

console.log(`Updated ${destinationPath} from ${wasmPath}`);
