import { Address, Contract, Keypair, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { normalizeUnsignedAuthorizationEntry } from "./authorization-entry.js";

describe("normalizeUnsignedAuthorizationEntry", () => {
  it("replaces an empty signature vector with the unsigned void marker", () => {
    const signer = Keypair.random().publicKey();
    const contract = new Contract(
      "CDJM3SROZG3TY3URXSFH7J5GEIVFHZZKWX5DVJISED6YBIONA76WBU7D",
    );
    const input = new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
        new xdr.SorobanAddressCredentials({
          address: Address.fromString(signer).toScAddress(),
          nonce: xdr.Int64.fromString("1"),
          signatureExpirationLedger: 2_000,
          signature: xdr.ScVal.scvVec([]),
        }),
      ),
      rootInvocation: new xdr.SorobanAuthorizedInvocation({
        function:
          xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
            new xdr.InvokeContractArgs({
              contractAddress: contract.address().toScAddress(),
              functionName: "forward",
              args: [nativeToScVal(signer, { type: "address" })],
            }),
          ),
        subInvocations: [],
      }),
    }).toXDR("base64");

    const normalized = xdr.SorobanAuthorizationEntry.fromXDR(
      normalizeUnsignedAuthorizationEntry(input),
      "base64",
    );

    expect(normalized.credentials().address().signature().switch().name).toBe(
      "scvVoid",
    );
  });
});
