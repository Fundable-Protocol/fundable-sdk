import {
  FUNDABLE_ERROR_CODES,
  FundableError,
} from "../core/index.js";

export type StellarSponsorshipNetwork = "MAINNET" | "TESTNET";

export interface StellarWalletChallenge {
  challengeId: string;
  message: string;
  expiresAt: string;
}

export interface StellarWalletSession {
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: string;
  wallet: {
    address: string;
    network: StellarSponsorshipNetwork;
  };
}

export interface StellarSponsorQuote {
  feeToken: string;
  estimatedFee: string;
  estimatedFeeUi: string;
  conversionRate: string;
  maximumFee: string | null;
  maximumFeeUi: string | null;
}

export interface StellarSponsorBuild {
  transactionXdr: string;
  userAuthEntry: string;
  feeToken: string;
  networkFeeStroops: string;
  estimatedFee: string;
  estimatedFeeUi: string;
  maximumFee: string;
  maximumFeeUi: string;
  validUntil: string;
}

interface ExistingStreamIntent {
  contract: string;
  stream_id: string;
}

export type StellarSponsorIntent =
  | {
      operation: "create";
      stream_kind: "lockup";
      sender: string;
      recipient: string;
      token: string;
      start_time: number;
      transferable: boolean;
      total_amount: string;
      end_time: number;
      cliff_time: number;
      start_unlock_amount: string;
      cliff_unlock_amount: string;
      granularity: number;
      cancelable: boolean;
    }
  | {
      operation: "create";
      stream_kind: "flow";
      sender: string;
      recipient: string;
      token: string;
      start_time: number;
      transferable: boolean;
      rate_per_second: string;
      token_decimals: number;
      initial_amount: string;
    }
  | (ExistingStreamIntent & {
      operation: "withdraw";
      caller: string;
      to: string;
      withdraw_max: boolean;
      amount?: string;
    })
  | (ExistingStreamIntent & { operation: "cancel"; sender: string })
  | (ExistingStreamIntent & {
      operation: "deposit";
      funder: string;
      amount: string;
    })
  | (ExistingStreamIntent & { operation: "pause"; sender: string })
  | (ExistingStreamIntent & {
      operation: "restart";
      sender: string;
      rate_per_second: string;
    })
  | (ExistingStreamIntent & {
      operation: "adjust_rate";
      sender: string;
      new_rate: string;
    })
  | (ExistingStreamIntent & {
      operation: "refund";
      sender: string;
      refund_max: boolean;
      amount?: string;
    })
  | (ExistingStreamIntent & { operation: "void"; caller: string });

export interface StellarSponsorSubmission {
  intentId: string;
  submissionId: string;
  status: string;
  relayerTransactionId: string | null;
  transactionHash: string | null;
  streamTokenId: string | null;
  reused: boolean;
}

export interface StellarSponsorshipClientConfig {
  backendUrl: string;
  accessToken?: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}

