import { buildMerkleTree } from "@fundable/sdk/stellar";
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

const claimant = requireEnv("FUNDABLE_PUBLIC_KEY");
const recipient = requireEnv("FUNDABLE_RECIPIENT");
const distributionId = BigInt(process.env.FUNDABLE_DISTRIBUTION_ID?.trim() || "1");

// Sample recipients matching the created distribution
const recipients = [
  { address: claimant, amount: 1_000_000n },
  { address: recipient, amount: 2_500_000n },
];

const tree = buildMerkleTree(recipients);
const proofItem = tree.proofs.find((p) => p.recipient.address === claimant);

if (!proofItem) {
  throw new Error(`No proof found for claimant ${claimant}`);
}

console.log(`Submitting claim for distribution #${distributionId}`);
console.log(`Claimant: ${claimant}`);
console.log(`Amount: ${proofItem.recipient.amount.toString()}`);
console.log(`Proof elements count: ${proofItem.proof.length}`);

const transaction = await fundable.distributor.claim({
  claimant,
  distributionId,
  amount: proofItem.recipient.amount,
  proof: proofItem.proof,
});

printSimulation(transaction);
