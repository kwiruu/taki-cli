import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { Header } from "./components/header.js";
import { LogView } from "./components/log-view.js";
import { RingBuffer } from "../io/ring-buffer.js";
import type { LogEntry, ServiceState } from "../types/index.js";
import type { ProcessManager } from "../core/process-manager.js";

interface AppProps {
  manager: ProcessManager;
  logBuffer: RingBuffer<LogEntry>;
  startedAt: number;
  maxDisplayLines: number;
  onQuitRequest: () => void;
}

interface Dimensions {
  columns: number;
  rows: number;
}

type ViewMode = "normal" | "options" | "full-log";
type OptionsMenu = "root" | "layout" | "count" | "grid";
type LayoutMode = "single" | "vertical" | "horizontal" | "grid";

const MIN_PANES = 1;
const MAX_PANES = 8;
const MIN_GRID = 1;
const MAX_GRID = 6;

const ROOT_OPTIONS_BASE = [
  "Open full log for focused service",
  "Choose layout mode",
  "Configure pane amount",
  "Close options",
] as const;

const LAYOUT_OPTIONS = [
  "Single pane",
  "Vertical panes",
  "Horizontal panes",
  "Grid panes",
  "Back",
] as const;

function getDimensions(stdout: NodeJS.WriteStream): Dimensions {
  return {
    columns: stdout.columns ?? 100,
    rows: stdout.rows ?? 30,
  };
}

