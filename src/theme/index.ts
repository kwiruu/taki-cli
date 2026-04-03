import chalk from "chalk";
import type { ThemePresetId } from "../types/index.js";

export type InkColor =
  | "black"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "gray"
  | "redBright"
  | "greenBright"
  | "yellowBright"
  | "blueBright"
  | "magentaBright"
  | "cyanBright"
  | "whiteBright";

export type ChalkColorToken =
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "gray"
  | "redBright"
  | "greenBright"
  | "yellowBright"
  | "blueBright"
  | "magentaBright"
  | "cyanBright"
  | "whiteBright";

export interface RunThemeTokens {
  borderStyle: "round" | "single" | "double" | "classic";
  headerBorderColor: InkColor;
  headerTitleColor: InkColor;
  optionsBorderColor: InkColor;
  optionsTitleColor: InkColor;
  optionsSelectedColor: InkColor;
  paneFocusedBorderColor: InkColor;
  paneUnfocusedBorderColor: InkColor;
  footerColor: InkColor;
  catColor: InkColor;
  statusColors: {
    starting: InkColor;
    running: InkColor;
    exited: InkColor;
    failed: InkColor;
    stopped: InkColor;
  };
}

export interface InitThemeTokens {
  catColor: ChalkColorToken;
  accentColor: ChalkColorToken;
  accentStrongColor: ChalkColorToken;
  mutedColor: ChalkColorToken;
  contentColor: ChalkColorToken;
  successColor: ChalkColorToken;
  warningColor: ChalkColorToken;
}

interface ThemePreset {
  id: ThemePresetId;
  family: "Basic" | "VS Code" | "Terminal";
  label: string;
  run: RunThemeTokens;
  init: InitThemeTokens;
}

export const THEME_PRESET_IDS = [
  "default-white",
  "basic-blue",
  "basic-red",
  "basic-cyan",
  "basic-pink",
  "vscode-dark-plus",
  "vscode-light-plus",
  "vscode-monokai",
  "vscode-github-dark",
  "vscode-github-light",
  "terminal-gruvbox-dark",
  "terminal-solarized-dark",
  "terminal-solarized-light",
  "terminal-nord",
  "terminal-dracula",
  "terminal-one-dark",
] as const satisfies readonly ThemePresetId[];

export const DEFAULT_THEME_PRESET_ID: ThemePresetId = "default-white";

