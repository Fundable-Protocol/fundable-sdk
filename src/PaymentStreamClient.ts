import { Client as ContractClient } from './generated/payment-stream/src/index';
import { AssembledTransaction, ClientOptions as ContractClientOptions } from '@stellar/stellar-sdk/contract';
import { Stream, StreamMetrics, ProtocolMetrics, StreamStatus } from './generated/payment-stream/src/index';

/**
 * High-level client for interacting with the Payment Stream contract.
 * Provides a type-safe and DX-optimized interface for all contract methods.
 */
export class PaymentStreamClient {
    private client: ContractClient;

    /**
     * Create a new PaymentStreamClient.
     * @param options Configuration for the underlying contract client.
     */
    constructor(options: ContractClientOptions) {
        this.client = new ContractClient(options);
    }

    /**
     * Create a new payment stream.
     * @param params Stream parameters including sender, recipient, token, and time range.
     * @returns An AssembledTransaction that returns the new stream ID.
     */
    public async createStream(params: {
        sender: string;
        recipient: string;
        token: string;
        total_amount: bigint;
        initial_amount: bigint;
        start_time: bigint;
        end_time: bigint;
    }): Promise<AssembledTransaction<bigint>> {
        return this.client.create_stream(params);
    }

    /**
     * Deposit tokens to an existing stream.
     * @param streamId The ID of the stream to deposit into.
     * @param amount The amount of tokens to deposit.
     */
    public async deposit(streamId: bigint, amount: bigint): Promise<AssembledTransaction<null>> {
        return this.client.deposit({ stream_id: streamId, amount });
    }

    /**
     * Withdraw tokens from a stream.
     * @param streamId The ID of the stream to withdraw from.
     * @param amount The amount of tokens to withdraw.
     */
    public async withdraw(streamId: bigint, amount: bigint): Promise<AssembledTransaction<null>> {
        return this.client.withdraw({ stream_id: streamId, amount });
    }

    /**
     * Withdraw the maximum available amount from a stream.
     * @param streamId The ID of the stream to withdraw from.
     */
    public async withdrawMax(streamId: bigint): Promise<AssembledTransaction<null>> {
        return this.client.withdraw_max({ stream_id: streamId });
    }

    /**
     * Pause a stream. Only the sender can pause a stream.
     * @param streamId The ID of the stream to pause.
     */
    public async pauseStream(streamId: bigint): Promise<AssembledTransaction<null>> {
        return this.client.pause_stream({ stream_id: streamId });
    }

    /**
     * Resume a paused stream. Only the sender can resume a stream.
     * @param streamId The ID of the stream to resume.
     */
    public async resumeStream(streamId: bigint): Promise<AssembledTransaction<null>> {
        return this.client.resume_stream({ stream_id: streamId });
    }

    /**
     * Cancel a stream.
     * @param streamId The ID of the stream to cancel.
     */
    public async cancelStream(streamId: bigint): Promise<AssembledTransaction<null>> {
        return this.client.cancel_stream({ stream_id: streamId });
    }

    /**
     * Get stream details by ID.
     * @param streamId The ID of the stream.
     */
    public async getStream(streamId: bigint): Promise<AssembledTransaction<Stream>> {
        return this.client.get_stream({ stream_id: streamId });
    }

    /**
     * Calculate the current withdrawable amount for a stream.
     * @param streamId The ID of the stream.
     */
    public async getWithdrawableAmount(streamId: bigint): Promise<AssembledTransaction<bigint>> {
        return this.client.withdrawable_amount({ stream_id: streamId });
    }

    /**
     * Set a delegate for withdrawal rights on a stream.
     * @param streamId The ID of the stream.
     * @param delegate The address of the delegate.
     */
    public async setDelegate(streamId: bigint, delegate: string): Promise<AssembledTransaction<null>> {
        return this.client.set_delegate({ stream_id: streamId, delegate });
    }

    /**
     * Revoke the delegate for a stream.
     * @param streamId The ID of the stream.
     */
    public async revokeDelegate(streamId: bigint): Promise<AssembledTransaction<null>> {
        return this.client.revoke_delegate({ stream_id: streamId });
    }

    /**
     * Get the delegate for a stream.
     * @param streamId The ID of the stream.
     */
    public async getDelegate(streamId: bigint): Promise<AssembledTransaction<string | undefined>> {
        // Option<string> is usually returned as string | undefined or similar in the generated client
        return this.client.get_delegate({ stream_id: streamId }) as any;
    }

    /**
     * Get stream-specific metrics.
     * @param streamId The ID of the stream.
     */
    public async getStreamMetrics(streamId: bigint): Promise<AssembledTransaction<StreamMetrics>> {
        return this.client.get_stream_metrics({ stream_id: streamId });
    }

    /**
     * Get protocol-wide metrics.
     */
    public async getProtocolMetrics(): Promise<AssembledTransaction<ProtocolMetrics>> {
        return this.client.get_protocol_metrics();
    }

    /**
     * Get the current protocol fee collector address.
     */
    public async getFeeCollector(): Promise<AssembledTransaction<string>> {
        return this.client.get_fee_collector();
    }

    /**
     * Get the current protocol fee rate.
     */
    public async getProtocolFeeRate(): Promise<AssembledTransaction<number>> {
        return this.client.get_protocol_fee_rate();
    }

    /**
     * Initialize the contract.
     */
    public async initialize(params: {
        admin: string;
        fee_collector: string;
        general_fee_rate: number;
    }): Promise<AssembledTransaction<null>> {
        return this.client.initialize(params);
    }
}
