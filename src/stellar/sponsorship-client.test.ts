import { describe, expect, it, vi } from "vitest";
import { FundableError } from "../core/index.js";
import { StellarSponsorshipClient } from "./sponsorship-client.js";

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function successfulResponse(data: object, status = 200): Response {
  return jsonResponse({ status: true, data }, status);
}

describe("StellarSponsorshipClient", () => {
  it("authenticates a wallet and uses the bearer session for sponsorship", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        successfulResponse({
          challenge_id: "challenge-id",
          message: "Sign this Fundable challenge",
          expires_at: "2030-01-01T00:00:00.000Z",
        }),
      )
      .mockResolvedValueOnce(
        successfulResponse({
          access_token: "session-token",
          token_type: "Bearer",
          expires_at: "2030-01-01T00:15:00.000Z",
          wallet: { address: "GACCOUNT", network: "TESTNET" },
        }),
      )
      .mockResolvedValueOnce(
        successfulResponse({
          fee_token: "CFEE",
          fee_in_token: "123",
          fee_in_token_ui: "0.0000123",
          conversion_rate: "1",
          max_fee_in_token: "130",
          max_fee_in_token_ui: "0.0000130",
        }),
      );
    const client = new StellarSponsorshipClient({
      backendUrl: "https://api.example.com/",
      fetch: fetcher,
      headers: { "X-Fingerprint": "browser-fingerprint" },
    });
    const sign = vi.fn(async () => "base64-signature");

    await client.authenticate("GACCOUNT", "TESTNET", sign);
    const quote = await client.quote("unsigned-xdr", "TESTNET");

    expect(sign).toHaveBeenCalledWith("Sign this Fundable challenge");
    expect(quote.maximumFee).toBe("130");
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      "https://api.example.com/api/payment-streams/sponsor/quote",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer session-token",
          "X-Fingerprint": "browser-fingerprint",
        }),
      }),
    );
  });

  it("maps a build and submits it with an idempotency key", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        successfulResponse({
          transaction_xdr: "built-xdr",
          user_auth_entry: "auth-entry",
          fee_token: "CFEE",
          fee_in_stroops: "100",
          fee_in_token: "123",
          fee_in_token_ui: "0.0000123",
          max_fee_in_token: "130",
          max_fee_in_token_ui: "0.0000130",
          valid_until: "2030-01-01T00:00:00.000Z",
        }),
      )
      .mockResolvedValueOnce(
        successfulResponse({
          intentId: "intent-1",
          submissionId: "submission-1",
          status: "pending",
          relayerTransactionId: "relayer-1",
          transactionHash: "tx-hash",
          streamId: "7",
          reused: false,
        }),
      );
    const client = new StellarSponsorshipClient({
      backendUrl: "https://api.example.com",
      accessToken: "session-token",
      fetch: fetcher,
    });
    const build = await client.build("unsigned-xdr", "TESTNET");
    const intent = {
      operation: "cancel" as const,
      contract: "CLOCKUP",
      stream_id: "42",
      sender: "GACCOUNT",
    };

    const result = await client.submit({
      build,
      signedAuthEntry: "signed-auth-entry",
      network: "TESTNET",
      intent,
      idempotencyKey: "request-1",
    });

    expect(result.streamTokenId).toBe("7");
    expect(result.transactionHash).toBe("tx-hash");
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "https://api.example.com/api/payment-streams/sponsor/submit",
      expect.objectContaining({
        headers: expect.objectContaining({ "Idempotency-Key": "request-1" }),
      }),
    );
  });

  it("keeps compatibility with unwrapped successful responses", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        challenge_id: "challenge-id",
        message: "Sign this Fundable challenge",
        expires_at: "2030-01-01T00:00:00.000Z",
      }),
    );
    const client = new StellarSponsorshipClient({
      backendUrl: "https://api.example.com",
      fetch: fetcher,
    });

    await expect(client.createChallenge("GACCOUNT", "TESTNET")).resolves.toEqual({
      challengeId: "challenge-id",
      message: "Sign this Fundable challenge",
      expiresAt: "2030-01-01T00:00:00.000Z",
    });
  });

  it("rejects expired builds before calling the backend", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new StellarSponsorshipClient({
      backendUrl: "https://api.example.com",
      accessToken: "session-token",
      fetch: fetcher,
    });

    await expect(
      client.submit({
        build: {
          transactionXdr: "built-xdr",
          userAuthEntry: "auth-entry",
          feeToken: "CFEE",
          networkFeeStroops: "100",
          estimatedFee: "123",
          estimatedFeeUi: "0.0000123",
          maximumFee: "130",
          maximumFeeUi: "0.0000130",
          validUntil: "2020-01-01T00:00:00.000Z",
        },
        signedAuthEntry: "signed-auth-entry",
        network: "TESTNET",
        intent: {
          operation: "pause",
          contract: "CFLOW",
          stream_id: "42",
          sender: "GACCOUNT",
        },
        idempotencyKey: "request-1",
      }),
    ).rejects.toMatchObject<Partial<FundableError>>({
      code: "AUTHORIZATION_EXPIRED",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
