/**
 * Limits concurrent prefetch jobs; when saturated, waiters resume in
 * priority order (higher priority first). Tie-break FIFO via monotonic seq.
 */
type Waiter = {
  priority: number;
  seq: number;
  resolve: () => void;
};

export class PrefetchPriorityPool {
  private running = 0;
  private seqCounter = 0;
  private readonly heap: Waiter[] = [];

  constructor(private readonly concurrency: number) {}

  async acquire(priority: number): Promise<void> {
    if (this.running < this.concurrency) {
      this.running++;
      return;
    }
    const seq = this.seqCounter++;
    return new Promise<void>((resolve) => {
      this.heapPush({ priority, seq, resolve });
    });
  }

  release(): void {
    if (this.heap.length > 0) {
      const w = this.heapPop();
      w.resolve();
      return;
    }
    this.running--;
  }

  private heapPush(w: Waiter): void {
    this.heap.push(w);
    this.siftUp(this.heap.length - 1);
  }

  private heapPop(): Waiter {
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  /**
   * Max-heap: higher priority first; on tie, smaller seq (earlier waiter) wins.
   */
  private compare(a: Waiter, b: Waiter): number {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return b.seq - a.seq;
  }

  private siftUp(i: number): void {
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (this.compare(this.heap[i], this.heap[p]) <= 0) {
        break;
      }
      [this.heap[i], this.heap[p]] = [this.heap[p], this.heap[i]];
      i = p;
    }
  }

  private siftDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      const l = i * 2 + 1;
      const r = l + 1;
      let largest = i;
      if (l < n && this.compare(this.heap[l], this.heap[largest]) > 0) {
        largest = l;
      }
      if (r < n && this.compare(this.heap[r], this.heap[largest]) > 0) {
        largest = r;
      }
      if (largest === i) {
        break;
      }
      [this.heap[i], this.heap[largest]] = [
        this.heap[largest],
        this.heap[i],
      ];
      i = largest;
    }
  }
}
