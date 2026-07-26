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

const tokenDecimals = Number(
  process.env.FUNDABLE_TOKEN_DECIMALS?.trim() || "7",
);
const transaction = await fundable.router.createFlow({
  sender: requireEnv("FUNDABLE_PUBLIC_KEY"),
  recipient: requireEnv("FUNDABLE_RECIPIENT"),
  token: {
    address: requireEnv("FUNDABLE_TOKEN_CONTRACT"),
    decimals: tokenDecimals,
  },
  ratePerSecond: parseUnits(
    process.env.FUNDABLE_RATE_PER_SECOND?.trim() || "0.001",
    tokenDecimals,
  ),
  startTime: new Date(),
});

printSimulation(transaction);
