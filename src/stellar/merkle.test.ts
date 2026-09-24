import { describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import {
  buildMerkleTree,
  computeSorobanLeaf,
  verifyMerkleProof,
} from "./merkle.js";

describe("Soroban Merkle Tree", () => {
  it("matches deterministic leaf vector computed in Rust Soroban SDK", () => {
    const claimant = "GDZJSPRSBTAJPAQ4NG6Y2ZCWHEX5HMS253TYVNAQJRPJHY27JPOHBIPZ";
    const amount = 10_000_000n; // 10 XLM / stroops

    const leafBuf = computeSorobanLeaf(claimant, amount);
    const leafHex = leafBuf.toString("hex");

    // Must match Rust Soroban test vector:
    expect(leafHex).toBe(
      "1c1cc7140b08a1b22387c68d05bad1b6185f6ed71c300a3ede78ab707256a8b5",
    );
  });

  it("builds a single-leaf tree correctly", () => {
    const recipients = [
      {
        address: "GDZJSPRSBTAJPAQ4NG6Y2ZCWHEX5HMS253TYVNAQJRPJHY27JPOHBIPZ",
        amount: 10_000_000n,
      },
    ];
    const tree = buildMerkleTree(recipients);
    expect(tree.leaves.length).toBe(1);
    expect(tree.root).toBe(tree.leaves[0].leafHex);
    expect(tree.proofs[0].proof).toEqual([]);
    expect(verifyMerkleProof([], tree.root, tree.leaves[0].leafHex)).toBe(true);
  });

  it("builds a multi-leaf tree and generates valid verification proofs", () => {
    const recipients = [
      {
        address: Keypair.random().publicKey(),
        amount: 1_000_000n,
      },
      {
        address: Keypair.random().publicKey(),
        amount: 2_000_000n,
      },
      {
        address: Keypair.random().publicKey(),
        amount: 3_000_000n,
      },
      {
        address: Keypair.random().publicKey(),
        amount: 4_000_000n,
      },
    ];

    const tree = buildMerkleTree(recipients);
    expect(tree.leaves.length).toBe(4);
    expect(tree.proofs.length).toBe(4);

    for (const item of tree.proofs) {
      const isValid = verifyMerkleProof(item.proof, tree.root, item.leaf);
      expect(isValid).toBe(true);
    }

    // Tampered amount or address fails verification
    const invalidLeaf = computeSorobanLeaf(recipients[0].address, 999_999n);
    expect(
      verifyMerkleProof(tree.proofs[0].proof, tree.root, invalidLeaf.toString("hex")),
    ).toBe(false);
  });
});
