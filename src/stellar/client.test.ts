import { StrKey } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { FundableError } from "../core/index.js";
import { createFundableClient } from "../client.js";

function contractId(): string {
  return StrKey.encodeContract(new Uint8Array(32));
}

describe("createFundableClient", () => {
  it("creates the Stellar adapter with Flow capabilities", () => {
    const client = createFundableClient({
      chain: "stellar",
      network: "testnet",
      rpcUrl: "https://rpc.example.com",
      networkPassphrase: "Test SDF Network ; September 2015",
      contracts: { flow: contractId() },
    });

    expect(client.chain).toBe("stellar");
    expect(client.flows).toBeDefined();
  });

  it("rejects malformed Flow contract IDs before an RPC call", () => {
    expect(() =>
      createFundableClient({
        chain: "stellar",
        network: "testnet",
        rpcUrl: "https://rpc.example.com",
        networkPassphrase: "Test SDF Network ; September 2015",
        contracts: { flow: "not-a-contract" },
      }),
    ).toThrow(FundableError);
  });
});
