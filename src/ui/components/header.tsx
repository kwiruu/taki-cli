import React from "react";
import { Box, Text } from "ink";
import { countReady, countRunning, formatUptime } from "../formatters.js";
import type { ServiceState } from "../../types/index.js";
import { CatAnimation } from "./cat-animation.js";

interface HeaderProps {
  serviceStates: ServiceState[];
  startedAt: number;
  now: number;
  selectedServiceName?: string;
  isSplitMode?: boolean;
}

const STATUS_COLOR: Record<
  ServiceState["status"],
  "green" | "yellow" | "red" | "gray"
> = {
  starting: "yellow",
  running: "green",
  exited: "gray",
  failed: "red",
  stopped: "gray",
};

export function Header({
  serviceStates,
  startedAt,
  now,
  selectedServiceName,
  isSplitMode = false,
}: HeaderProps): React.JSX.Element {
  const running = countRunning(serviceStates);
  const ready = countReady(serviceStates);

  return (
    <Box
      borderStyle="round"
      borderColor="green"
      paddingX={1}
      paddingY={0}
      flexDirection="row"
      alignItems="flex-start"
    >
      <CatAnimation />
      <Box flexDirection="column" flexGrow={1}>
        <Text color="greenBright">Taki CLI</Text>
        <Text>{`Active ${running}/${serviceStates.length} | Ready ${ready}/${serviceStates.length} | Uptime ${formatUptime(startedAt, now)}`}</Text>
        <Text>{`Selected: ${selectedServiceName ?? "n/a"}`}</Text>
        <Box flexWrap="wrap">
          {serviceStates.map((state) => (
            <Text
              key={state.name}
              color={STATUS_COLOR[state.status]}
            >{`${state.name}:${state.status}${state.ready ? "(ready)" : ""} `}</Text>
          ))}
        </Box>
        <Text dimColor>
          {isSplitMode
            ? "split: arrows or h/j/k/l focus panes | Tab next pane | o options | q quit"
            : "single pane: up/down select service | o options | q quit"}
        </Text>
      </Box>
    </Box>
  );
}
