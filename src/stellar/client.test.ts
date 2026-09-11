import { StrKey } from "@stellar/stellar-sdk";
import { describe, expect, it, vi } from "vitest";
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

  it("enables optional Lockup, Router, Stream NFT, and Paymaster capabilities", () => {
    const client = createFundableClient({
      chain: "stellar",
      network: "testnet",
      rpcUrl: "https://rpc.example.com",
      networkPassphrase: "Test SDF Network ; September 2015",
      contracts: {
        flow: contractId(),
        lockup: contractId(),
        router: contractId(),
        streamNft: contractId(),
        paymaster: contractId(),
      },
    });

    expect(client.router).toBeDefined();
    expect(client.lockups).toBeDefined();
    expect(client.streamNft).toBeDefined();
    expect(client.paymaster).toBeDefined();
  });

  it("signs a current sponsorship build with the configured wallet", async () => {
    const signAuthEntry = vi.fn(async () => ({
      signedAuthEntry: "signed-entry",
      signerAddress: "GACCOUNT",
    }));
    const client = createFundableClient({
      chain: "stellar",
      network: "testnet",
      rpcUrl: "https://rpc.example.com",
      networkPassphrase: "Test SDF Network ; September 2015",
      contracts: { flow: contractId() },
      publicKey: "GACCOUNT",
      signAuthEntry,
      sponsorship: {
        backendUrl: "https://api.example.com",
        accessToken: "session-token",
      },
    });

    await expect(
      client.signSponsorshipAuthorization({
        transactionXdr: "built-xdr",
        userAuthEntry: "auth-entry",
        feeToken: "CFEE",
        networkFeeStroops: "100",
        estimatedFee: "123",
        estimatedFeeUi: "0.0000123",
        maximumFee: "130",
        maximumFeeUi: "0.0000130",
        validUntil: "2030-01-01T00:00:00.000Z",
      }),
    ).resolves.toBe("signed-entry");
    expect(signAuthEntry).toHaveBeenCalledWith("auth-entry", {
      networkPassphrase: "Test SDF Network ; September 2015",
      address: "GACCOUNT",
    });
  });
});
