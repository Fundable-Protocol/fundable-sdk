import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const generated = vi.hoisted(() => ({
  createFlow: vi.fn(),
  createLockup: vi.fn(),
  getStreamData: vi.fn(),
  ownerOf: vi.fn(),
  cancelLockup: vi.fn(),
  lockupStatus: vi.fn(),
  forward: vi.fn(),
  flowProposeUpgrade: vi.fn(),
  flowExecuteUpgrade: vi.fn(),
  flowUpgrade: vi.fn(),
  flowProposeAdmin: vi.fn(),
  flowAcceptAdmin: vi.fn(),
  flowExtendStreamTtl: vi.fn(),
  routerUpgradeNft: vi.fn(),
  routerProposeUpgrade: vi.fn(),
  routerExecuteUpgrade: vi.fn(),
  routerUpgrade: vi.fn(),
  routerProposeAdmin: vi.fn(),
  routerAcceptAdmin: vi.fn(),
}));

vi.mock("../generated/router/src/index.js", () => ({
  StreamType: { Flow: 0, Lockup: 1 },
  Client: class {
    create_flow_stream = generated.createFlow;
    create_lockup_stream = generated.createLockup;
    upgrade_nft = generated.routerUpgradeNft;
    propose_upgrade = generated.routerProposeUpgrade;
    execute_upgrade = generated.routerExecuteUpgrade;
    upgrade = generated.routerUpgrade;
    propose_admin = generated.routerProposeAdmin;
    accept_admin = generated.routerAcceptAdmin;
  },
}));

vi.mock("../generated/stream_nft/src/index.js", () => ({
  StreamType: { Flow: 0, Lockup: 1 },
  Client: class {
    get_stream_data = generated.getStreamData;
    owner_of = generated.ownerOf;
  },
}));

vi.mock("../generated/flow/src/index.js", () => ({
  StreamStatus: {
    Pending: 0,
    StreamingSolvent: 1,
    StreamingInsolvent: 2,
    PausedSolvent: 3,
    PausedInsolvent: 4,
    Voided: 5,
  },
  Client: class {
    propose_upgrade = generated.flowProposeUpgrade;
    execute_upgrade = generated.flowExecuteUpgrade;
    upgrade = generated.flowUpgrade;
    propose_admin = generated.flowProposeAdmin;
    accept_admin = generated.flowAcceptAdmin;
    extend_stream_ttl = generated.flowExtendStreamTtl;
  },
}));

vi.mock("../generated/paymaster/src/index.js", () => ({
  Client: class {
    forward = generated.forward;
  },
}));

vi.mock("../generated/lockup/src/index.js", () => ({
  LockupStatus: {
    Pending: 0,
    Streaming: 1,
    Settled: 2,
    Canceled: 3,
    Depleted: 4,
  },
  Client: class {
    cancel = generated.cancelLockup;
    status_of = generated.lockupStatus;
  },
}));

import { StellarAdminClient } from "./admin-client.js";
import { parseSorobanErrorCode, translateSorobanError } from "./error-parser.js";
import { StellarLockupClient } from "./lockup-client.js";
import { StellarPaymasterClient } from "./paymaster-client.js";
import { StellarRouterClient } from "./router-client.js";
import { StellarStreamNftClient } from "./stream-nft-client.js";
import { assertLockupUnlockAmounts, assertTokenDecimalsMatch } from "./validation.js";

function contractId(seed = 0): string {
  return StrKey.encodeContract(Buffer.alloc(32, seed));
}

const baseConfig = {
  chain: "stellar" as const,
  network: "testnet" as const,
  rpcUrl: "https://rpc.example.com",
  networkPassphrase: "Test SDF Network ; September 2015",
  contracts: { flow: contractId() },
};

