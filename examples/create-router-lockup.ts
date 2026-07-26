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
const startTime = BigInt(Math.floor(Date.now() / 1_000) + 300);
const durationSeconds = 30n * 24n * 60n * 60n;

const transaction = await fundable.router.createLockup({
  sender: requireEnv("FUNDABLE_PUBLIC_KEY"),
  recipient: requireEnv("FUNDABLE_RECIPIENT"),
  token: {
    address: requireEnv("FUNDABLE_TOKEN_CONTRACT"),
    decimals: tokenDecimals,
  },
  totalAmount: parseUnits(
    process.env.FUNDABLE_TOTAL_AMOUNT?.trim() || "100",
    tokenDecimals,
  ),
  startTime,
  endTime: startTime + durationSeconds,
  cliffTime: startTime + 7n * 24n * 60n * 60n,
  granularitySeconds: 3_600n,
  cancelable: true,
});

printSimulation(transaction);
