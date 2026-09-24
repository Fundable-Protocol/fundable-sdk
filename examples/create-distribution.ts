import {
  createExampleClient,
  printSimulation,
  requireEnv,
} from "./config.js";

const fundable = createExampleClient({
  capability: "distributor",
  requirePublicKey: true,
});

if (!fundable.distributor) {
  throw new Error("Distributor capability is not configured");
}

const admin = requireEnv("FUNDABLE_PUBLIC_KEY");
const token = requireEnv("FUNDABLE_TOKEN_CONTRACT");
const recipient = requireEnv("FUNDABLE_RECIPIENT");

// Sample recipients list
const recipients = [
  { address: admin, amount: 1_000_000n },
  { address: recipient, amount: 2_500_000n },
];

const { transaction, tree } = await fundable.distributor.createDistribution({
  admin,
  token,
  recipients,
  uniqueRef: "community-airdrop-round-1",
});

console.log(`Generated Merkle Root: 0x${tree.root}`);
console.log(`Total Recipients: ${recipients.length}`);

printSimulation(transaction);
