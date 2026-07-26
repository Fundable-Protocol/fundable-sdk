import type {
  CreateFlowInput,
  StellarFundableClient,
} from "@fundable/sdk";

/**
 * Submit a Router Flow with the wallet callbacks supplied when `fundable` was
 * created. This function never receives or stores a secret key.
 */
export async function createRouterFlowWithWallet(
  fundable: StellarFundableClient,
  input: CreateFlowInput,
): Promise<{ tokenId: bigint; transactionHash?: string }> {
  if (!fundable.router) {
    throw new Error("Router capability is not configured");
  }

  const transaction = await fundable.router.createFlow(input);
  const nonInvokerSigners = transaction.needsNonInvokerSigningBy();

  if (nonInvokerSigners.length > 0) {
    throw new Error(
      `Collect Soroban authorization from: ${nonInvokerSigners.join(", ")}`,
    );
  }

  const sent = await transaction.signAndSend();
  return {
    tokenId: sent.result,
    transactionHash: sent.sendTransactionResponse?.hash,
  };
}
