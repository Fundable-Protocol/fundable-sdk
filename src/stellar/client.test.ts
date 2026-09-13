import { Address, Contract, hash, Keypair, nativeToScVal, StrKey, xdr } from "@stellar/stellar-sdk";
import { describe, expect, it, vi } from "vitest";
import { FundableError } from "../core/index.js";
import { createFundableClient } from "../client.js";

function contractId(): string {
  return StrKey.encodeContract(new Uint8Array(32));
}

function unsignedAuthorizationEntry(): { entryXdr: string; signer: Keypair } {
  const signer = Keypair.random();
  const entryXdr = new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: Address.fromString(signer.publicKey()).toScAddress(),
        nonce: xdr.Int64.fromString("1"),
        signatureExpirationLedger: 2_000,
        signature: xdr.ScVal.scvVec([]),
      }),
    ),
    rootInvocation: new xdr.SorobanAuthorizedInvocation({
      function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: new Contract(contractId()).address().toScAddress(),
          functionName: "forward",
          args: [nativeToScVal(signer.publicKey(), { type: "address" })],
        }),
      ),
      subInvocations: [],
    }),
  }).toXDR("base64");
  return { entryXdr, signer };
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
    const authorization = unsignedAuthorizationEntry();
    const signAuthEntry = vi.fn(async (preimageXdr: string) => ({
      signedAuthEntry: authorization.signer
        .sign(hash(Buffer.from(preimageXdr, "base64")))
        .toString("base64"),
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

    const result = await client.signSponsorshipAuthorization({
        transactionXdr: "built-xdr",
        userAuthEntry: authorization.entryXdr,
        feeToken: "CFEE",
        networkFeeStroops: "100",
        estimatedFee: "123",
        estimatedFeeUi: "0.0000123",
        maximumFee: "130",
        maximumFeeUi: "0.0000130",
        validUntil: "2030-01-01T00:00:00.000Z",
      });
    const signed = xdr.SorobanAuthorizationEntry.fromXDR(result, "base64");
    expect(signed.credentials().address().signature().switch().name).toBe("scvVec");
    expect(signAuthEntry).toHaveBeenCalledWith(expect.any(String), {
      networkPassphrase: "Test SDF Network ; September 2015",
      address: "GACCOUNT",
    });
  });
});
