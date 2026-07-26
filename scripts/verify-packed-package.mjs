import { execFileSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const repositoryRoot = process.cwd();
const temporaryRoot = await mkdtemp(
  path.join(tmpdir(), "fundable-sdk-package-"),
);
const packedDirectory = path.join(temporaryRoot, "packed");
const consumerDirectory = path.join(temporaryRoot, "consumer");

function run(command, args, cwd = repositoryRoot) {
  execFileSync(command, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
  });
}

try {
  await mkdir(packedDirectory, { recursive: true });
  run("pnpm", ["pack", "--pack-destination", packedDirectory]);

  const archiveName = (await readdir(packedDirectory)).find((name) =>
    name.endsWith(".tgz"),
  );
  if (!archiveName) {
    throw new Error("pnpm pack did not create a package archive");
  }

  const archivePath = path.join(packedDirectory, archiveName);
  const archiveEntries = execFileSync("tar", ["-tzf", archivePath], {
    encoding: "utf8",
  })
    .trim()
    .split("\n");

  const requiredEntries = [
    "package/package.json",
    "package/README.md",
    "package/CHANGELOG.md",
    "package/dist/index.js",
    "package/dist/index.d.ts",
    "package/docs/README.md",
    "package/examples/read-flow.ts",
  ];
  for (const requiredEntry of requiredEntries) {
    if (!archiveEntries.includes(requiredEntry)) {
      throw new Error(`Packed SDK is missing ${requiredEntry}`);
    }
  }

  const forbiddenEntries = ["package/src/", "package/node_modules/"];
  for (const forbiddenEntry of forbiddenEntries) {
    if (archiveEntries.some((entry) => entry.startsWith(forbiddenEntry))) {
      throw new Error(`Packed SDK unexpectedly contains ${forbiddenEntry}`);
    }
  }

  await writeFile(
    path.join(temporaryRoot, "package-contents.txt"),
    `${archiveEntries.join("\n")}\n`,
  );

  await mkdir(consumerDirectory, { recursive: true });
  await writeFile(
    path.join(consumerDirectory, "package.json"),
    JSON.stringify(
      {
        name: "fundable-sdk-clean-consumer",
        private: true,
        type: "module",
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(consumerDirectory, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ESNext",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          noEmit: true,
          skipLibCheck: true,
        },
        include: ["consumer.ts"],
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(consumerDirectory, "consumer.ts"),
    `import {
  createFundableClient,
  type StellarFundableClientConfig,
} from "@fundable/sdk";
import { formatUnits, parseUnits } from "@fundable/sdk/core";

const config: StellarFundableClientConfig = {
  chain: "stellar",
  network: "testnet",
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  contracts: { flow: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM" },
};

const amount: bigint = parseUnits("1.25", 7);
const display: string = formatUnits(amount, 7);
const createClient: typeof createFundableClient = createFundableClient;

void config;
void display;
void createClient;
`,
  );

  run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--save-exact",
      archivePath,
      "typescript",
    ],
    consumerDirectory,
  );
  run("npx", ["tsc", "-p", "tsconfig.json"], consumerDirectory);
  run(
    "node",
    [
      "--input-type=module",
      "--eval",
      `import { formatUnits, parseUnits } from "@fundable/sdk/core";
if (formatUnits(parseUnits("1.25", 7), 7) !== "1.25") process.exit(1);`,
    ],
    consumerDirectory,
  );

  console.log(
    `Packed package verified with ${archiveEntries.length} files and a clean TypeScript consumer.`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
