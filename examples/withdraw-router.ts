import { parseUnits } from "@fundable/sdk/core";
import {
  createExampleClient,
  printSimulation,
  requireEnv,
} from "./config.js";

const fundable = createExampleClient({
  capability: "router",
  requirePublicKey: true,
});

if (!fundable.router) {
  throw new Error("Router capability is not configured");
}

const transaction = await fundable.router.withdraw({
  tokenId: requireEnv("FUNDABLE_STREAM_NFT_TOKEN_ID"),
  caller: requireEnv("FUNDABLE_PUBLIC_KEY"),
  to: process.env.FUNDABLE_WITHDRAW_TO?.trim() ||
    requireEnv("FUNDABLE_PUBLIC_KEY"),
  amount: parseUnits(
    process.env.FUNDABLE_WITHDRAW_AMOUNT?.trim() || "1",
    Number(process.env.FUNDABLE_TOKEN_DECIMALS?.trim() || "7"),
  ),
});

printSimulation(transaction);
