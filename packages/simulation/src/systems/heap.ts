/** Binary min-heap of node indices keyed by float priority; ties break on the lower node index. */
export class MinHeap {
  private nodes: Int32Array;
  private keys: Float64Array;
  size = 0;
  /** Key of the node returned by the last `pop`. */
  lastKey = 0;

  constructor(capacity = 1024) {
    this.nodes = new Int32Array(capacity);
    this.keys = new Float64Array(capacity);
  }

  push(node: number, key: number): void {
    if (this.size === this.nodes.length) this.grow();
    const nodes = this.nodes;
    const keys = this.keys;
    let i = this.size++;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const pk = keys[parent] as number;
      if (!(key < pk || (key === pk && node < (nodes[parent] as number)))) break;
      nodes[i] = nodes[parent] as number;
      keys[i] = pk;
      i = parent;
    }
    nodes[i] = node;
    keys[i] = key;
  }

  /** Removes the minimum; returns the node, with its key available via `lastKey`. */
  pop(): number {
    const nodes = this.nodes;
    const keys = this.keys;
    const top = nodes[0] as number;
    this.lastKey = keys[0] as number;
    const n = --this.size;
    if (n > 0) {
      const node = nodes[n] as number;
      const key = keys[n] as number;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        let m = l;
        if (r < n) {
          const kr = keys[r] as number;
          const kl = keys[l] as number;
          if (kr < kl || (kr === kl && (nodes[r] as number) < (nodes[l] as number))) m = r;
        }
        const km = keys[m] as number;
        if (!(km < key || (km === key && (nodes[m] as number) < node))) break;
        nodes[i] = nodes[m] as number;
        keys[i] = km;
        i = m;
      }
      nodes[i] = node;
      keys[i] = key;
    }
    return top;
  }

  private grow(): void {
    const nodes = new Int32Array(this.nodes.length * 2);
    const keys = new Float64Array(this.keys.length * 2);
    nodes.set(this.nodes);
    keys.set(this.keys);
    this.nodes = nodes;
    this.keys = keys;
  }
}
