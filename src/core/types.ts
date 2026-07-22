export const CHAIN_FAMILIES = {
  STELLAR: "stellar",
  EVM: "evm",
} as const;

export type ChainFamily =
  (typeof CHAIN_FAMILIES)[keyof typeof CHAIN_FAMILIES];

export const FLOW_STATUSES = {
  PENDING: "pending",
  STREAMING_SOLVENT: "streaming_solvent",
  STREAMING_INSOLVENT: "streaming_insolvent",
  PAUSED_SOLVENT: "paused_solvent",
  PAUSED_INSOLVENT: "paused_insolvent",
  VOIDED: "voided",
} as const;

export type FlowStatus =
  (typeof FLOW_STATUSES)[keyof typeof FLOW_STATUSES];

export interface TokenReference {
  address: string;
  decimals: number;
  symbol?: string;
}

export interface FlowRecord {
  id: string;
  chain: ChainFamily;
  balance: bigint;
  isVoided: boolean;
  ratePerSecond: bigint;
  recipient: string;
  sender: string;
  snapshotDebtScaled: bigint;
  snapshotTime: bigint;
  token: TokenReference;
}

export interface CreateFlowInput {
  sender: string;
  recipient: string;
  token: TokenReference;
  ratePerSecond: bigint;
  startTime?: bigint | Date;
}

export interface CreateAndDepositFlowInput extends CreateFlowInput {
  amount: bigint;
}

export interface FlowAmountInput {
  streamId: string | bigint;
  amount: bigint;
}

export interface DepositFlowInput extends FlowAmountInput {
  funder: string;
}

export interface WithdrawFlowInput extends FlowAmountInput {
  caller: string;
  to: string;
}

export interface FlowActorInput {
  streamId: string | bigint;
  actor: string;
}

export interface RestartFlowInput extends FlowActorInput {
  ratePerSecond: bigint;
}

export interface AdjustFlowRateInput extends FlowActorInput {
  ratePerSecond: bigint;
}

export const STREAM_KINDS = {
  FLOW: "flow",
  LOCKUP: "lockup",
} as const;

export type StreamKind = (typeof STREAM_KINDS)[keyof typeof STREAM_KINDS];

export interface RouterWithdrawInput {
  tokenId: string | bigint;
  caller: string;
  to: string;
  amount: bigint;
}

export interface StreamNftRecord {
  tokenId: string;
  streamId: string;
  streamKind: StreamKind;
}

export interface TransferStreamNftInput {
  tokenId: string | bigint;
  from: string;
  to: string;
}

export interface PaymasterForwardInput {
  user: string;
  feeToken: string;
  feeAmount: bigint;
  maxFeeAmount: bigint;
  expirationLedger: number;
  feeRecipient: string;
  targetContract: string;
  functionName: string;
  args: readonly unknown[];
}

export interface FundableFlowClient<TTransaction> {
  create(input: CreateFlowInput): Promise<TTransaction>;
  createAndDeposit(input: CreateAndDepositFlowInput): Promise<TTransaction>;
  deposit(input: DepositFlowInput): Promise<TTransaction>;
  withdraw(input: WithdrawFlowInput): Promise<TTransaction>;
  getStream(streamId: string | bigint): Promise<FlowRecord>;
  getStatus(streamId: string | bigint): Promise<FlowStatus>;
  getWithdrawableAmount(streamId: string | bigint): Promise<bigint>;
}
