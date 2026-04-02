import React from "react";
import { Box, Text } from "ink";
import wrapAnsi from "wrap-ansi";
import type { LogEntry } from "../../types/index.js";

interface DisplayRow {
  id: string;
  label: string;
  labelColor: LogEntry["serviceColor"];
  message: string;
  showLabel: boolean;
}

interface LogViewProps {
  entries: LogEntry[];
  maxVisibleRows?: number;
  width: number;
  borderColor?: string;
  title?: string;
  scrollOffset?: number;
  emptyMessage?: string;
  unboundedHeight?: boolean;
  framed?: boolean;
}

function flattenEntries(entries: LogEntry[], width: number): DisplayRow[] {
  const safeWidth = Math.max(20, width);

  return entries.flatMap((entry) => {
    const label = `[${entry.serviceName}]`;
    const wrapWidth = Math.max(10, safeWidth - label.length - 2);
    const wrapped = wrapAnsi(entry.line || " ", wrapWidth, {
      hard: true,
      trim: false,
    }).split("\n");

    return wrapped.map((message, index) => ({
      id: `${entry.id}-${index}`,
      label,
      labelColor: entry.serviceColor,
      message,
      showLabel: index === 0,
    }));
  });
}

export function LogView({
  entries,
  maxVisibleRows,
  width,
  borderColor = "gray",
  title,
  scrollOffset = 0,
  emptyMessage = "No logs yet. Waiting for services to emit output...",
  unboundedHeight = false,
  framed = true,
}: LogViewProps): React.JSX.Element {
  const rows = flattenEntries(entries, width);
  let visibleRows = rows;

  if (typeof maxVisibleRows === "number") {
    const safeMaxRows = Math.max(1, maxVisibleRows);
    const maxOffset = Math.max(0, rows.length - 1);
    const clampedOffset = Math.max(0, Math.min(scrollOffset, maxOffset));
    const endIndex = Math.max(0, rows.length - clampedOffset);
    const startIndex = Math.max(0, endIndex - safeMaxRows);
    visibleRows = rows.slice(startIndex, endIndex);
  }

  return (
    <Box
      flexDirection="column"
      {...(framed ? { borderStyle: "round" as const, borderColor, paddingX: 1 } : {})}
      {...(unboundedHeight ? {} : { flexGrow: 1 })}
    >
      {title ? <Text color={borderColor}>{title}</Text> : null}
      {visibleRows.length === 0 ? (
        <Text dimColor>{emptyMessage}</Text>
      ) : (
        visibleRows.map((row) => (
          <Text key={row.id} wrap="truncate-end">
            <Text color={row.labelColor}>
              {row.showLabel
                ? `${row.label} `
                : `${" ".repeat(row.label.length)} `}
            </Text>
            <Text>{row.message}</Text>
          </Text>
        ))
      )}
    </Box>
  );
}
