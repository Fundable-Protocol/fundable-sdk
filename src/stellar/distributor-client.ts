import { Buffer } from "buffer";
import {
  Client as GeneratedDistributorClient,
  type DistributionRecord as GeneratedDistributionRecord,
} from "../generated/distributor/src/index.js";
import { toFundableError } from "./error-parser.js";
import {
  buildMerkleTree,
  type MerkleRecipient,
  type MerkleTreeResult,
} from "./merkle.js";
import type { StellarTransaction } from "./flow-client.js";
import type {
  StellarFundableClientConfig,
  StellarMethodOptions,
} from "./types.js";
import { assertPositive, assertStellarAddress } from "./validation.js";

export interface CreateDistributionInput {
  admin: string;
  token: string;
  recipients: MerkleRecipient[];
  deadline?: number | Date;
  uniqueRef?: string | Buffer;
}

export interface CreateDistributionWithRootInput {
  admin: string;
  token: string;
  merkleRoot: string | Buffer;
  totalAmount: bigint | string | number;
  deadline?: number | Date;
  uniqueRef?: string | Buffer;
}

export interface ClaimDistributionInput {
  claimant: string;
  distributionId: number | bigint;
  amount: bigint | string | number;
  proof: (string | Buffer)[];
}

export interface CancelDistributionInput {
  distributionId: number | bigint;
}

export interface DistributionRecord {
  admin: string;
  token: string;
  merkleRoot: string;
  totalAmount: bigint;
  claimedAmount: bigint;
  deadline: bigint;
  isCancelled: boolean;
  uniqueRef: string;
}

export class StellarDistributorClient {
  private readonly client: GeneratedDistributorClient;

  constructor(
    config: StellarFundableClientConfig & { contracts: { distributor: string } },
  ) {
    this.client = new GeneratedDistributorClient({
      contractId: config.contracts.distributor,
      networkPassphrase: config.networkPassphrase,
      rpcUrl: config.rpcUrl,
      publicKey: config.publicKey,
      allowHttp: config.allowHttp,
      headers: config.headers,
      signTransaction: config.signTransaction,
      signAuthEntry: config.signAuthEntry,
    });
  }

  /**
   * Create a new Merkle distribution from a list of recipient allocations.
   * Builds the cryptographic Merkle Tree automatically and submits `create_distribution`.
   */
  async createDistribution(
    input: CreateDistributionInput,
    options?: StellarMethodOptions,
  ): Promise<{
    transaction: StellarTransaction<number>;
    tree: MerkleTreeResult;
  }> {
    assertStellarAddress(input.admin, "Distributor admin");
    assertStellarAddress(input.token, "Token address");

    if (!input.recipients || input.recipients.length === 0) {
      throw new Error("Recipients list cannot be empty");
    }

    const tree = buildMerkleTree(input.recipients);
    let totalAmount = 0n;
    for (const r of input.recipients) {
      const amt = BigInt(r.amount);
      assertPositive(amt, "Recipient allocation amount");
      totalAmount += amt;
    }

    let deadlineSeconds = 0n;
    if (input.deadline) {
      deadlineSeconds =
        typeof input.deadline === "number"
          ? BigInt(input.deadline)
          : BigInt(Math.floor(input.deadline.getTime() / 1000));
    }

    let uniqueRefBuf: Buffer;
    if (input.uniqueRef) {
      uniqueRefBuf =
        typeof input.uniqueRef === "string"
          ? Buffer.from(input.uniqueRef, "utf8")
          : input.uniqueRef;
    } else {
      uniqueRefBuf = Buffer.from(`dist-${Date.now()}`, "utf8");
    }

    try {
      const transaction = await this.client.create_distribution(
        {
          admin: input.admin,
          token: input.token,
          merkle_root: tree.rootBuffer,
          total_amount: totalAmount,
          deadline: deadlineSeconds,
          unique_ref: uniqueRefBuf,
        },
        options,
      );

      return {
        transaction,
        tree,
      };
    } catch (error) {
      throw toFundableError(error, "Failed to create distribution.");
    }
  }

