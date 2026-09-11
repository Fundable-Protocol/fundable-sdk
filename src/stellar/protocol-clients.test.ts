import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const generated = vi.hoisted(() => ({
  createFlow: vi.fn(),
  createLockup: vi.fn(),
  getStreamData: vi.fn(),
  getStream: vi.fn(),
  isTransferable: vi.fn(),
  cancelLockup: vi.fn(),
  lockupStatus: vi.fn(),
  forward: vi.fn(),
}));

vi.mock("../generated/router/src/index.js", () => ({
  CanonicalStreamStatus: {
    Pending: 0,
    Active: 1,
    Paused: 2,
    Canceled: 3,
    Completed: 4,
    Failed: 5,
  },
  StreamType: { Flow: 0, Lockup: 1 },
  Client: class {
    create_flow_stream = generated.createFlow;
    create_lockup_stream = generated.createLockup;
    get_stream = generated.getStream;
  },
}));

vi.mock("../generated/stream_nft/src/index.js", () => ({
  StreamType: { Flow: 0, Lockup: 1 },
  Client: class {
    get_stream_data = generated.getStreamData;
    is_transferable = generated.isTransferable;
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

import { StellarPaymasterClient } from "./paymaster-client.js";
import { StellarLockupClient } from "./lockup-client.js";
import { StellarRouterClient } from "./router-client.js";
import { StellarStreamNftClient } from "./stream-nft-client.js";

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
        initial_amount: 0n,
        transferable: false,
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
        transferable: true,
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
    generated.getStream.mockResolvedValue({
      result: {
        token_id: 7n,
        core_stream_id: 42n,
        stream_type: 1,
        status: 3,
        owner,
        transferable: true,
      },
    });
    const client = new StellarRouterClient({
      ...baseConfig,
      contracts: { ...baseConfig.contracts, router: contractId(1) },
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
    generated.isTransferable.mockResolvedValue({ result: false });
    const client = new StellarStreamNftClient({
      ...baseConfig,
      contracts: { ...baseConfig.contracts, streamNft: contractId(3) },
    });

    await expect(client.isTransferable("7")).resolves.toBe(false);
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
});
