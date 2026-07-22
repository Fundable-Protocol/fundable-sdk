import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const generated = vi.hoisted(() => ({
  getStream: vi.fn(),
  getWithdrawableAmount: vi.fn(),
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
    get_stream = generated.getStream;
    withdrawable_amount_of = generated.getWithdrawableAmount;
  },
}));

import { StellarFlowClient } from "./flow-client.js";

function contractId(): string {
  return StrKey.encodeContract(Buffer.alloc(32));
}

function flowClient(): StellarFlowClient {
  return new StellarFlowClient({
    chain: "stellar",
    network: "testnet",
    rpcUrl: "https://rpc.example.com",
    networkPassphrase: "Test SDF Network ; September 2015",
    contracts: { flow: contractId() },
  });
}

describe("StellarFlowClient queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes generated Soroban stream fields into the shared domain model", async () => {
    const sender = Keypair.random().publicKey();
    const recipient = Keypair.random().publicKey();
    const token = contractId();
    generated.getStream.mockResolvedValue({
      result: {
        balance: 125_000_000n,
        is_voided: false,
        rate_per_second: 10n ** 18n,
        recipient,
        sender,
        snapshot_debt_scaled: 3n,
        snapshot_time: 100n,
        token,
        token_decimals: 7,
      },
    });

    const stream = await flowClient().getStream("42");

    expect(generated.getStream).toHaveBeenCalledWith({ stream_id: 42n });
    expect(stream).toEqual({
      id: "42",
      chain: "stellar",
      balance: 125_000_000n,
      isVoided: false,
      ratePerSecond: 10n ** 18n,
      recipient,
      sender,
      snapshotDebtScaled: 3n,
      snapshotTime: 100n,
      token: { address: token, decimals: 7 },
    });
  });

  it("returns decoded bigint query results instead of assembled transactions", async () => {
    generated.getWithdrawableAmount.mockResolvedValue({ result: 70_000_000n });

    await expect(flowClient().getWithdrawableAmount(42n)).resolves.toBe(
      70_000_000n,
    );
  });
});