  /**
   * Create a new Merkle distribution with a pre-computed Merkle root.
   */
  async createWithRoot(
    input: CreateDistributionWithRootInput,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<number>> {
    assertStellarAddress(input.admin, "Distributor admin");
    assertStellarAddress(input.token, "Token address");

    const totalAmount = BigInt(input.totalAmount);
    assertPositive(totalAmount, "Total amount");

    const rootBuf =
      typeof input.merkleRoot === "string"
        ? Buffer.from(input.merkleRoot, "hex")
        : input.merkleRoot;

    let deadlineSeconds = 0n;
    if (input.deadline) {
      deadlineSeconds =
        typeof input.deadline === "number"
          ? BigInt(input.deadline)
          : BigInt(Math.floor(input.deadline.getTime() / 1000));
    }

    let uniqueRefBuf: Buffer;
    if (input.uniqueRef) {
      uniqueRefBuf =
        typeof input.uniqueRef === "string"
          ? Buffer.from(input.uniqueRef, "utf8")
          : input.uniqueRef;
    } else {
      uniqueRefBuf = Buffer.from(`dist-${Date.now()}`, "utf8");
    }

    try {
      return await this.client.create_distribution(
        {
          admin: input.admin,
          token: input.token,
          merkle_root: rootBuf,
          total_amount: totalAmount,
          deadline: deadlineSeconds,
          unique_ref: uniqueRefBuf,
        },
        options,
      );
    } catch (error) {
      throw toFundableError(error, "Failed to create distribution with root.");
    }
  }

  /**
   * Claim token allocation from an active distribution by presenting a Merkle proof.
   */
  async claim(
    input: ClaimDistributionInput,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    assertStellarAddress(input.claimant, "Claimant address");
    const amount = BigInt(input.amount);
    assertPositive(amount, "Claim amount");

    const proofBuffers = input.proof.map((p) =>
      typeof p === "string" ? Buffer.from(p, "hex") : p,
    );

    try {
      return await this.client.claim(
        {
          claimant: input.claimant,
          distribution_id: Number(input.distributionId),
          amount,
          proof: proofBuffers,
        },
        options,
      );
    } catch (error) {
      throw toFundableError(error, "Failed to claim distribution allocation.");
    }
  }

  /**
   * Cancel an active distribution and reclaim remaining unclaimed tokens.
   */
  async cancel(
    input: CancelDistributionInput,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    try {
      return await this.client.cancel_distribution(
        {
          distribution_id: Number(input.distributionId),
        },
        options,
      );
    } catch (error) {
      throw toFundableError(error, "Failed to cancel distribution.");
    }
  }

  /**
   * Check if a claimant has already claimed their allocation from a distribution.
   */
  async hasClaimed(distributionId: number | bigint, claimant: string): Promise<boolean> {
    assertStellarAddress(claimant, "Claimant address");
    try {
      const result = await this.client.has_claimed({
        distribution_id: Number(distributionId),
        claimant,
      });
      return result.result;
    } catch (error) {
      throw toFundableError(error, "Failed to query claim status.", "stellar");
    }
  }

  /**
   * Get full on-chain record for a distribution ID.
   */
  async getDistribution(distributionId: number | bigint): Promise<DistributionRecord> {
    try {
      const result = await this.client.get_distribution({
        distribution_id: Number(distributionId),
      });
      const rec = result.result;
      return {
        admin: rec.admin,
        token: rec.token,
        merkleRoot: rec.merkle_root.toString("hex"),
        totalAmount: rec.total_amount,
        claimedAmount: rec.claimed_amount,
        deadline: rec.deadline,
        isCancelled: rec.is_cancelled,
        uniqueRef: rec.unique_ref.toString("utf8"),
      };
    } catch (error) {
      throw toFundableError(error, "Failed to load distribution record.", "stellar");
    }
  }

  /**
   * Get protocol fee percentage (in basis points, e.g. 25 = 0.25%).
   */
  async getProtocolFeePercent(): Promise<number> {
    try {
      const result = await this.client.get_protocol_fee_percent();
      return result.result;
    } catch (error) {
      throw toFundableError(error, "Failed to get protocol fee percent.", "stellar");
    }
  }

  /**
   * Get protocol fee collection address.
   */
  async getProtocolFeeAddress(): Promise<string> {
    try {
      const result = await this.client.get_protocol_fee_address();
      return result.result;
    } catch (error) {
      throw toFundableError(error, "Failed to get protocol fee address.", "stellar");
    }
  }
}
