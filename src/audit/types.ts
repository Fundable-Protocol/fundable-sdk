export interface FundablePayoutAuditRecord {
  protocol: "fundable";
  chain: "stellar";
  networkPassphrase: string;
  contractId: string;
  operation: "create_flow" | "create_lockup" | "withdraw" | "flow_deposit" | "custom_payout";
  txHash: string;
  sender: string;
  recipient: string;
  token: string;
  amountOrRate: string;
  startTime?: number;
  timestamp: number;
}

export interface NiriumAttestation {
  domain: string;
  recordHash: string;
  attestationMessage: string;
  signerPublicKey: string;
  signatureBase64: string;
}

export interface AnchoredAuditTrailReceipt {
  cid: string;
  record: FundablePayoutAuditRecord;
  attestation: NiriumAttestation;
  anchoredAt: number;
}

export interface VerificationResult {
  valid: boolean;
  computedHash: string;
  expectedHash: string;
  signatureValid: boolean;
  signer: string;
  reason?: string;
}