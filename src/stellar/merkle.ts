import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import { keccak_256 } from "@noble/hashes/sha3.js";

export interface MerkleRecipient {
  address: string;
  amount: bigint | string | number;
}

export interface MerkleTreeLeaf {
  recipient: MerkleRecipient;
  leafHash: Buffer;
  leafHex: string;
}

export interface MerkleProofItem {
  recipient: MerkleRecipient;
  leaf: string; // hex
  proof: string[]; // array of 32-byte hex strings
}

export interface MerkleTreeResult {
  root: string; // 32-byte hex
  rootBuffer: Buffer;
  leaves: MerkleTreeLeaf[];
  proofs: MerkleProofItem[];
}

/**
 * Compute the leaf hash for a claimant and amount matching Soroban Distributor.
 * 
 * Leaf = keccak256(claimant_xdr || amount_be_16_bytes)
 * 
 * @param claimant G... or C... Stellar address
 * @param amount Token amount in base stroops/units (i128)
 */
export function computeSorobanLeaf(
  claimant: string,
  amount: bigint | string | number,
): Buffer {
  // 1. Serialize claimant Address to XDR bytes via Stellar SDK
  const addressObj = Address.fromString(claimant.trim());
  const claimantXdrBuffer = addressObj.toScVal().toXDR();

  // 2. Serialize amount as big-endian 16-byte signed 128-bit integer
  const amountBigInt = BigInt(amount);
  const amountBuffer = Buffer.alloc(16);

  // Write big-endian 128-bit signed integer
  let n = amountBigInt;
  if (n < 0n) {
    n = (1n << 128n) + n;
  }
  const high = n >> 64n;
  const low = n & 0xffffffffffffffffn;

  amountBuffer.writeBigUInt64BE(high, 0);
  amountBuffer.writeBigUInt64BE(low, 8);

  // 3. Concatenate and compute keccak256
  const preimage = Buffer.concat([claimantXdrBuffer, amountBuffer]);
  const hashArray = keccak_256(preimage);
  return Buffer.from(hashArray);
}

/**
 * Hash two 32-byte values together in sorted order (smaller hash first).
 * Matches Soroban Distributor hash_pair(a, b).
 */
export function hashPair(a: Buffer, b: Buffer): Buffer {
  let combined: Buffer;
  if (Buffer.compare(a, b) <= 0) {
    combined = Buffer.concat([a, b]);
  } else {
    combined = Buffer.concat([b, a]);
  }
  return Buffer.from(keccak_256(combined));
}

/**
 * Build a complete Merkle Tree from a list of recipient allocations.
 * Computes deterministic root and individual proofs for each recipient.
 */
export function buildMerkleTree(recipients: MerkleRecipient[]): MerkleTreeResult {
  if (!recipients || recipients.length === 0) {
    throw new Error("Recipients list cannot be empty");
  }

  const leaves: MerkleTreeLeaf[] = recipients.map((recipient) => {
    const leafBuf = computeSorobanLeaf(recipient.address, recipient.amount);
    return {
      recipient,
      leafHash: leafBuf,
      leafHex: leafBuf.toString("hex"),
    };
  });

  if (leaves.length === 1) {
    const single = leaves[0];
    return {
      root: single.leafHex,
      rootBuffer: single.leafHash,
      leaves,
      proofs: [
        {
          recipient: single.recipient,
          leaf: single.leafHex,
          proof: [],
        },
      ],
    };
  }

  // Build layers from bottom to top
  const layers: Buffer[][] = [leaves.map((l) => l.leafHash)];

  while (layers[layers.length - 1].length > 1) {
    const currentLayer = layers[layers.length - 1];
    const nextLayer: Buffer[] = [];

    for (let i = 0; i < currentLayer.length; i += 2) {
      if (i + 1 < currentLayer.length) {
        nextLayer.push(hashPair(currentLayer[i], currentLayer[i + 1]));
      } else {
        // Odd node is carried over to next level
        nextLayer.push(currentLayer[i]);
      }
    }
    layers.push(nextLayer);
  }

  const rootBuffer = layers[layers.length - 1][0];
  const rootHex = rootBuffer.toString("hex");

  // Generate proofs for each leaf
  const proofs: MerkleProofItem[] = leaves.map((leaf, index) => {
    const proof: string[] = [];
    let currentIndex = index;

    for (let layerIndex = 0; layerIndex < layers.length - 1; layerIndex++) {
      const currentLayer = layers[layerIndex];
      const isRightNode = currentIndex % 2 === 1;
      const pairIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;

      if (pairIndex < currentLayer.length) {
        proof.push(currentLayer[pairIndex].toString("hex"));
      }

      currentIndex = Math.floor(currentIndex / 2);
    }

    return {
      recipient: leaf.recipient,
      leaf: leaf.leafHex,
      proof,
    };
  });

  return {
    root: rootHex,
    rootBuffer,
    leaves,
    proofs,
  };
}

/**
 * Verify a Merkle proof against a known root and leaf hash.
 */
export function verifyMerkleProof(
  proof: (Buffer | string)[],
  root: Buffer | string,
  leaf: Buffer | string,
): boolean {
  const rootBuf = typeof root === "string" ? Buffer.from(root, "hex") : root;
  let current = typeof leaf === "string" ? Buffer.from(leaf, "hex") : leaf;

  for (const sibling of proof) {
    const siblingBuf =
      typeof sibling === "string" ? Buffer.from(sibling, "hex") : sibling;
    current = hashPair(current, siblingBuf);
  }

  return Buffer.compare(current, rootBuf) === 0;
}

/**
 * Alias for buildMerkleTree
 */
export const generateDistributionMerkleTree = buildMerkleTree;

