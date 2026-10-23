const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** Incremental 32-bit FNV-1a hash. */
export class Fnv1a {
  private h = FNV_OFFSET;

  bytes(data: ArrayLike<number>): this {
    let h = this.h;
    for (let i = 0; i < data.length; i++) {
      h ^= (data[i] as number) & 0xff;
      h = Math.imul(h, FNV_PRIME);
    }
    this.h = h;
    return this;
  }

  int32s(data: ArrayLike<number>): this {
    let h = this.h;
    for (let i = 0; i < data.length; i++) {
      const v = data[i] as number;
      for (let s = 0; s < 32; s += 8) {
        h ^= (v >>> s) & 0xff;
        h = Math.imul(h, FNV_PRIME);
      }
    }
    this.h = h;
    return this;
  }

  string(text: string): this {
    let h = this.h;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      h ^= c & 0xff;
      h = Math.imul(h, FNV_PRIME);
      h ^= c >>> 8;
      h = Math.imul(h, FNV_PRIME);
    }
    this.h = h;
    return this;
  }

  digest(): number {
    return this.h >>> 0;
  }

  hex(): string {
    return this.digest().toString(16).padStart(8, '0');
  }
}

export function hashString(text: string): number {
  return new Fnv1a().string(text).digest();
}
