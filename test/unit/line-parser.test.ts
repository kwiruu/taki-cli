import { describe, expect, it } from "vitest";
import { createChunkLineParser } from "../../src/io/line-parser.js";

describe("createChunkLineParser", () => {
  it("emits complete lines and buffers remainder", () => {
    const lines: string[] = [];
    const parser = createChunkLineParser((line) => {
      lines.push(line);
    });

    parser.push("hello");
    parser.push(" world\nsecond");
    parser.push(" line\n");
    parser.flush();

    expect(lines).toEqual(["hello world", "second line"]);
  });

  it("truncates very long lines", () => {
    const lines: string[] = [];
    const parser = createChunkLineParser((line) => {
      lines.push(line);
    }, 5);

    parser.push("123456789\n");

    expect(lines).toEqual(["12345 ...[truncated]"]);
  });
});
