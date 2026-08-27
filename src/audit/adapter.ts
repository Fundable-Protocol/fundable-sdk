import { createHash } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";
import type {
  FundablePayoutAuditRecord,
  NiriumAttestation,
  AnchoredAuditTrailReceipt,
} from "./types.js";

const DOMAIN_PREFIX = "nirium-audit-v1";

export function computeCanonicalAuditHash(record: FundablePayoutAuditRecord): string {
  const canonicalJson = JSON.stringify(record, Object.keys(record).sort());
  return createHash("sha256").update(canonicalJson, "utf8").digest("hex");
}

export function formatAttestationMessage(recordHash: string): string {
  return `${DOMAIN_PREFIX}:${recordHash}`;
}

export function signPayoutAttestation(
  recordHash: string,
  secretKey: string,
): NiriumAttestation {
  const keypair = Keypair.fromSecret(secretKey);
  const attestationMessage = formatAttestationMessage(recordHash);
  const messageBuffer = Buffer.from(attestationMessage, "utf8");
  const signature = keypair.sign(messageBuffer);

  return {
    domain: DOMAIN_PREFIX,
    recordHash,
    attestationMessage,
    signerPublicKey: keypair.publicKey(),
    signatureBase64: signature.toString("base64"),
  };
}

export interface NiriumAnchorOptions {
  niriumNodeUrl?: string;
  secretKey?: string;
  mockCidGenerator?: (payload: unknown) => string;
}

export async function anchorFundablePayout(
  record: FundablePayoutAuditRecord,
  options?: NiriumAnchorOptions,
): Promise<AnchoredAuditTrailReceipt> {
  const recordHash = computeCanonicalAuditHash(record);

  let attestation: NiriumAttestation;
  if (options?.secretKey) {
    attestation = signPayoutAttestation(recordHash, options.secretKey);
  } else {
    attestation = {
      domain: DOMAIN_PREFIX,
      recordHash,
      attestationMessage: formatAttestationMessage(recordHash),
      signerPublicKey: record.sender,
      signatureBase64: "",
    };
  }

  const payload = {
    record,
    attestation,
    timestamp: Date.now(),
  };

  let cid = "";
  if (options?.mockCidGenerator) {
    cid = options.mockCidGenerator(payload);
  } else if (options?.niriumNodeUrl) {
    const response = await fetch(`${options.niriumNodeUrl}/api/v1/anchor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to anchor to Nirium node: ${response.statusText}`);
    }

    const data = (await response.json()) as { cid: string };
    cid = data.cid;
  } else {
    const payloadHash = createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex");
    cid = `bafkrei${payloadHash.slice(0, 52)}`;
  }

  return {
    cid,
    record,
    attestation,
    anchoredAt: payload.timestamp,
  };
}