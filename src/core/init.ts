import { promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import chalk from "chalk";
import type {
  HealthCheckConfig,
  ServiceColor,
  ServiceConfig,
  TakiConfig,
  ThemePresetId,
} from "../types/index.js";
import type { ChalkColorToken } from "../theme/index.js";
import {
  applyChalkColor,
  DEFAULT_THEME_PRESET_ID,
  getThemePreset,
} from "../theme/index.js";
import { loadConfig, readConfigThemePreference } from "./config.js";
import { askInkInputPrompt, askInkSelectPrompt } from "../ui/init-prompts.js";

const DEFAULT_COLORS: ServiceColor[] = [
  "cyan",
  "green",
  "yellow",
  "magenta",
  "blue",
  "white",
  "gray",
  "red",
];

const FALLBACK_INIT_CAT = [
  "  ／l、             ",
  "（ﾟ､ ｡ ７         ",
  "  l  ~ヽ       ",
  "  じしf_,)ノ",
];

const INIT_CAT = loadInitCatLines();
const TAKI_VERSION = "v0.1.0";
let ACTIVE_THEME_ID: ThemePresetId = DEFAULT_THEME_PRESET_ID;
let ACTIVE_INIT_THEME = getThemePreset(DEFAULT_THEME_PRESET_ID).init;

const BACK = Symbol("BACK");

type BackToken = typeof BACK;
type PromptResult<T> = T | BackToken;

interface InitOptions {
  configPath: string;
  force: boolean;
  cwd?: string;
}

interface SelectOption<T> {
  label: string;
  value: T;
  color?: ServiceColor;
}

interface InitDraft {
  serviceCount: number;
  services: ServiceConfig[];
  maxLogLines: number;
  setupScript: boolean;
}

interface TerminalMetrics {
  columns: number;
  rows: number;
}

type PreviewMode = "full" | "compact";

interface PromptUiOptions {
  contextLines?: string[];
  suppressEcho?: boolean;
}

function paintInit(color: ChalkColorToken, value: string): string {
  return applyChalkColor(color, value);
}

export async function runInteractiveInit(options: InitOptions): Promise<void> {
  const rootDir = options.cwd ?? process.cwd();
  const configPath = path.resolve(rootDir, options.configPath);
  const displayPath = path.relative(rootDir, configPath) || "taki.json";
  const configuredTheme = await readConfigThemePreference(configPath);
  ACTIVE_THEME_ID = configuredTheme ?? DEFAULT_THEME_PRESET_ID;
  ACTIVE_INIT_THEME = getThemePreset(ACTIVE_THEME_ID).init;
  const useInkTty = stdin.isTTY && stdout.isTTY;
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const shouldWrite = await canWriteConfig(configPath, options.force, rl);
    if (!shouldWrite) {
      console.log(
        paintInit(
          ACTIVE_INIT_THEME.warningColor,
          "Init canceled. No files were changed.",
        ),
      );
      return;
    }

    if (!useInkTty) {
      await printBanner(displayPath);
    }

    const totalSteps = 6;
    const draft: InitDraft = {
      serviceCount: 2,
      services: [],
      maxLogLines: 200,
      setupScript: true,
    };

    let currentStep = 1;
    while (currentStep <= totalSteps) {
      if (currentStep === 1) {
        if (!useInkTty) {
          printStepHeader(currentStep, totalSteps, "Workspace Shape");
          renderPreview(draft, currentStep, totalSteps);
        }

        const uiOptions: PromptUiOptions = useInkTty
          ? {
              suppressEcho: true,
              contextLines: buildInkContextLines(
                displayPath,
                draft,
                currentStep,
                totalSteps,
                "Workspace Shape",
              ),
            }
          : {};

        const serviceCount = await askPositiveInt(
          rl,
          "How many services do you want to run?",
          draft.serviceCount,
          1,
          uiOptions,
        );

        if (serviceCount === BACK) {
          continue;
        }

        draft.serviceCount = serviceCount;
        if (draft.services.length > serviceCount) {
          draft.services = draft.services.slice(0, serviceCount);
        }

        currentStep = 2;
        continue;
      }

      if (currentStep === 2) {
        if (!useInkTty) {
          printStepHeader(currentStep, totalSteps, "Configure Services");
          renderPreview(draft, currentStep, totalSteps);
        }

        const nextServices = await configureServicesStep(
          rl,
          draft.serviceCount,
          draft.services,
          useInkTty
            ? (serviceIndex, servicesSnapshot) =>
                buildInkContextLines(
                  displayPath,
                  {
                    ...draft,
                    services: servicesSnapshot,
                  },
                  currentStep,
                  totalSteps,
                  "Configure Services",
                )
            : undefined,
          useInkTty,
        );

        if (nextServices === BACK) {
          currentStep = 1;
          continue;
        }

        draft.services = nextServices;
        currentStep = 3;
        continue;
      }

      if (currentStep === 3) {
        if (!useInkTty) {
          printStepHeader(currentStep, totalSteps, "Logs and Buffering");
          renderPreview(draft, currentStep, totalSteps);
        }

        const uiOptions: PromptUiOptions = useInkTty
          ? {
              suppressEcho: true,
              contextLines: buildInkContextLines(
                displayPath,
                draft,
                currentStep,
                totalSteps,
                "Logs and Buffering",
              ),
            }
          : {};

        const maxLogLines = await askPositiveInt(
          rl,
          "Max log lines to keep in memory",
          draft.maxLogLines,
          50,
          uiOptions,
        );

        if (maxLogLines === BACK) {
          currentStep = 2;
          continue;
        }

        draft.maxLogLines = maxLogLines;
        currentStep = 4;
        continue;
      }

      if (currentStep === 4) {
        if (!useInkTty) {
          printStepHeader(currentStep, totalSteps, "Script Setup");
          renderPreview(draft, currentStep, totalSteps);
        }

        const uiOptions: PromptUiOptions = useInkTty
          ? {
              suppressEcho: true,
              contextLines: buildInkContextLines(
                displayPath,
                draft,
                currentStep,
                totalSteps,
                "Script Setup",
              ),
            }
          : {};

        const setupScript = await askYesNo(
          rl,
          "Add or update npm script 'taki' in package.json?",
          draft.setupScript,
          uiOptions,
        );

        if (setupScript === BACK) {
          currentStep = 3;
          continue;
        }

        draft.setupScript = setupScript;
        currentStep = 5;
        continue;
      }

      if (currentStep === 5) {
        if (!useInkTty) {
          printStepHeader(currentStep, totalSteps, "Review");
          renderPreview(draft, currentStep, totalSteps);
        }

        const uiOptions: PromptUiOptions = useInkTty
          ? {
              suppressEcho: true,
              contextLines: buildInkContextLines(
                displayPath,
                draft,
                currentStep,
                totalSteps,
                "Review",
              ),
            }
          : {};

        const decision = await askSelect(
          rl,
          "Create config now?",
          [
            { label: "Create", value: "create", color: "green" },
            { label: "Back", value: "back", color: "yellow" },
          ],
          0,
          uiOptions,
        );

        if (decision === BACK || decision === "back") {
          currentStep = 4;
          continue;
        }

        currentStep = 6;
        continue;
      }

      if (currentStep === 6) {
        const config: TakiConfig = {
          services: draft.services,
          maxLogLines: draft.maxLogLines,
          ui: {
            theme: ACTIVE_THEME_ID,
          },
        };

        await fs.writeFile(
          configPath,
          `${JSON.stringify(config, null, 2)}\n`,
          "utf8",
        );
        await loadConfig(configPath);

        console.log(
          `\n${paintInit(ACTIVE_INIT_THEME.successColor, "Created")}: ${paintInit(ACTIVE_INIT_THEME.successColor, displayPath)}`,
        );

        if (draft.setupScript) {
          await maybeSetupPackageScript(rl, rootDir, options.configPath);
        }

        console.log(
          `\n${chalk.bold("Next step")}: ${paintInit(ACTIVE_INIT_THEME.successColor, formatRunCommand(options.configPath))}`,
        );
        return;
      }
    }
  } finally {
    rl.close();
  }
}

