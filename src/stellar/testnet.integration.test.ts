import { Asset, Keypair, Networks } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { createFundableClient } from "../client.js";

const runIntegration = process.env.FUNDABLE_TESTNET_INTEGRATION === "1";

const deployment = {
  admin:
    process.env.FUNDABLE_TESTNET_ADMIN ??
    "GDZJSPRSBTAJPAQ4NG6Y2ZCWHEX5HMS253TYVNAQJRPJHY27JPOHBIPZ",
  flow:
    process.env.FUNDABLE_TESTNET_FLOW ??
    "CCX3BJBDAORZI2QI7LS44RBJ7OT7HYZBXIXKC7UVMGS5SV766UUKRM2B",
  router:
    process.env.FUNDABLE_TESTNET_ROUTER ??
    "CCKPJ3QNP7M2OY3PIMYSGBKY3PVPTZXHRW6RBV5EMWKRZQ2P64JRFVCP",
  streamNft:
    process.env.FUNDABLE_TESTNET_STREAM_NFT ??
    "CBKWSE5M6PJ3JYYMMPWKNZ4T6H6EM77QZIQQFNHCRCECAP53ZKCETR5P",
  paymaster:
    process.env.FUNDABLE_TESTNET_PAYMASTER ??
    "CD4DQI4RKCPHGNROBXS4QWNGAHMYDTJK3GEGJZWLQFAWAVO6CYPSIXMM",
};

describe.runIf(runIntegration)("Fundable tagged testnet deployment", () => {
  const client = createFundableClient({
    chain: "stellar",
    network: "testnet",
    rpcUrl:
      process.env.FUNDABLE_TESTNET_RPC_URL ??
      "https://soroban-testnet.stellar.org",
    networkPassphrase: Networks.TESTNET,
    publicKey: deployment.admin,
    contracts: {
      flow: deployment.flow,
      router: deployment.router,
      streamNft: deployment.streamNft,
      paymaster: deployment.paymaster,
    },
  });

  it("reads Stream NFT and Paymaster state through the public clients", async () => {
    await expect(client.streamNft?.balanceOf(deployment.admin)).resolves.toEqual(
      expect.any(BigInt),
    );
    await expect(
      client.paymaster?.isFeeTokenAllowed(
        Asset.native().contractId(Networks.TESTNET),
      ),
    ).resolves.toEqual(expect.any(Boolean));
  });

  it("simulates Router flow creation without submitting a transaction", async () => {
    const transaction = await client.router?.createFlow({
      sender: deployment.admin,
      recipient: Keypair.random().publicKey(),
      token: {
        address: Asset.native().contractId(Networks.TESTNET),
        decimals: 7,
      },
      ratePerSecond: 1n,
      startTime: BigInt(Math.floor(Date.now() / 1_000) + 30),
    });

    expect(transaction?.result).toEqual(expect.any(BigInt));
  });

  it("simulates Router Lockup creation without submitting a transaction", async () => {
    const startTime = BigInt(Math.floor(Date.now() / 1_000) + 30);
    const transaction = await client.router?.createLockup({
      sender: deployment.admin,
      recipient: Keypair.random().publicKey(),
      token: {
        address: Asset.native().contractId(Networks.TESTNET),
        decimals: 7,
      },
      totalAmount: 1n,
      startTime,
      endTime: startTime + 3_600n,
      granularitySeconds: 1n,
    });

    expect(transaction?.result).toEqual(expect.any(BigInt));
  });
});
