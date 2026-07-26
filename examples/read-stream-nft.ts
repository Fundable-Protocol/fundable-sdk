import { createExampleClient, requireEnv } from "./config.js";

const fundable = createExampleClient({ capability: "streamNft" });

if (!fundable.streamNft) {
  throw new Error("Stream NFT capability is not configured");
}

const tokenId = requireEnv("FUNDABLE_STREAM_NFT_TOKEN_ID");
const [owner, stream] = await Promise.all([
  fundable.streamNft.ownerOf(tokenId),
  fundable.streamNft.getStreamData(tokenId),
]);

console.log(JSON.stringify({ owner, ...stream }, null, 2));
