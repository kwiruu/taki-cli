import { promises as fs } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type {
  ServiceColor,
  ServiceConfig,
  TakiConfig,
} from "../types/index.js";
import { loadConfig } from "./config.js";
import { parseArgsInput, parseCsvList } from "./init.js";

const SERVICE_COLORS: readonly ServiceColor[] = [
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "gray",
];

export interface AddServiceOptions {
  configPath: string;
  name?: string;
  command?: string;
  args?: string;
  color?: string;
  cwd?: string;
  startAfter?: string;
  yes?: boolean;
}

export async function runAddService(options: AddServiceOptions): Promise<void> {
  const resolvedConfigPath = path.resolve(options.configPath);
  const existingConfig = await loadConfig(resolvedConfigPath);

  const service = options.yes
    ? buildServiceFromOptions(options, existingConfig)
    : await buildServiceInteractively(options, existingConfig);

  const nextConfig: TakiConfig = {
    ...existingConfig,
    services: [...existingConfig.services, service],
  };

  await fs.writeFile(
    resolvedConfigPath,
    `${JSON.stringify(nextConfig, null, 2)}\n`,
    "utf8",
  );

  // Re-validate written config to keep behavior consistent with loader checks.
  await loadConfig(resolvedConfigPath);

  console.log(`Added service \"${service.name}\" to ${resolvedConfigPath}`);
}

function buildServiceFromOptions(
  options: AddServiceOptions,
  config: TakiConfig,
): ServiceConfig {
  const name = options.name?.trim();
  if (!name) {
    throw new Error("--name is required when using --yes.");
  }

  const command = options.command?.trim();
  if (!command) {
    throw new Error("--command is required when using --yes.");
  }

  const args = parseArgsInput(options.args ?? "");
  const startAfter = parseCsvList(options.startAfter ?? "");
  const color = normalizeServiceColor(options.color);

  return finalizeService(
    {
      name,
      command,
      args,
      color,
      cwd: options.cwd?.trim(),
      startAfter,
    },
    config,
  );
}

async function buildServiceInteractively(
  options: AddServiceOptions,
  config: TakiConfig,
): Promise<ServiceConfig> {
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const name = await askRequired(
      rl,
      "Service name",
      options.name?.trim() ?? "",
    );

    const command = await askRequired(
      rl,
      "Command executable",
      options.command?.trim() ?? "npm",
    );

    const argsInput = await askOptional(
      rl,
      "Args (space-separated, optional)",
      options.args ?? "",
    );

    const defaultColor = options.color?.trim() ?? "";
    const colorInput = await askOptional(
      rl,
      `Color (${SERVICE_COLORS.join(", ")}, optional)`,
      defaultColor,
    );

    const cwd = await askOptional(
      rl,
      "Working directory (optional)",
      options.cwd ?? "",
    );

    const knownServices = config.services.map((service) => service.name);
    const dependenciesPrompt =
      knownServices.length > 0
        ? `Start after (comma-separated names, optional) [known: ${knownServices.join(", ")}]`
        : "Start after (comma-separated names, optional)";

    const startAfterInput = await askOptional(
      rl,
      dependenciesPrompt,
      options.startAfter ?? "",
    );

    const color = normalizeServiceColor(colorInput);

    return finalizeService(
      {
        name,
        command,
        args: parseArgsInput(argsInput),
        color,
        cwd,
        startAfter: parseCsvList(startAfterInput),
      },
      config,
    );
  } finally {
    rl.close();
  }
}

function finalizeService(
  draft: {
    name: string;
    command: string;
    args: string[];
    color?: ServiceColor;
    cwd?: string;
    startAfter: string[];
  },
  config: TakiConfig,
): ServiceConfig {
  const existingNames = new Set(config.services.map((service) => service.name));

  if (existingNames.has(draft.name)) {
    throw new Error(`Service \"${draft.name}\" already exists.`);
  }

  const unknownDependencies = draft.startAfter.filter(
    (dependency) => !existingNames.has(dependency),
  );

  if (unknownDependencies.length > 0) {
    throw new Error(
      `Unknown dependencies for startAfter: ${unknownDependencies.join(", ")}`,
    );
  }

  if (draft.startAfter.includes(draft.name)) {
    throw new Error("A service cannot depend on itself in startAfter.");
  }

  const service: ServiceConfig = {
    name: draft.name,
    command: draft.command,
  };

  if (draft.args.length > 0) {
    service.args = draft.args;
  }

  if (draft.color) {
    service.color = draft.color;
  }

  if (draft.cwd?.trim()) {
    service.cwd = draft.cwd.trim();
  }

  if (draft.startAfter.length > 0) {
    service.startAfter = draft.startAfter;
  }

  return service;
}

function normalizeServiceColor(
  value: string | undefined,
): ServiceColor | undefined {
  if (!value || !value.trim()) {
    return undefined;
  }

  const lowered = value.trim().toLowerCase();
  if (!SERVICE_COLORS.includes(lowered as ServiceColor)) {
    throw new Error(
      `Invalid --color value: ${value}. Expected one of ${SERVICE_COLORS.join(", ")}.`,
    );
  }

  return lowered as ServiceColor;
}

async function askRequired(
  rl: ReturnType<typeof createInterface>,
  prompt: string,
  defaultValue: string,
): Promise<string> {
  for (;;) {
    const value = await askOptional(rl, prompt, defaultValue);
    if (value.trim()) {
      return value.trim();
    }
    console.log(`${prompt} is required.`);
  }
}

async function askOptional(
  rl: ReturnType<typeof createInterface>,
  prompt: string,
  defaultValue: string,
): Promise<string> {
  const suffix = defaultValue ? ` (${defaultValue})` : "";
  const answer = await rl.question(`${prompt}${suffix}: `);
  const trimmed = answer.trim();
  return trimmed || defaultValue;
}
