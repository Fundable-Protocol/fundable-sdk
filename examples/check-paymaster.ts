import { createExampleClient, requireEnv } from "./config.js";

const fundable = createExampleClient({ capability: "paymaster" });

if (!fundable.paymaster) {
  throw new Error("Paymaster capability is not configured");
}

const feeToken = requireEnv("FUNDABLE_FEE_TOKEN_CONTRACT");
const allowed = await fundable.paymaster.isFeeTokenAllowed(feeToken);

console.log(JSON.stringify({ feeToken, allowed }, null, 2));
