import { concatBytes, u32be, u64be } from "./bytes.ts";
import { hmacSha256 } from "./hash.ts";

/**
 * Deterministic HMAC-SHA256 byte stream.
 *
 * Block k is HMAC-SHA256(S_server, S_client || nonce_u64be || k_u32be).
 * The original spec's H = HMAC-SHA256(S_server, S_client || N) is block 0.
 */
export class HmacStream {
  private buffer = new Uint8Array(0);
  private offset = 0;
  private block = 0;
  private drained = 0;
  private readonly serverSeed: Uint8Array;
  private readonly clientSeed: Uint8Array;
  private readonly nonce: number;

  constructor(serverSeed: Uint8Array, clientSeed: Uint8Array, nonce: number) {
    if (nonce < 0 || !Number.isInteger(nonce)) {
      throw new Error("Nonce must be a non-negative integer");
    }
    this.serverSeed = serverSeed;
    this.clientSeed = clientSeed;
    this.nonce = nonce;
  }

  bytesConsumed(): number {
    return this.drained;
  }

  async nextByte(): Promise<number> {
    await this.ensure(1);
    const value = this.buffer[this.offset]!;
    this.offset += 1;
    this.drained += 1;
    return value;
  }

  async nextBytes(count: number): Promise<Uint8Array> {
    const out = new Uint8Array(count);
    for (let i = 0; i < count; i++) out[i] = await this.nextByte();
    return out;
  }

  /**
   * Unbiased integer in [0, maxInclusive].
   * Uses 32-bit rejection sampling so the range need not divide 2^32.
   */
  async nextIntInclusive(maxInclusive: number): Promise<number> {
    if (maxInclusive < 0 || !Number.isInteger(maxInclusive)) {
      throw new Error("maxInclusive must be a non-negative integer");
    }
    if (maxInclusive === 0) return 0;
    const limit = maxInclusive + 1;
    const threshold = Math.floor(0x1_0000_0000 / limit) * limit;
    while (true) {
      const b = await this.nextBytes(4);
      const value = ((b[0]! << 24) | (b[1]! << 16) | (b[2]! << 8) | b[3]!) >>> 0;
      if (value < threshold) return value % limit;
    }
  }

  private async ensure(n: number): Promise<void> {
    while (this.buffer.length - this.offset < n) {
      const next = await hmacBlock(this.serverSeed, this.clientSeed, this.nonce, this.block);
      this.block += 1;
      if (this.offset === 0) {
        const merged = new Uint8Array(this.buffer.length + next.length);
        merged.set(this.buffer);
        merged.set(next, this.buffer.length);
        this.buffer = merged;
      } else {
        const remain = this.buffer.subarray(this.offset);
        const merged = new Uint8Array(remain.length + next.length);
        merged.set(remain);
        merged.set(next, remain.length);
        this.buffer = merged;
        this.offset = 0;
      }
    }
  }
}

export async function hmacBlock(
  serverSeed: Uint8Array,
  clientSeed: Uint8Array,
  nonce: number,
  block: number,
): Promise<Uint8Array> {
  const message = concatBytes(clientSeed, u64be(nonce), u32be(block));
  return hmacSha256(serverSeed, message);
}

export async function specHash(
  serverSeed: Uint8Array,
  clientSeed: Uint8Array,
  nonce: number,
): Promise<Uint8Array> {
  return hmacBlock(serverSeed, clientSeed, nonce, 0);
}