async function canWriteConfig(
  filePath: string,
  force: boolean,
  rl: ReturnType<typeof createInterface>,
): Promise<boolean> {
  if (force) {
    return true;
  }

  try {
    await fs.access(filePath);
  } catch {
    return true;
  }

  const overwrite = await askYesNo(
    rl,
    `Config file already exists at ${filePath}. Overwrite?`,
    false,
  );

  return overwrite === BACK ? false : overwrite;
}

async function askService(
  rl: ReturnType<typeof createInterface>,
  index: number,
  existingServices: ServiceConfig[],
  defaultName: string,
  defaultColor: ServiceColor,
  uiOptions: PromptUiOptions = {},
): Promise<PromptResult<ServiceConfig>> {
  if (!uiOptions.suppressEcho) {
    console.log(chalk.bold(`\nService ${index + 1}`));
  }

  const name = await askWithDefault(rl, "Name", defaultName, uiOptions);
  if (name === BACK) {
    return BACK;
  }

  const command = await askWithDefault(
    rl,
    "Command executable",
    "npm",
    uiOptions,
  );
  if (command === BACK) {
    return BACK;
  }

  const argsInput = await askWithDefault(
    rl,
    "Args (space-separated, optional)",
    index === 0 ? "run dev" : "",
    uiOptions,
  );
  if (argsInput === BACK) {
    return BACK;
  }

  const args = parseArgsInput(argsInput);

  const color = await askSelect(
    rl,
    "Color",
    DEFAULT_COLORS.map((colorOption) => ({
      label: colorOption,
      value: colorOption,
      color: colorOption,
    })),
    Math.max(0, DEFAULT_COLORS.indexOf(defaultColor)),
    uiOptions,
  );
  if (color === BACK) {
    return BACK;
  }

  const cwdInput = await askWithDefault(
    rl,
    "Working directory (optional)",
    "",
    uiOptions,
  );
  if (cwdInput === BACK) {
    return BACK;
  }

  const startAfter = await askDependencies(rl, existingServices, uiOptions);
  if (startAfter === BACK) {
    return BACK;
  }

  const healthCheck = await askHealthCheck(rl, uiOptions);
  if (healthCheck === BACK) {
    return BACK;
  }

  const service: ServiceConfig = {
    name,
    command,
    color,
  };

  if (args.length > 0) {
    service.args = args;
  }
  if (cwdInput.trim()) {
    service.cwd = cwdInput.trim();
  }
  if (startAfter.length > 0) {
    service.startAfter = startAfter;
  }
  if (healthCheck) {
    service.healthCheck = healthCheck;
  }

  return service;
}