type SignChallenge = (message: string) => Promise<string>;

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new FundableError({
      code: FUNDABLE_ERROR_CODES.API_REQUEST_FAILED,
      message: `The backend returned an invalid ${field}.`,
      chain: "stellar",
    });
  }
  return value;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export class StellarSponsorshipClient {
  private readonly fetcher: typeof fetch;
  private readonly backendUrl: string;
  private readonly headers: Record<string, string>;
  private accessToken?: string;

  constructor(config: StellarSponsorshipClientConfig) {
    if (!config.backendUrl?.trim()) {
      throw new FundableError({
        code: FUNDABLE_ERROR_CODES.INVALID_CONFIGURATION,
        message: "A backend URL is required for Stellar sponsorship.",
        chain: "stellar",
      });
    }
    this.backendUrl = config.backendUrl.replace(/\/$/, "");
    this.accessToken = config.accessToken;
    this.headers = config.headers ?? {};
    this.fetcher = config.fetch ?? fetch;
  }

  setAccessToken(accessToken: string | undefined): void {
    this.accessToken = accessToken?.trim() || undefined;
  }

  async createChallenge(
    address: string,
    network: StellarSponsorshipNetwork,
  ): Promise<StellarWalletChallenge> {
    const payload = await this.request("/api/auth/wallet/challenge", {
      method: "POST",
      body: { address, network },
      authenticated: false,
    });
    return {
      challengeId: requiredString(payload.challenge_id, "challenge ID"),
      message: requiredString(payload.message, "challenge message"),
      expiresAt: requiredString(payload.expires_at, "challenge expiration"),
    };
  }

  async authenticate(
    address: string,
    network: StellarSponsorshipNetwork,
    signChallenge: SignChallenge,
  ): Promise<StellarWalletSession> {
    const challenge = await this.createChallenge(address, network);
    const signature = await signChallenge(challenge.message);
    const payload = await this.request("/api/auth/wallet/verify", {
      method: "POST",
      body: { challenge_id: challenge.challengeId, signature },
      authenticated: false,
    });
    const accessToken = requiredString(payload.access_token, "access token");
    const session: StellarWalletSession = {
      accessToken,
      tokenType: "Bearer",
      expiresAt: requiredString(payload.expires_at, "session expiration"),
      wallet: {
        address: requiredString(payload.wallet?.address, "wallet address"),
        network: requiredString(payload.wallet?.network, "wallet network") as StellarSponsorshipNetwork,
      },
    };
    this.accessToken = accessToken;
    return session;
  }

  async quote(
    transactionXdr: string,
    network: StellarSponsorshipNetwork,
  ): Promise<StellarSponsorQuote> {
    const payload = await this.sponsorRequest("quote", { transaction_xdr: transactionXdr, network });
    return {
      feeToken: requiredString(payload.fee_token, "fee token"),
      estimatedFee: requiredString(payload.fee_in_token, "estimated fee"),
      estimatedFeeUi: requiredString(payload.fee_in_token_ui, "display fee"),
      conversionRate: requiredString(payload.conversion_rate, "conversion rate"),
      maximumFee: optionalString(payload.max_fee_in_token),
      maximumFeeUi: optionalString(payload.max_fee_in_token_ui),
    };
  }

  async build(
    transactionXdr: string,
    network: StellarSponsorshipNetwork,
  ): Promise<StellarSponsorBuild> {
    const payload = await this.sponsorRequest("build", { transaction_xdr: transactionXdr, network });
    return {
      transactionXdr: requiredString(payload.transaction_xdr, "built transaction XDR"),
      userAuthEntry: requiredString(payload.user_auth_entry, "user authorization entry"),
      feeToken: requiredString(payload.fee_token, "fee token"),
      networkFeeStroops: requiredString(payload.fee_in_stroops, "network fee"),
      estimatedFee: requiredString(payload.fee_in_token, "estimated fee"),
      estimatedFeeUi: requiredString(payload.fee_in_token_ui, "display fee"),
      maximumFee: requiredString(payload.max_fee_in_token, "maximum fee"),
      maximumFeeUi: requiredString(payload.max_fee_in_token_ui, "display maximum fee"),
      validUntil: requiredString(payload.valid_until, "authorization expiration"),
    };
  }

  async submit(input: {
    build: StellarSponsorBuild;
    signedAuthEntry: string;
    network: StellarSponsorshipNetwork;
    intent: StellarSponsorIntent;
    idempotencyKey: string;
  }): Promise<StellarSponsorSubmission> {
    if (this.isBuildExpired(input.build)) {
      throw new FundableError({
        code: FUNDABLE_ERROR_CODES.AUTHORIZATION_EXPIRED,
        message: "The sponsorship authorization has expired. Build it again before submitting.",
        chain: "stellar",
      });
    }
    const payload = await this.request("/api/payment-streams/sponsor/submit", {
      method: "POST",
      body: {
        transaction_xdr: input.build.transactionXdr,
        signed_auth_entry: input.signedAuthEntry,
        network: input.network,
        valid_until: input.build.validUntil,
        intent: input.intent,
      },
      authenticated: true,
      headers: { "Idempotency-Key": input.idempotencyKey },
    });
    return {
      intentId: requiredString(payload.intentId, "intent ID"),
      submissionId: requiredString(payload.submissionId, "submission ID"),
      status: requiredString(payload.status, "submission status"),
      relayerTransactionId: optionalString(payload.relayerTransactionId),
      transactionHash: optionalString(payload.transactionHash),
      streamTokenId: optionalString(payload.streamId),
      reused: payload.reused === true,
    };
  }

  isBuildExpired(build: Pick<StellarSponsorBuild, "validUntil">, now = new Date()): boolean {
    const validUntil = Date.parse(build.validUntil);
    return !Number.isFinite(validUntil) || validUntil <= now.getTime();
  }

  private sponsorRequest(path: "quote" | "build", body: object): Promise<Record<string, any>> {
    return this.request(`/api/payment-streams/sponsor/${path}`, {
      method: "POST",
      body,
      authenticated: true,
    });
  }

  private async request(
    path: string,
    options: {
      method: "POST";
      body: object;
      authenticated: boolean;
      headers?: Record<string, string>;
    },
  ): Promise<Record<string, any>> {
    if (options.authenticated && !this.accessToken) {
      throw new FundableError({
        code: FUNDABLE_ERROR_CODES.AUTHENTICATION_REQUIRED,
        message: "Authenticate the Stellar wallet before requesting sponsorship.",
        chain: "stellar",
      });
    }
    const response = await this.fetcher(`${this.backendUrl}${path}`, {
      method: options.method,
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
        ...options.headers,
        ...(options.authenticated
          ? { Authorization: `Bearer ${this.accessToken}` }
          : {}),
      },
      body: JSON.stringify(options.body),
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, any>;
    if (!response.ok) {
      const message =
        (Array.isArray(payload.message) ? payload.message.join("; ") : payload.message) ??
        payload.error ??
        `Backend request failed with status ${response.status}.`;
      throw new FundableError({
        code: FUNDABLE_ERROR_CODES.API_REQUEST_FAILED,
        message: String(message),
        chain: "stellar",
      });
    }
    return payload;
  }
}