const THEME_PRESETS: readonly ThemePreset[] = [
  {
    id: "default-white",
    family: "Basic",
    label: "Default (White)",
    run: {
      borderStyle: "round",
      headerBorderColor: "white",
      headerTitleColor: "white",
      optionsBorderColor: "white",
      optionsTitleColor: "white",
      optionsSelectedColor: "whiteBright",
      paneFocusedBorderColor: "white",
      paneUnfocusedBorderColor: "gray",
      footerColor: "white",
      catColor: "white",
      statusColors: {
        starting: "white",
        running: "white",
        exited: "white",
        failed: "white",
        stopped: "white",
      },
    },
    init: {
      catColor: "white",
      accentColor: "white",
      accentStrongColor: "whiteBright",
      mutedColor: "gray",
      contentColor: "white",
      successColor: "white",
      warningColor: "white",
    },
  },
  {
    id: "basic-blue",
    family: "Basic",
    label: "Blue",
    run: {
      borderStyle: "round",
      headerBorderColor: "blueBright",
      headerTitleColor: "blueBright",
      optionsBorderColor: "blueBright",
      optionsTitleColor: "blueBright",
      optionsSelectedColor: "blue",
      paneFocusedBorderColor: "blueBright",
      paneUnfocusedBorderColor: "gray",
      footerColor: "blue",
      catColor: "blueBright",
      statusColors: {
        starting: "yellow",
        running: "blueBright",
        exited: "gray",
        failed: "red",
        stopped: "gray",
      },
    },
    init: {
      catColor: "blueBright",
      accentColor: "blueBright",
      accentStrongColor: "blue",
      mutedColor: "gray",
      contentColor: "blue",
      successColor: "blueBright",
      warningColor: "yellow",
    },
  },
  {
    id: "basic-red",
    family: "Basic",
    label: "Red",
    run: {
      borderStyle: "round",
      headerBorderColor: "redBright",
      headerTitleColor: "redBright",
      optionsBorderColor: "redBright",
      optionsTitleColor: "redBright",
      optionsSelectedColor: "red",
      paneFocusedBorderColor: "redBright",
      paneUnfocusedBorderColor: "gray",
      footerColor: "red",
      catColor: "redBright",
      statusColors: {
        starting: "yellow",
        running: "redBright",
        exited: "gray",
        failed: "red",
        stopped: "gray",
      },
    },
    init: {
      catColor: "redBright",
      accentColor: "redBright",
      accentStrongColor: "red",
      mutedColor: "gray",
      contentColor: "red",
      successColor: "redBright",
      warningColor: "yellow",
    },
  },
  {
    id: "basic-cyan",
    family: "Basic",
    label: "Cyan",
    run: {
      borderStyle: "round",
      headerBorderColor: "cyanBright",
      headerTitleColor: "cyanBright",
      optionsBorderColor: "cyanBright",
      optionsTitleColor: "cyanBright",
      optionsSelectedColor: "cyan",
      paneFocusedBorderColor: "cyanBright",
      paneUnfocusedBorderColor: "gray",
      footerColor: "cyan",
      catColor: "cyanBright",
      statusColors: {
        starting: "yellow",
        running: "cyanBright",
        exited: "gray",
        failed: "red",
        stopped: "gray",
      },
    },
    init: {
      catColor: "cyanBright",
      accentColor: "cyanBright",
      accentStrongColor: "cyan",
      mutedColor: "gray",
      contentColor: "cyan",
      successColor: "cyanBright",
      warningColor: "yellow",
    },
  },
  {
    id: "basic-pink",
    family: "Basic",
    label: "Pink",
    run: {
      borderStyle: "round",
      headerBorderColor: "magentaBright",
      headerTitleColor: "magentaBright",
      optionsBorderColor: "magentaBright",
      optionsTitleColor: "magentaBright",
      optionsSelectedColor: "magenta",
      paneFocusedBorderColor: "magentaBright",
      paneUnfocusedBorderColor: "gray",
      footerColor: "magenta",
      catColor: "magentaBright",
      statusColors: {
        starting: "yellow",
        running: "magentaBright",
        exited: "gray",
        failed: "red",
        stopped: "gray",
      },
    },
    init: {
      catColor: "magentaBright",
      accentColor: "magentaBright",
      accentStrongColor: "magenta",
      mutedColor: "gray",
      contentColor: "magenta",
      successColor: "magentaBright",
      warningColor: "yellow",
    },
  },
  {
    id: "vscode-dark-plus",
    family: "VS Code",
    label: "Dark+",
    run: {
      borderStyle: "round",
      headerBorderColor: "blueBright",
      headerTitleColor: "blueBright",
      optionsBorderColor: "blueBright",
      optionsTitleColor: "blueBright",
      optionsSelectedColor: "cyanBright",
      paneFocusedBorderColor: "blueBright",
      paneUnfocusedBorderColor: "gray",
      footerColor: "gray",
      catColor: "green",
      statusColors: {
        starting: "yellow",
        running: "green",
        exited: "gray",
        failed: "red",
        stopped: "gray",
      },
    },
    init: {
      catColor: "green",
      accentColor: "blueBright",
      accentStrongColor: "cyanBright",
      mutedColor: "gray",
      contentColor: "green",
      successColor: "green",
      warningColor: "yellow",
    },
  },
  {
    id: "vscode-light-plus",
    family: "VS Code",
    label: "Light+",
    run: {
      borderStyle: "round",
      headerBorderColor: "blue",
      headerTitleColor: "blue",
      optionsBorderColor: "blue",
      optionsTitleColor: "blue",
      optionsSelectedColor: "magenta",
      paneFocusedBorderColor: "blue",
      paneUnfocusedBorderColor: "gray",
      footerColor: "gray",
      catColor: "blue",
      statusColors: {
        starting: "yellow",
        running: "green",
        exited: "gray",
        failed: "red",
        stopped: "gray",
      },
    },
    init: {
      catColor: "blue",
      accentColor: "blue",
      accentStrongColor: "magenta",
      mutedColor: "gray",
      contentColor: "blue",
      successColor: "green",
      warningColor: "yellow",
    },
  },
  {
    id: "vscode-monokai",
    family: "VS Code",
    label: "Monokai",
    run: {
      borderStyle: "round",
      headerBorderColor: "yellowBright",
      headerTitleColor: "yellowBright",
      optionsBorderColor: "yellowBright",
      optionsTitleColor: "yellowBright",
      optionsSelectedColor: "magentaBright",
      paneFocusedBorderColor: "yellowBright",
      paneUnfocusedBorderColor: "gray",
      footerColor: "gray",
      catColor: "magenta",
      statusColors: {
        starting: "yellow",
        running: "green",
        exited: "gray",
        failed: "red",
        stopped: "gray",
      },
    },
    init: {
      catColor: "magenta",
      accentColor: "yellowBright",
      accentStrongColor: "magentaBright",
      mutedColor: "gray",
      contentColor: "yellow",
      successColor: "green",
      warningColor: "yellow",
    },
  },
  {
    id: "vscode-github-dark",
    family: "VS Code",
    label: "GitHub Dark",
    run: {
      borderStyle: "round",
      headerBorderColor: "cyan",
      headerTitleColor: "cyan",
      optionsBorderColor: "cyan",
      optionsTitleColor: "cyan",
      optionsSelectedColor: "greenBright",
      paneFocusedBorderColor: "cyan",
      paneUnfocusedBorderColor: "gray",
      footerColor: "gray",
      catColor: "green",
      statusColors: {
        starting: "yellow",
        running: "green",
        exited: "gray",
        failed: "red",
        stopped: "gray",
      },
    },
    init: {
      catColor: "green",
      accentColor: "cyan",
      accentStrongColor: "greenBright",
      mutedColor: "gray",
      contentColor: "green",
      successColor: "green",
      warningColor: "yellow",
    },
  },
  {
    id: "vscode-github-light",
    family: "VS Code",
    label: "GitHub Light",
    run: {
      borderStyle: "round",
      headerBorderColor: "cyan",
      headerTitleColor: "cyan",
      optionsBorderColor: "cyan",
      optionsTitleColor: "cyan",
      optionsSelectedColor: "blue",
      paneFocusedBorderColor: "cyan",
      paneUnfocusedBorderColor: "gray",
      footerColor: "gray",
      catColor: "cyan",
      statusColors: {
        starting: "yellow",
        running: "green",
        exited: "gray",
        failed: "red",
        stopped: "gray",
      },
    },
    init: {
      catColor: "cyan",
      accentColor: "cyan",
      accentStrongColor: "blue",
      mutedColor: "gray",
      contentColor: "cyan",
      successColor: "green",
      warningColor: "yellow",
    },
  },
  {
    id: "terminal-gruvbox-dark",
    family: "Terminal",
    label: "Gruvbox Dark",
    run: {
      borderStyle: "round",
      headerBorderColor: "yellow",
      headerTitleColor: "yellow",
      optionsBorderColor: "yellow",
      optionsTitleColor: "yellow",
      optionsSelectedColor: "green",
      paneFocusedBorderColor: "yellow",
      paneUnfocusedBorderColor: "gray",
      footerColor: "gray",
      catColor: "yellow",
      statusColors: {
        starting: "yellow",
        running: "green",
        exited: "gray",
        failed: "red",
        stopped: "gray",
      },
    },
    init: {
      catColor: "yellow",
      accentColor: "yellow",
      accentStrongColor: "green",
      mutedColor: "gray",
      contentColor: "yellow",
      successColor: "green",
      warningColor: "yellow",
    },
  },
  {
    id: "terminal-solarized-dark",
    family: "Terminal",
    label: "Solarized Dark",
    run: {
      borderStyle: "round",
      headerBorderColor: "cyan",
      headerTitleColor: "cyan",
      optionsBorderColor: "cyan",
      optionsTitleColor: "cyan",
      optionsSelectedColor: "yellow",
      paneFocusedBorderColor: "cyan",
      paneUnfocusedBorderColor: "gray",
      footerColor: "gray",
      catColor: "cyan",
      statusColors: {
        starting: "yellow",
        running: "green",
        exited: "gray",
        failed: "red",
        stopped: "gray",
      },
    },
    init: {
      catColor: "cyan",
      accentColor: "cyan",
      accentStrongColor: "yellow",
      mutedColor: "gray",
      contentColor: "cyan",
      successColor: "green",
      warningColor: "yellow",
    },
  },
  {
    id: "terminal-solarized-light",
    family: "Terminal",
    label: "Solarized Light",
    run: {
      borderStyle: "round",
      headerBorderColor: "blue",
      headerTitleColor: "blue",
      optionsBorderColor: "blue",
      optionsTitleColor: "blue",
      optionsSelectedColor: "cyan",
      paneFocusedBorderColor: "blue",
      paneUnfocusedBorderColor: "gray",
      footerColor: "gray",
      catColor: "blue",
      statusColors: {
        starting: "yellow",
        running: "green",
        exited: "gray",
        failed: "red",
        stopped: "gray",
      },
    },
    init: {
      catColor: "blue",
      accentColor: "blue",
      accentStrongColor: "cyan",
      mutedColor: "gray",
      contentColor: "blue",
      successColor: "green",
      warningColor: "yellow",
    },
  },
  {
    id: "terminal-nord",
    family: "Terminal",
    label: "Nord",
    run: {
      borderStyle: "round",
      headerBorderColor: "cyanBright",
      headerTitleColor: "cyanBright",
      optionsBorderColor: "cyanBright",
      optionsTitleColor: "cyanBright",
      optionsSelectedColor: "whiteBright",
      paneFocusedBorderColor: "cyanBright",
      paneUnfocusedBorderColor: "gray",
      footerColor: "gray",
      catColor: "cyanBright",
      statusColors: {
        starting: "yellow",
        running: "green",
        exited: "gray",
        failed: "red",
        stopped: "gray",
      },
    },
    init: {
      catColor: "cyanBright",
      accentColor: "cyanBright",
      accentStrongColor: "whiteBright",
      mutedColor: "gray",
      contentColor: "cyan",
      successColor: "green",
      warningColor: "yellow",
    },
  },
  {
    id: "terminal-dracula",
    family: "Terminal",
    label: "Dracula",
    run: {
      borderStyle: "round",
      headerBorderColor: "magentaBright",
      headerTitleColor: "magentaBright",
      optionsBorderColor: "magentaBright",
      optionsTitleColor: "magentaBright",
      optionsSelectedColor: "cyanBright",
      paneFocusedBorderColor: "magentaBright",
      paneUnfocusedBorderColor: "gray",
      footerColor: "gray",
      catColor: "magentaBright",
      statusColors: {
        starting: "yellow",
        running: "green",
        exited: "gray",
        failed: "red",
        stopped: "gray",
      },
    },
    init: {
      catColor: "magentaBright",
      accentColor: "magentaBright",
      accentStrongColor: "cyanBright",
      mutedColor: "gray",
      contentColor: "magenta",
      successColor: "green",
      warningColor: "yellow",
    },
  },
  {
    id: "terminal-one-dark",
    family: "Terminal",
    label: "One Dark",
    run: {
      borderStyle: "round",
      headerBorderColor: "blueBright",
      headerTitleColor: "blueBright",
      optionsBorderColor: "blueBright",
      optionsTitleColor: "blueBright",
      optionsSelectedColor: "yellowBright",
      paneFocusedBorderColor: "blueBright",
      paneUnfocusedBorderColor: "gray",
      footerColor: "gray",
      catColor: "blueBright",
      statusColors: {
        starting: "yellow",
        running: "green",
        exited: "gray",
        failed: "red",
        stopped: "gray",
      },
    },
    init: {
      catColor: "blueBright",
      accentColor: "blueBright",
      accentStrongColor: "yellowBright",
      mutedColor: "gray",
      contentColor: "blue",
      successColor: "green",
      warningColor: "yellow",
    },
  },
];

