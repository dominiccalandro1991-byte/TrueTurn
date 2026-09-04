export function createId(prefix = "id"): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex}`;
}

export function isId(value: string, prefix?: string): boolean {
  if (prefix) {
    return value.startsWith(`${prefix}_`) && value.length === prefix.length + 1 + 32;
  }
  return /^[a-z]+_[0-9a-f]{32}$/.test(value);
}
