/** Frozen seeds for public verification tests. These are fixtures, not live secrets. */
export const TEST_VECTORS = {
  serverSeedHex: "11".repeat(32),
  clientSeedHex: "22".repeat(32),
  nonce0: 0,
  nonce1: 1,
  expected: {
    commitment: "02d449a31fbb267c8f352e9968a79e3e5fc95c1bbeaa502fd6454ebde5a4bedc",
    diceNonce0x6: [4, 4, 4, 3, 1, 3],
    diceNonce1x2: [3, 6],
    shuffle0to9: [4, 0, 8, 2, 3, 5, 1, 9, 6, 7],
  },
} as const;
