import { Networks } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { createFundableClient } from "../client.js";

const runIntegration = process.env.FUNDABLE_TESTNET_INTEGRATION === "1";

const deployment = {
  admin:
    process.env.FUNDABLE_TESTNET_ADMIN ??
    "GDZJSPRSBTAJPAQ4NG6Y2ZCWHEX5HMS253TYVNAQJRPJHY27JPOHBIPZ",
  owner:
    process.env.FUNDABLE_TESTNET_STREAM_OWNER ??
    "GA4F3SQXOA6JETFYL4SG5JX7KGKDIU7RGFPUD3RNZTERVQODYUHYDACN",
  flow:
    process.env.FUNDABLE_TESTNET_FLOW ??
    "CAD57D33XJAHR7LSJVJU3MCFU3UMU72NK56GGLWDIKYZDSZICILSUKCY",
  lockup:
    process.env.FUNDABLE_TESTNET_LOCKUP ??
    "CBJRYJRQ24LP4DKKTUSVPCICLMMXIG7ZW5M4M7VNJUXGKDPBJ322ADT2",
  router:
    process.env.FUNDABLE_TESTNET_ROUTER ??
    "CAWZ5DGA6DTNG6GAF4O534SOP277JKZ6URTP3EE2KTBC3RM4YR4PQD7J",
  streamNft:
    process.env.FUNDABLE_TESTNET_STREAM_NFT ??
    "CCYMOIEL3ID55C4DFQAGZEGJT4KEXM5OHIRJROZRLTLAO3EMSSHJIGLY",
  distributor:
    process.env.FUNDABLE_TESTNET_DISTRIBUTOR ??
    "CA5NDB4GKNIQDVUBJRUNRLZ45KRGFZ2BCALGW6VFDANDTKNRGEKNJRMQ",
  tokenId: process.env.FUNDABLE_TESTNET_STREAM_TOKEN_ID ?? "1",
};

describe.runIf(runIntegration)("Fundable mainnet-readiness testnet deployment", () => {
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
      lockup: deployment.lockup,
      router: deployment.router,
      streamNft: deployment.streamNft,
      distributor: deployment.distributor,
    },
  });

  it("reads canonical Router metadata by public NFT token ID", async () => {
    await expect(client.router?.getStream(deployment.tokenId)).resolves.toEqual(
      expect.objectContaining({
        tokenId: deployment.tokenId,
        coreStreamId: "1",
        streamKind: "lockup",
        owner: deployment.owner,
        transferable: true,
      }),
    );
  });

  it("reads Stream NFT ownership and transferability", async () => {
    await expect(client.streamNft?.ownerOf(deployment.tokenId)).resolves.toBe(
      deployment.owner,
    );
    await expect(
      client.streamNft?.isTransferable(deployment.tokenId),
    ).resolves.toBe(true);
  });

  it("reads the underlying Lockup lifecycle through the core mapping", async () => {
    const coreStreamId = await client.router?.coreStreamId(deployment.tokenId);
    await expect(client.lockups?.statusOf(coreStreamId!)).resolves.toMatch(
      /^(pending|streaming|settled|canceled|depleted)$/,
    );
  });

  it("reads Distributor on-chain configuration", async () => {
    await expect(client.distributor?.getProtocolFeePercent()).resolves.toBe(25);
    await expect(client.distributor?.getProtocolFeeAddress()).resolves.toBe(
      deployment.admin,
    );
  });
});
