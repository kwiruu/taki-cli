export class RingBuffer<T> {
  private readonly items: (T | undefined)[];
  private head = 0;
  private length = 0;

  constructor(private readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("RingBuffer capacity must be a positive integer.");
    }

    this.items = new Array<T | undefined>(capacity);
  }

  append(item: T): void {
    this.items[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    this.length = Math.min(this.length + 1, this.capacity);
  }

  toArray(): T[] {
    if (this.length < this.capacity) {
      return this.items.slice(0, this.length) as T[];
    }

    const tail = this.items.slice(this.head) as T[];
    const front = this.items.slice(0, this.head) as T[];
    return tail.concat(front);
  }

  size(): number {
    return this.length;
  }

  clear(): void {
    this.head = 0;
    this.length = 0;
    this.items.fill(undefined);
  }
}