const CHALK_PALETTE: Record<ChalkColorToken, (value: string) => string> = {
  red: chalk.red,
  green: chalk.green,
  yellow: chalk.yellow,
  blue: chalk.blue,
  magenta: chalk.magenta,
  cyan: chalk.cyan,
  white: chalk.white,
  gray: chalk.gray,
  redBright: chalk.redBright,
  greenBright: chalk.greenBright,
  yellowBright: chalk.yellowBright,
  blueBright: chalk.blueBright,
  magentaBright: chalk.magentaBright,
  cyanBright: chalk.cyanBright,
  whiteBright: chalk.whiteBright,
};

export function applyChalkColor(color: ChalkColorToken, value: string): string {
  return CHALK_PALETTE[color](value);
}

export function isThemePresetId(value: string): value is ThemePresetId {
  return (THEME_PRESET_IDS as readonly string[]).includes(value);
}

export function getThemePreset(id: ThemePresetId | undefined): ThemePreset {
  if (!id) {
    return THEME_PRESETS[0];
  }

  return THEME_PRESETS.find((preset) => preset.id === id) ?? THEME_PRESETS[0];
}

export function getThemePresetChoices(): ReadonlyArray<{
  id: ThemePresetId;
  family: "Basic" | "VS Code" | "Terminal";
  label: string;
}> {
  return THEME_PRESETS.map((preset) => ({
    id: preset.id,
    family: preset.family,
    label: preset.label,
  }));
}
