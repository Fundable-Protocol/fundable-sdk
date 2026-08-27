import { describe, it, expect } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import {
  computeCanonicalAuditHash,
  formatAttestationMessage,
  signPayoutAttestation,
  anchorFundablePayout,
  verifyAnchoredPayoutReceipt,
  type FundablePayoutAuditRecord,
} from "./index.js";

describe("Nirium Audit Trail Adapter for Fundable Payouts", () => {
  const payerKeypair = Keypair.random();
  const recipientKeypair = Keypair.random();
  const tokenContractId = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

  const sampleRecord: FundablePayoutAuditRecord = {
    protocol: "fundable",
    chain: "stellar",
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CA3D5KRYMCMCZVAC7OHQHG2CAUAQ77PDRWNXD7BOD7X62F26T4ZMY54K",
    operation: "create_flow",
    txHash: "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
    sender: payerKeypair.publicKey(),
    recipient: recipientKeypair.publicKey(),
    token: tokenContractId,
    amountOrRate: "10000000",
    startTime: 1724774400,
    timestamp: 1724774405,
  };

  it("computes deterministic canonical SHA-256 hash regardless of key order", () => {
    const hash1 = computeCanonicalAuditHash(sampleRecord);

    const permutedRecord = {
      timestamp: sampleRecord.timestamp,
      recipient: sampleRecord.recipient,
      token: sampleRecord.token,
      amountOrRate: sampleRecord.amountOrRate,
      sender: sampleRecord.sender,
      operation: sampleRecord.operation,
      txHash: sampleRecord.txHash,
      contractId: sampleRecord.contractId,
      chain: sampleRecord.chain,
      networkPassphrase: sampleRecord.networkPassphrase,
      protocol: sampleRecord.protocol,
      startTime: sampleRecord.startTime,
    } as FundablePayoutAuditRecord;

    const hash2 = computeCanonicalAuditHash(permutedRecord);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("formats domain-separated attestation message as nirium-audit-v1:<hash>", () => {
    const hash = computeCanonicalAuditHash(sampleRecord);
    const message = formatAttestationMessage(hash);
    expect(message).toBe(`nirium-audit-v1:${hash}`);
  });

  it("signs and anchors a payout record returning valid receipt and CID", async () => {
    const receipt = await anchorFundablePayout(sampleRecord, {
      secretKey: payerKeypair.secret(),
    });

    expect(receipt.cid).toBeDefined();
    expect(receipt.cid.startsWith("bafk")).toBe(true);
    expect(receipt.attestation.signerPublicKey).toBe(payerKeypair.publicKey());
    expect(receipt.attestation.signatureBase64).toBeTruthy();

    const verification = verifyAnchoredPayoutReceipt(receipt);
    expect(verification.valid).toBe(true);
    expect(verification.signatureValid).toBe(true);
    expect(verification.signer).toBe(payerKeypair.publicKey());
  });

  it("rejects verification if receipt payload is tampered", async () => {
    const receipt = await anchorFundablePayout(sampleRecord, {
      secretKey: payerKeypair.secret(),
    });

    const tamperedReceipt = {
      ...receipt,
      record: {
        ...receipt.record,
        amountOrRate: "999999999999",
      },
    };

    const verification = verifyAnchoredPayoutReceipt(tamperedReceipt);
    expect(verification.valid).toBe(false);
    expect(verification.reason).toContain("Hash mismatch");
  });

  it("rejects verification if signature is invalid", async () => {
    const anotherKeypair = Keypair.random();
    const receipt = await anchorFundablePayout(sampleRecord, {
      secretKey: payerKeypair.secret(),
    });

    const invalidReceipt = {
      ...receipt,
      attestation: {
        ...receipt.attestation,
        signerPublicKey: anotherKeypair.publicKey(),
      },
    };

    const verification = verifyAnchoredPayoutReceipt(invalidReceipt);
    expect(verification.valid).toBe(false);
  });
});