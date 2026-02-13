import { Client as ContractClient } from './generated/distributor/src/index';
import { AssembledTransaction, ClientOptions as ContractClientOptions } from '@stellar/stellar-sdk/contract';
import { UserStats, TokenStats, DistributionHistory } from './generated/distributor/src/index';

/**
 * High-level client for interacting with the Distributor contract.
 * Provides a type-safe and DX-optimized interface for all contract methods.
 */
export class DistributorClient {
    private client: ContractClient;

    /**
     * Create a new DistributorClient.
     * @param options Configuration for the underlying contract client.
     */
    constructor(options: ContractClientOptions) {
        this.client = new ContractClient(options);
    }

    /**
     * Distribute tokens equally among a list of recipients.
     * @param params Parameters including sender, token, total amount, and recipients.
     */
    public async distributeEqual(params: {
        sender: string;
        token: string;
        total_amount: bigint;
        recipients: string[];
    }): Promise<AssembledTransaction<null>> {
        return this.client.distribute_equal(params);
    }

    /**
     * Distribute tokens among a list of recipients with specific amounts for each.
     * @param params Parameters including sender, token, recipients, and amounts.
     */
    public async distributeWeighted(params: {
        sender: string;
        token: string;
        recipients: string[];
        amounts: bigint[];
    }): Promise<AssembledTransaction<null>> {
        return this.client.distribute_weighted(params);
    }

    /**
     * Get the administrator address for the contract.
     */
    public async getAdmin(): Promise<AssembledTransaction<string | undefined>> {
        return this.client.get_admin() as any;
    }

    /**
     * Get stats for a specific user.
     * @param user The address of the user.
     */
    public async getUserStats(user: string): Promise<AssembledTransaction<UserStats | undefined>> {
        return this.client.get_user_stats({ user }) as any;
    }

    /**
     * Get stats for a specific token.
     * @param token The address of the token (contract ID).
     */
    public async getTokenStats(token: string): Promise<AssembledTransaction<TokenStats | undefined>> {
        return this.client.get_token_stats({ token }) as any;
    }

    /**
     * Get the total number of distributions made through the contract.
     */
    public async getTotalDistributions(): Promise<AssembledTransaction<bigint>> {
        return this.client.get_total_distributions();
    }

    /**
     * Get the total amount distributed through the contract.
     */
    public async getTotalDistributedAmount(): Promise<AssembledTransaction<bigint>> {
        return this.client.get_total_distributed_amount();
    }

    /**
     * Get distribution history with pagination.
     * @param startId The ID to start from.
     * @param limit The maximum number of records to return.
     */
    public async getDistributionHistory(startId: bigint, limit: bigint): Promise<AssembledTransaction<DistributionHistory[]>> {
        return this.client.get_distribution_history({ start_id: startId, limit });
    }

    /**
     * Initialize the contract.
     */
    public async initialize(params: {
        admin: string;
        protocol_fee_percent: number;
        fee_address: string;
    }): Promise<AssembledTransaction<null>> {
        return this.client.initialize(params);
    }

    /**
     * Set the protocol fee. Only the administrator can call this.
     */
    public async setProtocolFee(admin: string, newFeePercent: number): Promise<AssembledTransaction<null>> {
        return this.client.set_protocol_fee({ admin, new_fee_percent: newFeePercent });
    }
}
