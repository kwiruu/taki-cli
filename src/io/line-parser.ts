type EmitLine = (line: string) => void;

export interface ChunkLineParser {
  push(chunk: string | Buffer): void;
  flush(): void;
}

export function createChunkLineParser(
  emitLine: EmitLine,
  maxLineLength = 4000,
): ChunkLineParser {
  let buffer = "";

  const emitSafe = (raw: string): void => {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (line.length > maxLineLength) {
      emitLine(`${line.slice(0, maxLineLength)} ...[truncated]`);
      return;
    }

    emitLine(line);
  };

  return {
    push(chunk: string | Buffer) {
      buffer += chunk.toString();

      for (;;) {
        const newlineIndex = buffer.indexOf("\n");
        if (newlineIndex === -1) {
          break;
        }

        const line = buffer.slice(0, newlineIndex);
        emitSafe(line);
        buffer = buffer.slice(newlineIndex + 1);
      }

      if (buffer.length > maxLineLength * 4) {
        emitSafe(buffer);
        buffer = "";
      }
    },
    flush() {
      if (buffer.length > 0) {
        emitSafe(buffer);
        buffer = "";
      }
    },
  };
}
