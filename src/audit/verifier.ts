import { Keypair } from "@stellar/stellar-sdk";
import {
  computeCanonicalAuditHash,
  formatAttestationMessage,
} from "./adapter.js";
import type { AnchoredAuditTrailReceipt, VerificationResult } from "./types.js";

export function verifyAnchoredPayoutReceipt(
  receipt: AnchoredAuditTrailReceipt,
): VerificationResult {
  const computedHash = computeCanonicalAuditHash(receipt.record);
  const expectedHash = receipt.attestation.recordHash;

  if (computedHash !== expectedHash) {
    return {
      valid: false,
      computedHash,
      expectedHash,
      signatureValid: false,
      signer: receipt.attestation.signerPublicKey,
      reason: "Hash mismatch: canonical record does not match the attested hash.",
    };
  }

  if (!receipt.attestation.signatureBase64) {
    return {
      valid: true,
      computedHash,
      expectedHash,
      signatureValid: false,
      signer: receipt.attestation.signerPublicKey,
      reason: "Unsigned attestation record.",
    };
  }

  try {
    const keypair = Keypair.fromPublicKey(receipt.attestation.signerPublicKey);
    const expectedMessage = formatAttestationMessage(computedHash);
    const messageBuffer = Buffer.from(expectedMessage, "utf8");
    const signatureBuffer = Buffer.from(
      receipt.attestation.signatureBase64,
      "base64",
    );

    const signatureValid = keypair.verify(messageBuffer, signatureBuffer);

    return {
      valid: signatureValid,
      computedHash,
      expectedHash,
      signatureValid,
      signer: receipt.attestation.signerPublicKey,
      reason: signatureValid ? undefined : "Invalid cryptographic signature for signer.",
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      computedHash,
      expectedHash,
      signatureValid: false,
      signer: receipt.attestation.signerPublicKey,
      reason: `Signature verification failed: ${message}`,
    };
  }
}