import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { Header } from "./components/header.js";
import { LogView } from "./components/log-view.js";
import { RingBuffer } from "../io/ring-buffer.js";
import {
  DEFAULT_THEME_PRESET_ID,
  getThemePreset,
  getThemePresetChoices,
} from "../theme/index.js";
import type { LogEntry, ServiceState, ThemePresetId } from "../types/index.js";
import type { ProcessManager } from "../core/process-manager.js";

interface AppProps {
  manager: ProcessManager;
  logBuffer: RingBuffer<LogEntry>;
  startedAt: number;
  maxDisplayLines: number;
  initialThemeId?: ThemePresetId;
  onThemeChange?: (theme: ThemePresetId) => Promise<void>;
  onQuitRequest: () => void;
}

interface Dimensions {
  columns: number;
  rows: number;
}

type ViewMode = "normal" | "options" | "full-log" | "shortcuts";
type OptionsMenu = "root" | "layout" | "count" | "grid" | "theme";
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

const SHORTCUTS_HELP_LINES = [
  "Global:",
  "  q / Ctrl+C  Quit",
  "  o           Open options",
  "  ?           Toggle shortcut help",
  "  r           Restart focused service",
  "",
  "Layout quick switch:",
  "  1 Single pane",
  "  2 Vertical panes",
  "  3 Horizontal panes",
  "  4 Grid panes",
  "",
  "Navigation:",
  "  Up/Down or j/k     Select service (single pane)",
  "  Arrows or h/j/k/l  Move focus (multi-pane)",
  "  Tab                Next pane",
  "",
  "Views:",
  "  Esc  Close options/full-log/shortcuts view",
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
  initialThemeId,
  onThemeChange,
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
  const [themeId, setThemeId] = useState<ThemePresetId>(
    initialThemeId ?? DEFAULT_THEME_PRESET_ID,
  );
  const [previewThemeId, setPreviewThemeId] = useState<ThemePresetId>();
  const [isRestarting, setIsRestarting] = useState(false);
  const [dimensions, setDimensions] = useState<Dimensions>(
    getDimensions(stdout),
  );
  const activeTheme = useMemo(
    () => getThemePreset(previewThemeId ?? themeId),
    [previewThemeId, themeId],
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
    const themeLabel = `Choose theme (${activeTheme.label})`;

    return [
      ROOT_OPTIONS_BASE[0],
      ROOT_OPTIONS_BASE[1],
      amountLabel,
      themeLabel,
      ROOT_OPTIONS_BASE[3],
    ];
  }, [activeTheme.label, gridColumns, gridRows, layoutMode, paneCount]);

  const themeOptions = useMemo(() => {
    const nextOptions: Array<{ label: string; value: ThemePresetId | "back" }> =
      getThemePresetChoices().map((preset) => {
        const activeSuffix =
          preset.id === themeId && preset.id === previewThemeId
            ? " (active)"
            : preset.id === previewThemeId
              ? " (preview)"
              : preset.id === themeId
                ? " (active)"
                : "";
        return {
          label: `${preset.family}: ${preset.label}${activeSuffix}`,
          value: preset.id,
        };
      });

    nextOptions.push({
      label: "Back",
      value: "back" as const,
    });

    return nextOptions;
  }, [previewThemeId, themeId]);

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
      case "theme":
        return themeOptions.map((option) => option.label);
      case "root":
      default:
        return rootOptions;
    }
  }, [
    countOptions,
    gridColumns,
    gridRows,
    optionsMenu,
    rootOptions,
    themeOptions,
  ]);

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
    setPreviewThemeId(undefined);
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

    if (viewMode === "shortcuts") {
      if (key.escape || input === "?") {
        setViewMode("normal");
      }

      return;
    }

    if (viewMode === "options") {
      if (key.escape) {
        if (optionsMenu !== "root") {
          if (optionsMenu === "theme") {
            setPreviewThemeId(undefined);
          }
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
            case 3:
              setOptionsMenu("theme");
              setOptionsIndex(
                Math.max(
                  0,
                  themeOptions.findIndex((option) => option.value === themeId),
                ),
              );
              setPreviewThemeId(themeId);
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

        if (optionsMenu === "theme") {
          const selected = themeOptions[optionsIndex];
          if (!selected || selected.value === "back") {
            setPreviewThemeId(undefined);
            setOptionsMenu("root");
            setOptionsIndex(0);
            return;
          }

          setThemeId(selected.value);
          setPreviewThemeId(undefined);
          if (onThemeChange) {
            void onThemeChange(selected.value).catch(() => {
              // Ignore persistence failures and keep live theme in session.
            });
          }
          closeOptions();
          return;
        }
      }

      return;
    }

    if (input === "?") {
      setViewMode("shortcuts");
      return;
    }

    if (input === "1") {
      applyLayoutMode("single");
      return;
    }

    if (input === "2") {
      applyLayoutMode("vertical");
      return;
    }

    if (input === "3") {
      applyLayoutMode("horizontal");
      return;
    }

    if (input === "4") {
      applyLayoutMode("grid");
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

  useEffect(() => {
    if (viewMode !== "options" || optionsMenu !== "theme") {
      setPreviewThemeId(undefined);
      return;
    }

    const selected = themeOptions[optionsIndex];
    if (!selected || selected.value === "back") {
      setPreviewThemeId(themeId);
      return;
    }

    setPreviewThemeId(selected.value);
  }, [optionsIndex, optionsMenu, themeId, themeOptions, viewMode]);

  const controlsText =
    viewMode === "options"
      ? optionsMenu === "grid"
        ? "Options: up/down select, left/right adjust grid rows/cols, Enter apply/select, Esc back."
        : "Options: up/down choose, Enter select, Esc back/close."
      : viewMode === "full-log"
        ? "Full log: Esc return to dashboard."
        : viewMode === "shortcuts"
          ? "Shortcuts: Esc or ? to return to dashboard."
          : activePaneCountSafe > 1
            ? "Controls: arrow keys or h/j/k/l focus panes, Tab next pane, 1/2/3/4 switch layouts, r restart focused service, ? shortcuts, o options, q or Ctrl+C quit."
            : "Controls: up/down or j/k select service, 1/2/3/4 switch layouts, r restart selected, ? shortcuts, o options, q or Ctrl+C quit.";

  const optionsTitle =
    optionsMenu === "root"
      ? "Options"
      : optionsMenu === "layout"
        ? "Options > Layout"
        : optionsMenu === "count"
          ? "Options > Pane Count"
          : optionsMenu === "theme"
            ? "Options > Theme"
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
    viewMode === "shortcuts" ? (
      <Box
        flexDirection="column"
        borderStyle={activeTheme.run.borderStyle}
        borderColor={activeTheme.run.optionsBorderColor}
        paddingX={1}
        flexGrow={1}
      >
        <Text color={activeTheme.run.optionsTitleColor}>Shortcuts</Text>
        {SHORTCUTS_HELP_LINES.map((line, index) => (
          <Text key={`shortcut-${index}`} color={activeTheme.run.footerColor}>
            {line}
          </Text>
        ))}
      </Box>
    ) : viewMode === "options" ? (
      <Box
        flexDirection="column"
        borderStyle={activeTheme.run.borderStyle}
        borderColor={activeTheme.run.optionsBorderColor}
        paddingX={1}
        flexGrow={1}
      >
        <Text color={activeTheme.run.optionsTitleColor}>{optionsTitle}</Text>
        {options.map((label, index) => {
          const selected = index === optionsIndex;
          return (
            <Text
              key={label}
              color={
                selected ? activeTheme.run.optionsSelectedColor : undefined
              }
            >
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
        borderColor={activeTheme.run.paneFocusedBorderColor}
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
                    borderColor={
                      focused
                        ? activeTheme.run.paneFocusedBorderColor
                        : activeTheme.run.paneUnfocusedBorderColor
                    }
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
                borderColor={
                  focused
                    ? activeTheme.run.paneFocusedBorderColor
                    : activeTheme.run.paneUnfocusedBorderColor
                }
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
          theme={activeTheme.run}
        />
      )}
      {logsSurface}
      <Text color={activeTheme.run.footerColor}>
        {isRestarting ? "Restarting selected service..." : controlsText}
      </Text>
    </Box>
  );
}