export function App({
  manager,
  logBuffer,
  startedAt,
  maxDisplayLines,
  onQuitRequest,
}: AppProps): React.JSX.Element {
  const { stdout } = useStdout();
  const [serviceStates, setServiceStates] = useState<ServiceState[]>(
    manager.getServiceStates(),
  );
  const [allEntries, setAllEntries] = useState<LogEntry[]>([]);
  const [now, setNow] = useState(Date.now());
  const [singleSelectedIndex, setSingleSelectedIndex] = useState(0);
  const [focusedPaneIndex, setFocusedPaneIndex] = useState(0);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("single");
  const [paneCount, setPaneCount] = useState(2);
  const [gridColumns, setGridColumns] = useState(2);
  const [gridRows, setGridRows] = useState(2);
  const [viewMode, setViewMode] = useState<ViewMode>("normal");
  const [optionsMenu, setOptionsMenu] = useState<OptionsMenu>("root");
  const [optionsIndex, setOptionsIndex] = useState(0);
  const [isRestarting, setIsRestarting] = useState(false);
  const [dimensions, setDimensions] = useState<Dimensions>(
    getDimensions(stdout),
  );

  const serviceNames = useMemo(
    () => serviceStates.map((state) => state.name),
    [serviceStates],
  );

  const activePaneCount = useMemo(() => {
    if (layoutMode === "single") {
      return 1;
    }
    if (layoutMode === "grid") {
      return Math.max(1, gridColumns * gridRows);
    }
    return Math.max(MIN_PANES, paneCount);
  }, [gridColumns, gridRows, layoutMode, paneCount]);

  const activePaneCountSafe = Math.max(1, activePaneCount);

  const geometry = useMemo(() => {
    if (layoutMode === "grid") {
      return {
        rows: Math.max(1, gridRows),
        columns: Math.max(1, gridColumns),
      };
    }

    if (layoutMode === "vertical") {
      return {
        rows: 1,
        columns: activePaneCountSafe,
      };
    }

    if (layoutMode === "horizontal") {
      return {
        rows: activePaneCountSafe,
        columns: 1,
      };
    }

    return {
      rows: 1,
      columns: 1,
    };
  }, [activePaneCountSafe, gridColumns, gridRows, layoutMode]);

  const paneList = useMemo(
    () => Array.from({ length: activePaneCountSafe }, (_, index) => index),
    [activePaneCountSafe],
  );

  const singleServiceName =
    serviceNames.length > 0
      ? serviceNames[Math.min(singleSelectedIndex, serviceNames.length - 1)]
      : undefined;

  const paneServiceNames = useMemo(() => {
    if (layoutMode === "single") {
      return [singleServiceName];
    }

    return paneList.map((paneIndex) => serviceNames[paneIndex]);
  }, [layoutMode, paneList, serviceNames, singleServiceName]);

  const selectedServiceName =
    paneServiceNames[Math.min(focusedPaneIndex, paneServiceNames.length - 1)];

  const rootOptions = useMemo(() => {
    const amountLabel =
      layoutMode === "grid"
        ? `Configure grid (${gridColumns} cols x ${gridRows} rows)`
        : `Configure pane count (${paneCount})`;

    return [
      ROOT_OPTIONS_BASE[0],
      ROOT_OPTIONS_BASE[1],
      amountLabel,
      ROOT_OPTIONS_BASE[3],
    ];
  }, [gridColumns, gridRows, layoutMode, paneCount]);

  const countOptions = useMemo(() => {
    const options: string[] = [];
    for (let index = MIN_PANES; index <= MAX_PANES; index += 1) {
      options.push(`${index} panes`);
    }
    options.push("Back");
    return options;
  }, []);

  const options = useMemo(() => {
    switch (optionsMenu) {
      case "layout":
        return [...LAYOUT_OPTIONS];
      case "count":
        return countOptions;
      case "grid":
        return [
          `Columns: ${gridColumns}`,
          `Rows: ${gridRows}`,
          "Apply grid layout",
          "Back",
        ];
      case "root":
      default:
        return rootOptions;
    }
  }, [countOptions, gridColumns, gridRows, optionsMenu, rootOptions]);

  const paneEntries = useMemo(
    () =>
      paneServiceNames.map((serviceName) => {
        const scopedEntries = serviceName
          ? allEntries.filter((entry) => entry.serviceName === serviceName)
          : [];
        return scopedEntries.slice(-maxDisplayLines);
      }),
    [allEntries, paneServiceNames, maxDisplayLines],
  );

  const fullLogEntries = useMemo(() => {
    if (!selectedServiceName) {
      return [];
    }

    return allEntries.filter(
      (entry) => entry.serviceName === selectedServiceName,
    );
  }, [allEntries, selectedServiceName]);

  const paneWidth = useMemo(
    () =>
      Math.max(
        24,
        Math.floor(dimensions.columns / Math.max(1, geometry.columns)),
      ),
    [dimensions.columns, geometry.columns],
  );

  const baseVisibleRows = useMemo(
    () => Math.max(4, dimensions.rows - 19),
    [dimensions.rows],
  );

  const paneRows = useMemo(
    () => Math.max(3, Math.floor(baseVisibleRows / Math.max(1, geometry.rows))),
    [baseVisibleRows, geometry.rows],
  );

  const moveFocusedServiceSelection = (direction: -1 | 1): void => {
    if (serviceNames.length === 0) {
      return;
    }

    setSingleSelectedIndex((previous) => {
      if (direction < 0) {
        return previous <= 0 ? serviceNames.length - 1 : previous - 1;
      }
      return (previous + 1) % serviceNames.length;
    });
  };

  const closeOptions = (): void => {
    setViewMode("normal");
    setOptionsMenu("root");
    setOptionsIndex(0);
  };

  const moveFocusBy = (rowDelta: number, columnDelta: number): void => {
    if (activePaneCountSafe <= 1) {
      return;
    }

    setFocusedPaneIndex((previous) => {
      const rows = Math.max(1, geometry.rows);
      const columns = Math.max(1, geometry.columns);
      const row = Math.floor(previous / columns);
      const column = previous % columns;

      const nextRow = Math.max(0, Math.min(rows - 1, row + rowDelta));
      const nextColumn = Math.max(
        0,
        Math.min(columns - 1, column + columnDelta),
      );
      const nextIndex = nextRow * columns + nextColumn;

      if (nextIndex >= activePaneCountSafe) {
        return previous;
      }

      return nextIndex;
    });
  };

  const applyLayoutMode = (mode: LayoutMode): void => {
    setLayoutMode(mode);
    setViewMode("normal");
    setOptionsMenu("root");
    setOptionsIndex(0);
    setFocusedPaneIndex(0);
  };

  useInput((input, key) => {
    if ((key.ctrl && input === "c") || input === "q") {
      onQuitRequest();
      return;
    }

    if (viewMode === "full-log") {
      if (key.escape) {
        closeOptions();
      }

      return;
    }

    if (viewMode === "options") {
      if (key.escape) {
        if (optionsMenu !== "root") {
          setOptionsMenu("root");
          setOptionsIndex(0);
        } else {
          closeOptions();
        }
        return;
      }

      if (optionsMenu === "grid") {
        if (key.leftArrow || input === "h") {
          if (optionsIndex === 0) {
            setGridColumns((previous) => Math.max(MIN_GRID, previous - 1));
            return;
          }
          if (optionsIndex === 1) {
            setGridRows((previous) => Math.max(MIN_GRID, previous - 1));
            return;
          }
        }

        if (key.rightArrow || input === "l") {
          if (optionsIndex === 0) {
            setGridColumns((previous) => Math.min(MAX_GRID, previous + 1));
            return;
          }
          if (optionsIndex === 1) {
            setGridRows((previous) => Math.min(MAX_GRID, previous + 1));
            return;
          }
        }
      }

      if (key.upArrow || input === "k") {
        setOptionsIndex((previous) =>
          previous <= 0 ? options.length - 1 : previous - 1,
        );
        return;
      }

      if (key.downArrow || input === "j") {
        setOptionsIndex((previous) => (previous + 1) % options.length);
        return;
      }

      if (key.return) {
        if (optionsMenu === "root") {
          switch (optionsIndex) {
            case 0:
              setViewMode("full-log");
              return;
            case 1:
              setOptionsMenu("layout");
              setOptionsIndex(0);
              return;
            case 2:
              setOptionsMenu(layoutMode === "grid" ? "grid" : "count");
              setOptionsIndex(0);
              return;
            default:
              closeOptions();
              return;
          }
        }

        if (optionsMenu === "layout") {
          switch (optionsIndex) {
            case 0:
              applyLayoutMode("single");
              return;
            case 1:
              applyLayoutMode("vertical");
              return;
            case 2:
              applyLayoutMode("horizontal");
              return;
            case 3:
              applyLayoutMode("grid");
              return;
            default:
              setOptionsMenu("root");
              setOptionsIndex(0);
              return;
          }
        }

        if (optionsMenu === "count") {
          if (optionsIndex === countOptions.length - 1) {
            setOptionsMenu("root");
            setOptionsIndex(0);
            return;
          }

          const nextCount = Math.min(
            MAX_PANES,
            Math.max(MIN_PANES, optionsIndex + MIN_PANES),
          );
          setPaneCount(nextCount);
          closeOptions();
          return;
        }

        if (optionsMenu === "grid") {
          if (optionsIndex === 2) {
            applyLayoutMode("grid");
            return;
          }

          if (optionsIndex === 3) {
            setOptionsMenu("root");
            setOptionsIndex(0);
            return;
          }
        }
      }

      return;
    }

    if (input === "o") {
      setViewMode("options");
      setOptionsMenu("root");
      setOptionsIndex(0);
      return;
    }

    if (key.tab && activePaneCountSafe > 1) {
      setFocusedPaneIndex((previous) => (previous + 1) % activePaneCountSafe);
      return;
    }

    if (activePaneCountSafe > 1) {
      if (key.leftArrow || input === "h") {
        moveFocusBy(0, -1);
        return;
      }

      if (key.rightArrow || input === "l") {
        moveFocusBy(0, 1);
        return;
      }

      if (key.upArrow || input === "k") {
        moveFocusBy(-1, 0);
        return;
      }

      if (key.downArrow || input === "j") {
        moveFocusBy(1, 0);
        return;
      }
    }

    if (
      activePaneCountSafe === 1 &&
      (key.upArrow || input === "k") &&
      serviceNames.length > 0
    ) {
      moveFocusedServiceSelection(-1);
      return;
    }

    if (
      activePaneCountSafe === 1 &&
      (key.downArrow || input === "j") &&
      serviceNames.length > 0
    ) {
      moveFocusedServiceSelection(1);
      return;
    }

    if (input === "r" && selectedServiceName && !isRestarting) {
      setIsRestarting(true);
      void manager
        .restartService(selectedServiceName)
        .catch(() => {
          // Restart failures are logged by the process manager.
        })
        .finally(() => {
          setIsRestarting(false);
        });
    }
  });

  useEffect(() => {
    const onServiceState = (state: ServiceState): void => {
      if (viewMode === "full-log") {
        return;
      }

      setServiceStates((previous) => {
        const existingIndex = previous.findIndex(
          (item) => item.name === state.name,
        );
        if (existingIndex === -1) {
          return [...previous, state];
        }

        const next = [...previous];
        next[existingIndex] = state;
        return next;
      });
    };

    const onLog = (entry: LogEntry): void => {
      logBuffer.append(entry);
    };

    manager.on("serviceState", onServiceState);
    manager.on("log", onLog);

    const ticker = setInterval(() => {
      if (viewMode === "full-log") {
        return;
      }

      setAllEntries(logBuffer.toArray());
      setNow(Date.now());
      setDimensions(getDimensions(stdout));
    }, 120);

    return () => {
      manager.off("serviceState", onServiceState);
      manager.off("log", onLog);
      clearInterval(ticker);
    };
  }, [logBuffer, manager, stdout, viewMode]);

  useEffect(() => {
    if (serviceNames.length === 0) {
      setSingleSelectedIndex(0);
      setFocusedPaneIndex(0);
      return;
    }

    setSingleSelectedIndex((previous) =>
      Math.min(Math.max(0, previous), serviceNames.length - 1),
    );
  }, [serviceNames]);

  useEffect(() => {
    setFocusedPaneIndex((previous) =>
      Math.min(previous, activePaneCountSafe - 1),
    );
  }, [activePaneCountSafe]);

  const controlsText =
    viewMode === "options"
      ? optionsMenu === "grid"
        ? "Options: up/down select, left/right adjust grid rows/cols, Enter apply/select, Esc back."
        : "Options: up/down choose, Enter select, Esc back/close."
      : viewMode === "full-log"
        ? "Full log: Esc return to dashboard."
        : activePaneCountSafe > 1
          ? "Controls: arrow keys or h/j/k/l focus panes, Tab next pane, r restart focused service, o options, q or Ctrl+C quit."
          : "Controls: up/down or j/k select service, r restart selected, o options, q or Ctrl+C quit.";

  const optionsTitle =
    optionsMenu === "root"
      ? "Options"
      : optionsMenu === "layout"
        ? "Options > Layout"
        : optionsMenu === "count"
          ? "Options > Pane Count"
          : "Options > Grid";

  const rowChunks = useMemo(() => {
    const rows: number[][] = [];
    const columns = Math.max(1, geometry.columns);

    for (let row = 0; row < geometry.rows; row += 1) {
      const rowIndices: number[] = [];
      for (let column = 0; column < columns; column += 1) {
        const paneIndex = row * columns + column;
        if (paneIndex < activePaneCountSafe) {
          rowIndices.push(paneIndex);
        }
      }

      if (rowIndices.length > 0) {
        rows.push(rowIndices);
      }
    }

    return rows;
  }, [activePaneCountSafe, geometry.columns, geometry.rows]);

  const logsSurface =
    viewMode === "options" ? (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="green"
        paddingX={1}
        flexGrow={1}
      >
        <Text color="greenBright">{optionsTitle}</Text>
        {options.map((label, index) => {
          const selected = index === optionsIndex;
          return (
            <Text key={label} color={selected ? "greenBright" : undefined}>
              {`${selected ? ">" : " "} ${label}`}
            </Text>
          );
        })}
      </Box>
    ) : viewMode === "full-log" ? (
      <LogView
        entries={fullLogEntries}
        width={dimensions.columns}
        emptyMessage="No logs available for the focused service yet."
        unboundedHeight
        framed={false}
      />
    ) : activePaneCountSafe === 1 ? (
      <LogView
        entries={paneEntries[0] ?? []}
        maxVisibleRows={baseVisibleRows}
        width={dimensions.columns}
        borderColor="green"
      />
    ) : layoutMode === "grid" ? (
      <Box flexDirection="column" flexGrow={1}>
        {rowChunks.map((row, rowIndex) => (
          <Box key={`row-${rowIndex}`} flexDirection="row" flexGrow={1}>
            {row.map((paneIndex) => {
              const focused = paneIndex === focusedPaneIndex;
              return (
                <Box key={paneIndex} flexGrow={1}>
                  <LogView
                    entries={paneEntries[paneIndex] ?? []}
                    maxVisibleRows={paneRows}
                    width={paneWidth}
                    borderColor={focused ? "green" : "gray"}
                    emptyMessage="No logs for this pane yet."
                  />
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    ) : (
      <Box
        flexDirection={layoutMode === "vertical" ? "row" : "column"}
        flexGrow={1}
      >
        {paneList.map((paneIndex) => {
          const focused = paneIndex === focusedPaneIndex;
          return (
            <Box key={paneIndex} flexGrow={1}>
              <LogView
                entries={paneEntries[paneIndex] ?? []}
                maxVisibleRows={paneRows}
                width={
                  layoutMode === "vertical" ? paneWidth : dimensions.columns
                }
                borderColor={focused ? "green" : "gray"}
                emptyMessage="No logs for this pane yet."
              />
            </Box>
          );
        })}
      </Box>
    );

  return (
    <Box flexDirection="column">
      {viewMode === "full-log" ? null : (
        <Header
          serviceStates={serviceStates}
          startedAt={startedAt}
          now={now}
          selectedServiceName={selectedServiceName}
          isSplitMode={activePaneCountSafe > 1}
        />
      )}
      {logsSurface}
      <Text dimColor>
        {isRestarting ? "Restarting selected service..." : controlsText}
      </Text>
    </Box>
  );
}
