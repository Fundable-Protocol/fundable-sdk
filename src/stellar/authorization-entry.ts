import { xdr } from "@stellar/stellar-sdk";

/** Convert relayer empty-vector signature placeholders into wallet-signable entries. */
export function normalizeUnsignedAuthorizationEntry(authEntry: string): string {
  let entry: xdr.SorobanAuthorizationEntry;
  try {
    entry = xdr.SorobanAuthorizationEntry.fromXDR(authEntry, "base64");
  } catch {
    return authEntry;
  }

  const credentials = entry.credentials();
  if (credentials.switch().name !== "sorobanCredentialsAddress") {
    return entry.toXDR("base64");
  }

  const signature = credentials.address().signature();
  if (signature.switch().name === "scvVec" && signature.vec()?.length === 0) {
    credentials.address().signature(xdr.ScVal.scvVoid());
  }

  return entry.toXDR("base64");
}