async function askDependencies(
  rl: ReturnType<typeof createInterface>,
  existingServices: ServiceConfig[],
  uiOptions: PromptUiOptions = {},
): Promise<PromptResult<string[]>> {
  if (existingServices.length === 0) {
    return [];
  }

  const known = existingServices.map((service) => service.name);
  if (!uiOptions.suppressEcho) {
    console.log(`Available dependencies: ${known.join(", ")}`);
  }

  for (;;) {
    const answer = await askWithDefault(
      rl,
      "Start after (comma-separated names, optional)",
      "",
      uiOptions,
    );
    if (answer === BACK) {
      return BACK;
    }

    const parsed = parseCsvList(answer);
    const invalid = parsed.filter((name) => !known.includes(name));
    if (invalid.length > 0) {
      console.log(`Unknown dependencies: ${invalid.join(", ")}. Try again.`);
      continue;
    }

    return parsed;
  }
}

async function askHealthCheck(
  rl: ReturnType<typeof createInterface>,
  uiOptions: PromptUiOptions = {},
): Promise<PromptResult<HealthCheckConfig | undefined>> {
  for (;;) {
    const type = await askSelect(
      rl,
      "Health check type",
      [
        { label: "none", value: "none", color: "gray" },
        { label: "log", value: "log", color: "yellow" },
        { label: "http", value: "http", color: "cyan" },
      ],
      0,
      uiOptions,
    );
    if (type === BACK) {
      return BACK;
    }

    if (type === "none") {
      return undefined;
    }

    if (type === "log") {
      const pattern = await askWithDefault(
        rl,
        "Log pattern (regex)",
        "ready",
        uiOptions,
      );
      if (pattern === BACK) {
        return BACK;
      }

      const timeoutMs = await askOptionalPositiveInt(
        rl,
        "Health timeout ms (optional)",
        uiOptions,
      );
      if (timeoutMs === BACK) {
        return BACK;
      }

      return {
        type: "log",
        pattern,
        ...(timeoutMs ? { timeoutMs } : {}),
      };
    }

    if (type === "http") {
      const url = await askWithDefault(
        rl,
        "Health URL",
        "http://127.0.0.1:3000/health",
        uiOptions,
      );
      if (url === BACK) {
        return BACK;
      }

      const intervalMs = await askOptionalPositiveInt(
        rl,
        "Health poll interval ms (optional)",
        uiOptions,
      );
      if (intervalMs === BACK) {
        return BACK;
      }

      const timeoutMs = await askOptionalPositiveInt(
        rl,
        "Health timeout ms (optional)",
        uiOptions,
      );
      if (timeoutMs === BACK) {
        return BACK;
      }

      return {
        type: "http",
        url,
        ...(intervalMs ? { intervalMs } : {}),
        ...(timeoutMs ? { timeoutMs } : {}),
      };
    }

    console.log("Please choose one of: none, log, http.");
  }
}

