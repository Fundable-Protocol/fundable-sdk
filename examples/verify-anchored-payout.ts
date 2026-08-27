import { Keypair } from "@stellar/stellar-sdk";
import {
  anchorFundablePayout,
  verifyAnchoredPayoutReceipt,
  type FundablePayoutAuditRecord,
} from "../src/index.js";

async function main() {
  console.log("=== Nirium Audit Trail Anchor for Fundable Payouts ===\n");

  const payer = Keypair.random();
  const recipient = Keypair.random();

  const samplePayout: FundablePayoutAuditRecord = {
    protocol: "fundable",
    chain: "stellar",
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CA3D5KRYMCMCZVAC7OHQHG2CAUAQ77PDRWNXD7BOD7X62F26T4ZMY54K",
    operation: "create_flow",
    txHash: "4b7b3b9b8c0a1e2f3d4c5b6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c",
    sender: payer.publicKey(),
    recipient: recipient.publicKey(),
    token: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    amountOrRate: "5000000",
    startTime: Math.floor(Date.now() / 1000),
    timestamp: Math.floor(Date.now() / 1000),
  };

  console.log("1. Anchoring completed payout record with domain attestation...");
  const receipt = await anchorFundablePayout(samplePayout, {
    secretKey: payer.secret(),
  });

  console.log(`- IPFS CID: ${receipt.cid}`);
  console.log(`- Attestation Domain: ${receipt.attestation.domain}`);
  console.log(`- Attestation Message: ${receipt.attestation.attestationMessage}`);
  console.log(`- Signer (Payer): ${receipt.attestation.signerPublicKey}`);
  console.log(`- Signature (Base64): ${receipt.attestation.signatureBase64.slice(0, 32)}...\n`);

  console.log("2. Performing independent verification (SHA-256 + Ed25519)...");
  const verification = verifyAnchoredPayoutReceipt(receipt);

  console.log(`- Valid: ${verification.valid ? "YES (Integrity Confirmed)" : "NO"}`);
  console.log(`- Hash Recomputed: ${verification.computedHash}`);
  console.log(`- Signature Match: ${verification.signatureValid}`);
}

main().catch(console.error);