describe("Stellar protocol clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes Flow creation through the Router contract", async () => {
    const sender = Keypair.random().publicKey();
    const recipient = Keypair.random().publicKey();
    const token = contractId(2);
    generated.createFlow.mockResolvedValue({ result: 9n });
    const client = new StellarRouterClient({
      ...baseConfig,
      contracts: { ...baseConfig.contracts, router: contractId(1) },
    });

    await client.createFlow({
      sender,
      recipient,
      token: { address: token, decimals: 7 },
      ratePerSecond: 10n ** 18n,
      startTime: 123n,
    });

    expect(generated.createFlow).toHaveBeenCalledWith(
      {
        sender,
        recipient,
        token,
        rate_per_second: 10n ** 18n,
        token_decimals: 7,
        start_time: 123n,
      },
      undefined,
    );
  });

  it("routes validated Lockup creation through the Router contract", async () => {
    const sender = Keypair.random().publicKey();
    const recipient = Keypair.random().publicKey();
    const token = contractId(2);
    generated.createLockup.mockResolvedValue({ result: 10n });
    const client = new StellarRouterClient({
      ...baseConfig,
      contracts: { ...baseConfig.contracts, router: contractId(1) },
    });

    await client.createLockup({
      sender,
      recipient,
      token: { address: token, decimals: 7 },
      totalAmount: 100n,
      startTime: 1_000n,
      endTime: 2_000n,
      cliffTime: 1_200n,
      startUnlockAmount: 10n,
      cliffUnlockAmount: 20n,
      granularitySeconds: 60n,
      cancelable: true,
      transferable: true,
    });

    expect(generated.createLockup).toHaveBeenCalledWith(
      {
        params: {
          sender,
          recipient,
          token,
          total_amount: 100n,
          start_time: 1_000n,
          end_time: 2_000n,
          cliff_time: 1_200n,
          start_unlock_amount: 10n,
          cliff_unlock_amount: 20n,
          granularity: 60n,
          cancelable: true,
        },
      },
      undefined,
    );
  });

  it("rejects invalid Lockup schedules before contract simulation", async () => {
    const sender = Keypair.random().publicKey();
    const client = new StellarRouterClient({
      ...baseConfig,
      contracts: { ...baseConfig.contracts, router: contractId(1) },
    });

    await expect(
      client.createLockup({
        sender,
        recipient: Keypair.random().publicKey(),
        token: { address: contractId(2), decimals: 7 },
        totalAmount: 100n,
        startTime: 2_000n,
        endTime: 1_000n,
      }),
    ).rejects.toThrow("End time must be later than start time");
    expect(generated.createLockup).not.toHaveBeenCalled();
  });

  it("validates Lockup unlock amounts and token decimals client-side", () => {
    expect(() => assertLockupUnlockAmounts(-1n, 0n, 100n)).toThrow("cannot be negative");
    expect(() => assertLockupUnlockAmounts(0n, -5n, 100n)).toThrow("cannot be negative");
    expect(() => assertLockupUnlockAmounts(60n, 50n, 100n)).toThrow("cannot exceed total stream amount");
    expect(() => assertLockupUnlockAmounts(50n, 50n, 100n)).not.toThrow();

    expect(() => assertTokenDecimalsMatch(7, 6)).toThrow("Token decimals mismatch");
    expect(() => assertTokenDecimalsMatch(7, 7)).not.toThrow();
  });

  it("normalizes Stream NFT metadata", async () => {
    generated.getStreamData.mockResolvedValue({ result: [0, 42n] });
    const client = new StellarStreamNftClient({
      ...baseConfig,
      contracts: { ...baseConfig.contracts, streamNft: contractId(3) },
    });

    await expect(client.getStreamData("7")).resolves.toEqual({
      tokenId: "7",
      streamId: "42",
      streamKind: "flow",
    });
  });

  it("loads canonical Router metadata by public NFT token ID", async () => {
    const owner = Keypair.random().publicKey();
    generated.ownerOf.mockResolvedValue({ result: owner });
    generated.getStreamData.mockResolvedValue({ result: [1, 42n] });
    generated.lockupStatus.mockResolvedValue({ result: 3 });
    const client = new StellarRouterClient({
      ...baseConfig,
      contracts: {
        ...baseConfig.contracts,
        router: contractId(1),
        streamNft: contractId(3),
        lockup: contractId(4),
      },
    });

    await expect(client.getStream("7")).resolves.toEqual({
      tokenId: "7",
      coreStreamId: "42",
      streamKind: "lockup",
      status: "canceled",
      owner,
      transferable: true,
    });
  });

  it("reads immutable NFT transferability", async () => {
    const owner = Keypair.random().publicKey();
    generated.ownerOf.mockResolvedValue({ result: owner });
    const client = new StellarStreamNftClient({
      ...baseConfig,
      contracts: { ...baseConfig.contracts, streamNft: contractId(3) },
    });

    await expect(client.isTransferable("7")).resolves.toBe(true);
  });

  it("routes sender cancellation through the Lockup core contract", async () => {
    const sender = Keypair.random().publicKey();
    generated.cancelLockup.mockResolvedValue({ result: 50n });
    generated.lockupStatus.mockResolvedValue({ result: 3 });
    const client = new StellarLockupClient({
      ...baseConfig,
      contracts: { ...baseConfig.contracts, lockup: contractId(4) },
    });

    await client.cancel({ streamId: "42", sender });
    await expect(client.statusOf("42")).resolves.toBe("canceled");
    expect(generated.cancelLockup).toHaveBeenCalledWith(
      { stream_id: 42n, sender },
      undefined,
    );
  });

  it("maps a bounded Paymaster forward request", async () => {
    const user = Keypair.random().publicKey();
    const recipient = Keypair.random().publicKey();
    const feeToken = contractId(4);
    const targetContract = contractId(5);
    generated.forward.mockResolvedValue({ result: null });
    const client = new StellarPaymasterClient({
      ...baseConfig,
      contracts: { ...baseConfig.contracts, paymaster: contractId(6) },
    });

    await client.forward({
      user,
      feeToken,
      feeAmount: 5n,
      maxFeeAmount: 10n,
      expirationLedger: 1234,
      feeRecipient: recipient,
      targetContract,
      functionName: "create_flow_stream",
      args: [user],
    });

    expect(generated.forward).toHaveBeenCalledWith(
      {
        user,
        fee_token: feeToken,
        fee_amount: 5n,
        max_fee_amount: 10n,
        expiration_ledger: 1234,
        fee_recipient: recipient,
        target_contract: targetContract,
        function_name: "create_flow_stream",
        args: [user],
      },
      undefined,
    );
  });

  it("routes administrative maintenance and upgrades", async () => {
    const dummyHash = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const expectedBuffer = Buffer.from(dummyHash, "hex");
    const newAdmin = Keypair.random().publicKey();

    generated.flowProposeUpgrade.mockResolvedValue({ result: null });
    generated.flowExecuteUpgrade.mockResolvedValue({ result: null });
    generated.flowProposeAdmin.mockResolvedValue({ result: null });
    generated.flowAcceptAdmin.mockResolvedValue({ result: null });
    generated.flowExtendStreamTtl.mockResolvedValue({ result: null });
    generated.routerUpgradeNft.mockResolvedValue({ result: null });

    const adminClient = new StellarAdminClient({
      ...baseConfig,
      contracts: {
        ...baseConfig.contracts,
        router: contractId(1),
      },
    });

    await adminClient.flows.proposeUpgrade(dummyHash);
    expect(generated.flowProposeUpgrade).toHaveBeenCalledWith(
      { new_wasm_hash: expectedBuffer },
      undefined,
    );

    await adminClient.flows.executeUpgrade(dummyHash);
    expect(generated.flowExecuteUpgrade).toHaveBeenCalledWith(
      { new_wasm_hash: expectedBuffer },
      undefined,
    );

    await adminClient.flows.proposeAdmin(newAdmin);
    expect(generated.flowProposeAdmin).toHaveBeenCalledWith(
      { new_admin: newAdmin },
      undefined,
    );

    await adminClient.flows.acceptAdmin();
    expect(generated.flowAcceptAdmin).toHaveBeenCalledWith(undefined);

    await adminClient.flows.extendStreamTtl(10n);
    expect(generated.flowExtendStreamTtl).toHaveBeenCalledWith(
      { stream_id: 10n },
      undefined,
    );

    await adminClient.router?.upgradeNft(dummyHash);
    expect(generated.routerUpgradeNft).toHaveBeenCalledWith(
      { new_wasm_hash: expectedBuffer },
      undefined,
    );
  });

  it("parses and translates hardened Soroban contract errors accurately", () => {
    // Lockup 111 is now NegativeUnlockAmount
    expect(parseSorobanErrorCode("HostError: Error(Contract, #111)")).toBe(111);
    const err111 = translateSorobanError(
      new Error("HostError: Error(Contract, #111)"),
      "Fallback",
    );
    expect(err111.message).toContain("Lockup unlock amounts");
    expect(err111.message).toContain("cannot be negative");
    expect(err111.message).toContain("NegativeUnlockAmount");

    // Flow 22 TokenTransferMismatch
    expect(parseSorobanErrorCode("Error(Contract, 22)")).toBe(22);
    const err22 = translateSorobanError(
      new Error("Error(Contract, 22)"),
      "Fallback",
    );
    expect(err22.message).toContain("Token transfer resulted in an unexpected balance change");
    expect(err22.message).toContain("TokenTransferMismatch");

    // Router 305 InvalidContractAddress
    expect(parseSorobanErrorCode("Error(Contract, #305)")).toBe(305);
    const err305 = translateSorobanError(
      new Error("Error(Contract, #305)"),
      "Fallback",
    );
    expect(err305.message).toContain("A required contract address is invalid");
    expect(err305.message).toContain("InvalidContractAddress");
  });
});