async function maybeSetupPackageScript(
  rl: ReturnType<typeof createInterface>,
  rootDir: string,
  configPath: string,
): Promise<void> {
  const packageJsonPath = path.join(rootDir, "package.json");

  let raw: string;
  try {
    raw = await fs.readFile(packageJsonPath, "utf8");
  } catch {
    return;
  }

  const packageJson = JSON.parse(raw) as {
    scripts?: Record<string, string>;
    [key: string]: unknown;
  };

  const scripts = packageJson.scripts ?? {};
  const normalizedPath = normalizeConfigPathForScript(configPath);
  const nextCommand = `taki --config ${normalizedPath}`;

  if (scripts.taki && scripts.taki !== nextCommand) {
    const overwrite = await askYesNo(
      rl,
      `Existing script is '${scripts.taki}'. Overwrite?`,
      false,
    );
    if (overwrite === BACK) {
      return;
    }

    if (!overwrite) {
      return;
    }
  }

  scripts.taki = nextCommand;
  packageJson.scripts = scripts;

  await fs.writeFile(
    packageJsonPath,
    `${JSON.stringify(packageJson, null, 2)}\n`,
    "utf8",
  );
  console.log(
    paintInit(
      ACTIVE_INIT_THEME.successColor,
      "Updated package.json scripts.taki",
    ),
  );
}

async function askWithDefault(
  rl: ReturnType<typeof createInterface>,
  prompt: string,
  defaultValue: string,
  uiOptions: PromptUiOptions = {},
): Promise<PromptResult<string>> {
  return askInputBox(rl, prompt, defaultValue, uiOptions);
}

async function askPositiveInt(
  rl: ReturnType<typeof createInterface>,
  prompt: string,
  defaultValue: number,
  min: number,
  uiOptions: PromptUiOptions = {},
): Promise<PromptResult<number>> {
  for (;;) {
    const answer = await askWithDefault(
      rl,
      prompt,
      String(defaultValue),
      uiOptions,
    );
    if (answer === BACK) {
      return BACK;
    }

    const value = Number.parseInt(answer, 10);

    if (Number.isInteger(value) && value >= min) {
      return value;
    }

    console.log(`Please enter an integer >= ${min}.`);
  }
}

async function askOptionalPositiveInt(
  rl: ReturnType<typeof createInterface>,
  prompt: string,
  uiOptions: PromptUiOptions = {},
): Promise<PromptResult<number | undefined>> {
  for (;;) {
    const answer = await askWithDefault(rl, prompt, "", uiOptions);
    if (answer === BACK) {
      return BACK;
    }

    if (!answer.trim()) {
      return undefined;
    }

    const value = Number.parseInt(answer, 10);
    if (Number.isInteger(value) && value > 0) {
      return value;
    }

    console.log("Please enter a positive integer, or leave blank.");
  }
}

