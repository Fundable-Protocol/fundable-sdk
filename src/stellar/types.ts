import type {
  ClientOptions as ContractClientOptions,
  MethodOptions,
} from "@stellar/stellar-sdk/contract";
import type { StellarSponsorshipClientConfig } from "./sponsorship-client.js";

export const STELLAR_NETWORKS = {
  PUBLIC: "public",
  TESTNET: "testnet",
  CUSTOM: "custom",
} as const;

export type StellarNetwork =
  (typeof STELLAR_NETWORKS)[keyof typeof STELLAR_NETWORKS];

export interface StellarContractAddresses {
  flow: string;
  lockup?: string;
  router?: string;
  streamNft?: string;
  paymaster?: string;
  distributor?: string;
}

export interface StellarFundableClientConfig {
  chain: "stellar";
  network: StellarNetwork;
  rpcUrl: string;
  networkPassphrase: string;
  contracts: StellarContractAddresses;
  publicKey?: string;
  allowHttp?: boolean;
  headers?: Record<string, string>;
  signTransaction?: ContractClientOptions["signTransaction"];
  signAuthEntry?: ContractClientOptions["signAuthEntry"];
  sponsorship?: StellarSponsorshipClientConfig;
}

export type StellarMethodOptions = MethodOptions;
