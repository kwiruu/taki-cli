import React from "react";
import { readFileSync } from "node:fs";
import { Box, Text } from "ink";

const CAT_FALLBACK = [
  "  ／l、             ",
  "（ﾟ､ ｡ ７         ",
  "  l  ~ヽ       ",
  "  じしf_,)ノ",
];

const CAT_LINES = loadCatLines();
const INIT_MATCH_GREEN = "#00ff8a";

export function CatAnimation(): React.JSX.Element {
  return (
    <Box flexDirection="column" marginRight={2}>
      {CAT_LINES.map((line, index) => (
        <Text key={index} color={INIT_MATCH_GREEN}>
          {line.length > 0 ? line : " "}
        </Text>
      ))}
    </Box>
  );
}

function loadCatLines(): string[] {
  try {
    const fileUrl = new URL("../ascii/cat.txt", import.meta.url);
    const fileContents = readFileSync(fileUrl, "utf8");
    const lines = fileContents
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0);

    if (lines.length > 0) {
      return lines;
    }
  } catch {
    // Fallback art keeps UI working even if asset is unavailable.
  }

  return CAT_FALLBACK;
}
