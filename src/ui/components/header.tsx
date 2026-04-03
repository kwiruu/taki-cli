import React from "react";
import { Box, Text } from "ink";
import { countReady, countRunning, formatUptime } from "../formatters.js";
import type { ServiceState } from "../../types/index.js";
import type { RunThemeTokens } from "../../theme/index.js";
import { CatAnimation } from "./cat-animation.js";

interface HeaderProps {
  serviceStates: ServiceState[];
  startedAt: number;
  now: number;
  selectedServiceName?: string;
  isSplitMode?: boolean;
  theme: RunThemeTokens;
}

export function Header({
  serviceStates,
  startedAt,
  now,
  selectedServiceName,
  isSplitMode = false,
  theme,
}: HeaderProps): React.JSX.Element {
  const running = countRunning(serviceStates);
  const ready = countReady(serviceStates);

  return (
    <Box
      borderStyle={theme.borderStyle}
      borderColor={theme.headerBorderColor}
      paddingX={0}
      paddingY={0}
      flexDirection="row"
      alignItems="flex-start"
    >
      <CatAnimation color={theme.catColor} />
      <Box flexDirection="column" flexGrow={1}>
        <Text color={theme.headerTitleColor}>Taki CLI</Text>
        <Text>{`Active ${running}/${serviceStates.length} | Ready ${ready}/${serviceStates.length} | Uptime ${formatUptime(startedAt, now)}`}</Text>
        <Text>{`Selected: ${selectedServiceName ?? "n/a"}`}</Text>
        <Box flexWrap="wrap">
          {serviceStates.map((state) => (
            <Text
              key={state.name}
              color={theme.statusColors[state.status]}
            >{`${state.name}:${state.status}${state.ready ? "(ready)" : ""} `}</Text>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
