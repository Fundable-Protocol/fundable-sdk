import { formatUnits } from "@fundable/sdk/core";
import { createExampleClient, requireEnv } from "./config.js";

const fundable = createExampleClient();
const streamId = requireEnv("FUNDABLE_FLOW_STREAM_ID");

const [stream, status, withdrawable] = await Promise.all([
  fundable.flows.getStream(streamId),
  fundable.flows.getStatus(streamId),
  fundable.flows.getWithdrawableAmount(streamId),
]);

console.log(
  JSON.stringify(
    {
      id: stream.id,
      sender: stream.sender,
      recipient: stream.recipient,
      status,
      token: stream.token.address,
      balance: formatUnits(stream.balance, stream.token.decimals),
      ratePerSecond: formatUnits(
        stream.ratePerSecond,
        stream.token.decimals,
      ),
      withdrawable: formatUnits(withdrawable, stream.token.decimals),
    },
    null,
    2,
  ),
);