async function askYesNo(
  rl: ReturnType<typeof createInterface>,
  prompt: string,
  defaultValue: boolean,
  uiOptions: PromptUiOptions = {},
): Promise<PromptResult<boolean>> {
  if (stdin.isTTY && stdout.isTTY) {
    return askSelect(
      rl,
      prompt,
      [
        { label: "Yes", value: true, color: "green" },
        { label: "No", value: false, color: "red" },
      ],
      defaultValue ? 0 : 1,
      uiOptions,
    );
  }

  const suffix = defaultValue ? " (Y/n)" : " (y/N)";
  for (;;) {
    const answer = (await rl.question(`${prompt}${suffix}: `))
      .trim()
      .toLowerCase();
    if (!answer) {
      return defaultValue;
    }
    if (answer === "y" || answer === "yes") {
      return true;
    }
    if (answer === "n" || answer === "no") {
      return false;
    }

    console.log("Please answer yes or no.");
  }
}

function normalizeColor(input: string, fallback: ServiceColor): ServiceColor {
  const lowered = input.trim().toLowerCase();
  if (DEFAULT_COLORS.includes(lowered as ServiceColor)) {
    return lowered as ServiceColor;
  }

  return fallback;
}

export function parseArgsInput(input: string): string[] {
  const parts = input.match(/[^\s"']+|"([^"]*)"|'([^']*)'/g);
  if (!parts) {
    return [];
  }

  return parts
    .map((part) => part.replace(/^"|"$/g, "").replace(/^'|'$/g, "").trim())
    .filter((part) => part.length > 0);
}

export function parseCsvList(input: string): string[] {
  if (!input.trim()) {
    return [];
  }

  return Array.from(
    new Set(
      input
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ).values(),
  );
}

export function normalizeConfigPathForScript(configPath: string): string {
  const normalized = configPath.replaceAll("\\", "/");

  if (
    normalized.startsWith("./") ||
    normalized.startsWith("../") ||
    normalized.startsWith("/")
  ) {
    return normalized;
  }

  return `./${normalized}`;
}

export function formatRunCommand(configPath: string): string {
  const normalizedPath = normalizeConfigPathForScript(configPath);

  if (normalizedPath === "./taki.json") {
    return "taki";
  }

  return `taki --config ${normalizedPath}`;
}

async function askSelect<T>(
  rl: ReturnType<typeof createInterface>,
  prompt: string,
  options: SelectOption<T>[],
  defaultIndex: number,
  uiOptions: PromptUiOptions = {},
): Promise<PromptResult<T>> {
  const safeDefaultIndex = Math.max(
    0,
    Math.min(defaultIndex, options.length - 1),
  );

  if (!stdin.isTTY || !stdout.isTTY) {
    const labels = options.map((option) => option.label).join("/");
    const fallback = await askWithDefault(
      rl,
      `${prompt} [${labels}]`,
      options[safeDefaultIndex]?.label ?? "",
    );

    if (fallback === BACK) {
      return BACK;
    }

    const matched = options.find(
      (option) => option.label.toLowerCase() === fallback.trim().toLowerCase(),
    );

    if (fallback.trim().toLowerCase() === "back") {
      return BACK;
    }

    return matched?.value ?? options[safeDefaultIndex]?.value;
  }

  const result = await askInkSelectPrompt(
    prompt,
    options,
    safeDefaultIndex,
    uiOptions.contextLines,
    ACTIVE_INIT_THEME,
  );
  if (result.type === "back") {
    if (!uiOptions.suppressEcho) {
      console.log(
        `${paintInit(ACTIVE_INIT_THEME.warningColor, "↩")} ${chalk.bold(prompt)}: ${paintInit(ACTIVE_INIT_THEME.mutedColor, "back")}`,
      );
    }
    return BACK;
  }

  const selected = options.find((option) => option.value === result.value);
  const chosen = selected
    ? colorizeByServiceColor(selected.label, selected.color)
    : String(result.value);
  if (!uiOptions.suppressEcho) {
    console.log(
      `${paintInit(ACTIVE_INIT_THEME.successColor, "✔")} ${chalk.bold(prompt)}: ${chosen}`,
    );
  }
  return result.value;
}

function formatPanelLine(
  content: string,
  plainLength: number,
  width: number,
): string {
  const padding = Math.max(0, width - plainLength);
  return `│ ${content}${" ".repeat(padding)} │`;
}

function colorizeByServiceColor(value: string, color?: ServiceColor): string {
  if (!color) {
    return value;
  }

  switch (color) {
    case "red":
      return chalk.red(value);
    case "green":
      return chalk.green(value);
    case "yellow":
      return chalk.yellow(value);
    case "blue":
      return chalk.blue(value);
    case "magenta":
      return chalk.magenta(value);
    case "cyan":
      return chalk.green(value);
    case "gray":
      return chalk.gray(value);
    case "white":
    default:
      return chalk.white(value);
  }
}

async function printBanner(configDisplayPath: string): Promise<void> {
  const catFrame = INIT_CAT;
  const catWidth = Math.max(...catFrame.map((line) => line.length));
  const rightColumn = [
    paintInit(ACTIVE_INIT_THEME.mutedColor, "────────────────────────────────"),
    `${paintInit(ACTIVE_INIT_THEME.accentColor, chalk.bold("TAKI INIT"))} ${paintInit(ACTIVE_INIT_THEME.mutedColor, TAKI_VERSION)}`,
    paintInit(
      ACTIVE_INIT_THEME.mutedColor,
      "Interactive setup for your local service workspace.",
    ),
    paintInit(
      ACTIVE_INIT_THEME.mutedColor,
      `Config target: ${configDisplayPath}`,
    ),
    paintInit(
      ACTIVE_INIT_THEME.mutedColor,
      "Tip: ← or Esc goes back one step.",
    ),
  ];

  console.log();
  for (
    let index = 0;
    index < Math.max(catFrame.length, rightColumn.length);
    index += 1
  ) {
    const catLine = (catFrame[index] ?? "").padEnd(catWidth, " ");
    const infoLine = rightColumn[index] ?? "";
    console.log(
      `${paintInit(ACTIVE_INIT_THEME.catColor, catLine)}  ${infoLine}`,
    );
  }
  console.log();
}

function printSection(title: string): void {
  console.log(
    `\n${chalk.magenta("-".repeat(18))} ${chalk.bold(title)} ${chalk.magenta("-".repeat(18))}`,
  );
}

function printStepHeader(
  _step: number,
  _totalSteps: number,
  title: string,
): void {
  const frame = INIT_CAT;

  const rightColumn = [
    chalk.bold(title),
    paintInit(ACTIVE_INIT_THEME.mutedColor, "Navigate with arrow keys"),
    paintInit(ACTIVE_INIT_THEME.mutedColor, "Use ← or Esc to go back"),
  ];

  const catWidth = Math.max(...frame.map((line) => line.length));
  const totalLines = Math.max(frame.length, rightColumn.length);

  console.log();
  for (let index = 0; index < totalLines; index += 1) {
    const catLine = (frame[index] ?? "").padEnd(catWidth, " ");
    const info = rightColumn[index] ?? "";
    console.log(`${paintInit(ACTIVE_INIT_THEME.catColor, catLine)}  ${info}`);
  }
}

function buildInkContextLines(
  configDisplayPath: string,
  draft: InitDraft,
  step: number,
  totalSteps: number,
  title: string,
): string[] {
  const frame = INIT_CAT;

  const rightColumn = [
    `${paintInit(ACTIVE_INIT_THEME.accentColor, chalk.bold("TAKI INIT"))} ${paintInit(ACTIVE_INIT_THEME.mutedColor, TAKI_VERSION)}`,
    paintInit(
      ACTIVE_INIT_THEME.mutedColor,
      `Config target: ${configDisplayPath}`,
    ),
    paintInit(
      ACTIVE_INIT_THEME.accentColor,
      chalk.bold(`${title} (${step}/${totalSteps})`),
    ),
    paintInit(ACTIVE_INIT_THEME.mutedColor, "Use ← or Esc to go back"),
  ];

  const catWidth = Math.max(...frame.map((line) => line.length));
  const totalLines = Math.max(frame.length, rightColumn.length);
  const lines: string[] = [""];

  for (let index = 0; index < totalLines; index += 1) {
    const catLine = (frame[index] ?? "").padEnd(catWidth, " ");
    const info = rightColumn[index] ?? "";
    lines.push(`${paintInit(ACTIVE_INIT_THEME.catColor, catLine)}  ${info}`);
  }

  lines.push("");
  lines.push(...buildPreviewPanelLines(draft, step, totalSteps));

  return lines;
}

function loadInitCatLines(): string[] {
  try {
    const fileUrl = new URL("../ui/ascii/cat.txt", import.meta.url);
    const fileContents = readFileSync(fileUrl, "utf8");
    const lines = fileContents
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0);

    if (lines.length > 0) {
      return lines;
    }
  } catch {
    // Fallback is used when asset file is unavailable.
  }

  return FALLBACK_INIT_CAT;
}

function buildPreviewPanelLines(
  draft: InitDraft,
  step: number,
  totalSteps: number,
): string[] {
  const metrics = getTerminalMetrics();
  const mode = getPreviewMode(draft, metrics);

  if (mode === "compact") {
    return buildCompactPreviewLines(draft, step, totalSteps, metrics);
  }

  const previewConfig: TakiConfig = {
    services: draft.services,
    maxLogLines: draft.maxLogLines,
  };

  const previewTitle = `Preview taki.json`;
  const previewBody = JSON.stringify(previewConfig, null, 2).split("\n");
  const maxLineLength = getWizardContentWidth();
  const lines: string[] = [
    paintInit(ACTIVE_INIT_THEME.mutedColor, panelTop(maxLineLength)),
    paintInit(
      ACTIVE_INIT_THEME.mutedColor,
      formatPanelLine(
        paintInit(
          ACTIVE_INIT_THEME.accentColor,
          chalk.bold(truncateText(previewTitle, maxLineLength)),
        ),
        Math.min(previewTitle.length, maxLineLength),
        maxLineLength,
      ),
    ),
    paintInit(ACTIVE_INIT_THEME.mutedColor, panelDivider(maxLineLength)),
  ];

  for (const line of previewBody) {
    const truncated = truncateText(line, maxLineLength);
    lines.push(
      paintInit(
        ACTIVE_INIT_THEME.mutedColor,
        formatPanelLine(
          paintInit(ACTIVE_INIT_THEME.contentColor, truncated),
          Math.min(line.length, maxLineLength),
          maxLineLength,
        ),
      ),
    );
  }

  lines.push(
    paintInit(ACTIVE_INIT_THEME.mutedColor, panelBottom(maxLineLength)),
  );
  return lines;
}

function buildCompactPreviewLines(
  draft: InitDraft,
  step: number,
  totalSteps: number,
  metrics: TerminalMetrics,
): string[] {
  const serviceNames = draft.services
    .map((service) => service.name)
    .filter(Boolean);
  const serviceLabel =
    serviceNames.length > 0
      ? `${serviceNames.slice(0, 3).join(", ")}${serviceNames.length > 3 ? ` +${serviceNames.length - 3} more` : ""}`
      : "(none yet)";

  const compactLines = [
    `Preview taki.json (Step ${step}/${totalSteps})`,
    `mode: compact (${metrics.columns}x${metrics.rows})`,
    `services: ${draft.services.length}/${draft.serviceCount} -> ${serviceLabel}`,
    `maxLogLines: ${draft.maxLogLines}`,
    "Tip: enlarge terminal for full JSON preview",
  ];

  const maxLineLength = getWizardContentWidth();
  const lines: string[] = [
    paintInit(ACTIVE_INIT_THEME.mutedColor, panelTop(maxLineLength)),
  ];
  for (const [index, line] of compactLines.entries()) {
    const truncated = truncateText(line, maxLineLength);
    const colorized =
      index === 0
        ? paintInit(ACTIVE_INIT_THEME.accentColor, chalk.bold(truncated))
        : index === compactLines.length - 1
          ? paintInit(ACTIVE_INIT_THEME.mutedColor, truncated)
          : paintInit(ACTIVE_INIT_THEME.contentColor, truncated);
    lines.push(
      paintInit(
        ACTIVE_INIT_THEME.mutedColor,
        formatPanelLine(
          colorized,
          Math.min(line.length, maxLineLength),
          maxLineLength,
        ),
      ),
    );
    if (index === 0) {
      lines.push(
        paintInit(ACTIVE_INIT_THEME.mutedColor, panelDivider(maxLineLength)),
      );
    }
  }
  lines.push(
    paintInit(ACTIVE_INIT_THEME.mutedColor, panelBottom(maxLineLength)),
  );
  return lines;
}

function renderPreview(
  draft: InitDraft,
  step: number,
  totalSteps: number,
): void {
  for (const line of buildPreviewPanelLines(draft, step, totalSteps)) {
    console.log(line);
  }
}

function getTerminalMetrics(): TerminalMetrics {
  return {
    columns: stdout.columns ?? 100,
    rows: stdout.rows ?? 35,
  };
}

export function getPreviewMode(
  draft: InitDraft,
  metrics: TerminalMetrics,
): PreviewMode {
  if (metrics.columns < 76 || metrics.rows < 26) {
    return "compact";
  }

  const estimatedJsonLines = JSON.stringify(
    {
      services: draft.services,
      maxLogLines: draft.maxLogLines,
    },
    null,
    2,
  ).split("\n").length;

  if (estimatedJsonLines > metrics.rows - 14) {
    return "compact";
  }

  return "full";
}

async function configureServicesStep(
  rl: ReturnType<typeof createInterface>,
  serviceCount: number,
  existingServices: ServiceConfig[],
  buildContextLines?: (
    serviceIndex: number,
    servicesSnapshot: ServiceConfig[],
  ) => string[],
  suppressEcho = false,
): Promise<PromptResult<ServiceConfig[]>> {
  const services: ServiceConfig[] = [];

  for (let index = 0; index < serviceCount; index += 1) {
    const previous = existingServices[index];
    const defaultName = previous?.name ?? `Service-${index + 1}`;
    const defaultColor =
      previous?.color ??
      DEFAULT_COLORS[index % DEFAULT_COLORS.length] ??
      "white";

    if (!suppressEcho) {
      printSection(`Service ${index + 1}/${serviceCount}`);
    }

    const uiOptions: PromptUiOptions = {
      suppressEcho,
      contextLines: buildContextLines
        ? buildContextLines(
            index,
            services.length > 0 ? services : existingServices,
          )
        : undefined,
    };

    const service = await askService(
      rl,
      index,
      services.length > 0 ? services : existingServices,
      defaultName,
      defaultColor,
      uiOptions,
    );

    if (service === BACK) {
      return BACK;
    }

    services.push({
      ...previous,
      ...service,
    });
  }

  return services;
}

async function askInputBox(
  rl: ReturnType<typeof createInterface>,
  prompt: string,
  defaultValue: string,
  uiOptions: PromptUiOptions = {},
): Promise<PromptResult<string>> {
  if (!stdin.isTTY || !stdout.isTTY) {
    const suffix = defaultValue ? ` (${defaultValue})` : "";
    const answer = await rl.question(`? ${chalk.bold(prompt)}${suffix}: `);
    const trimmed = answer.trim();
    return trimmed || defaultValue;
  }

  const result = await askInkInputPrompt(
    prompt,
    defaultValue,
    uiOptions.contextLines,
    ACTIVE_INIT_THEME,
  );
  if (result.type === "back") {
    if (!uiOptions.suppressEcho) {
      console.log(
        `${paintInit(ACTIVE_INIT_THEME.warningColor, "↩")} ${chalk.bold(prompt)}: ${paintInit(ACTIVE_INIT_THEME.mutedColor, "back")}`,
      );
    }
    return BACK;
  }

  if (!uiOptions.suppressEcho) {
    console.log(
      `${paintInit(ACTIVE_INIT_THEME.successColor, "✔")} ${chalk.bold(prompt)}: ${paintInit(ACTIVE_INIT_THEME.contentColor, result.value || "(empty)")}`,
    );
  }
  return result.value;
}

function getWizardContentWidth(): number {
  const columns = stdout.columns ?? 100;
  // Panel rendering adds 4 border/padding characters around content.
  return Math.max(1, columns - 4);
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  if (maxLength <= 1) {
    return "…";
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function panelTop(width: number): string {
  return `╭${"─".repeat(width + 2)}╮`;
}

function panelDivider(width: number): string {
  return `├${"─".repeat(width + 2)}┤`;
}

function panelBottom(width: number): string {
  return `╰${"─".repeat(width + 2)}╯`;
}
