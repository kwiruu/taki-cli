import { describe, expect, it } from "vitest";
import { RingBuffer } from "../../src/io/ring-buffer.js";

describe("RingBuffer", () => {
  it("keeps insertion order up to capacity", () => {
    const buffer = new RingBuffer<number>(3);
    buffer.append(1);
    buffer.append(2);
    buffer.append(3);

    expect(buffer.toArray()).toEqual([1, 2, 3]);
  });

  it("drops oldest entries when over capacity", () => {
    const buffer = new RingBuffer<number>(2);
    buffer.append(1);
    buffer.append(2);
    buffer.append(3);

    expect(buffer.toArray()).toEqual([2, 3]);
  });
});
