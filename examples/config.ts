import {
  createFundableClient,
  type StellarFundableClient,
} from "@fundable/sdk";

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

type Capability = "router" | "streamNft" | "paymaster" | "distributor";

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function createExampleClient(options?: {
  capability?: Capability;
  requirePublicKey?: boolean;
}): StellarFundableClient {
  const publicKey = options?.requirePublicKey
    ? requireEnv("FUNDABLE_PUBLIC_KEY")
    : optionalEnv("FUNDABLE_PUBLIC_KEY");

  const router = optionalEnv("FUNDABLE_ROUTER_CONTRACT");
  const streamNft = optionalEnv("FUNDABLE_STREAM_NFT_CONTRACT");
  const paymaster = optionalEnv("FUNDABLE_PAYMASTER_CONTRACT");
  const distributor = optionalEnv("FUNDABLE_DISTRIBUTOR_CONTRACT");

  const requiredAddress =
    options?.capability === "router"
      ? router
      : options?.capability === "streamNft"
        ? streamNft
        : options?.capability === "paymaster"
          ? paymaster
          : options?.capability === "distributor"
            ? distributor
            : undefined;

  if (options?.capability && !requiredAddress) {
    const environmentName = {
      router: "FUNDABLE_ROUTER_CONTRACT",
      streamNft: "FUNDABLE_STREAM_NFT_CONTRACT",
      paymaster: "FUNDABLE_PAYMASTER_CONTRACT",
      distributor: "FUNDABLE_DISTRIBUTOR_CONTRACT",
    }[options.capability];
    throw new Error(`Missing required environment variable: ${environmentName}`);
  }

  return createFundableClient({
    chain: "stellar",
    network: "testnet",
    rpcUrl:
      optionalEnv("FUNDABLE_RPC_URL") ??
      "https://soroban-testnet.stellar.org",
    networkPassphrase:
      optionalEnv("FUNDABLE_NETWORK_PASSPHRASE") ?? TESTNET_PASSPHRASE,
    publicKey,
    contracts: {
      flow: requireEnv("FUNDABLE_FLOW_CONTRACT"),
      router,
      streamNft,
      paymaster,
      distributor,
    },
  });
}

export function printSimulation(transaction: {
  toXDR(): string;
  needsNonInvokerSigningBy(): string[];
}): void {
  console.log(
    JSON.stringify(
      {
        transactionXdr: transaction.toXDR(),
        nonInvokerSigners: transaction.needsNonInvokerSigningBy(),
        submitted: false,
      },
      null,
      2,
    ),
  );
}
