import {
  STREAM_KINDS,
  toFundableError,
  type StreamNftRecord,
  type TransferStreamNftInput,
} from "../core/index.js";
import {
  Client as GeneratedStreamNftClient,
  StreamType as GeneratedStreamType,
} from "../generated/stream_nft/src/index.js";
import type { StellarFundableClientConfig, StellarMethodOptions } from "./types.js";
import type { StellarTransaction } from "./flow-client.js";
import { assertStellarAddress, toTokenId } from "./validation.js";

export class StellarStreamNftClient {
  private readonly client: GeneratedStreamNftClient;

  constructor(config: StellarFundableClientConfig & { contracts: { streamNft: string } }) {
    this.client = new GeneratedStreamNftClient({
      contractId: config.contracts.streamNft,
      networkPassphrase: config.networkPassphrase,
      rpcUrl: config.rpcUrl,
      publicKey: config.publicKey,
      allowHttp: config.allowHttp,
      headers: config.headers,
      signTransaction: config.signTransaction,
      signAuthEntry: config.signAuthEntry,
    });
  }

  async ownerOf(tokenId: string | bigint): Promise<string> {
    try {
      const transaction = await this.client.owner_of({ token_id: toTokenId(tokenId) });
      return transaction.result;
    } catch (error) {
      throw toFundableError(error, "Failed to load stream NFT owner.", "stellar");
    }
  }

  async balanceOf(owner: string): Promise<bigint> {
    assertStellarAddress(owner, "NFT owner");
    try {
      const transaction = await this.client.balance({ owner });
      return transaction.result;
    } catch (error) {
      throw toFundableError(error, "Failed to load stream NFT balance.", "stellar");
    }
  }

  async getStreamData(tokenId: string | bigint): Promise<StreamNftRecord> {
    const id = toTokenId(tokenId);
    try {
      const transaction = await this.client.get_stream_data({ token_id: id });
      const [streamType, streamId] = transaction.result;
      if (
        streamType !== GeneratedStreamType.Flow &&
        streamType !== GeneratedStreamType.Lockup
      ) {
        throw new Error(`Unknown stream NFT type: ${streamType}`);
      }
      return {
        tokenId: id.toString(),
        streamId: streamId.toString(),
        streamKind:
          streamType === GeneratedStreamType.Flow
            ? STREAM_KINDS.FLOW
            : STREAM_KINDS.LOCKUP,
      };
    } catch (error) {
      throw toFundableError(error, "Failed to load stream NFT data.", "stellar");
    }
  }

  async isTransferable(tokenId: string | bigint): Promise<boolean> {
    try {
      const transaction = await this.client.is_transferable({
        token_id: toTokenId(tokenId),
      });
      return transaction.result;
    } catch (error) {
      throw toFundableError(
        error,
        "Failed to load stream NFT transferability.",
        "stellar",
      );
    }
  }

  async transfer(
    input: TransferStreamNftInput,
    options?: StellarMethodOptions,
  ): Promise<StellarTransaction<null>> {
    assertStellarAddress(input.from, "Current NFT owner");
    assertStellarAddress(input.to, "New NFT owner");
    return this.client.transfer(
      { from: input.from, to: input.to, token_id: toTokenId(input.tokenId) },
      options,
    );
  }
}
