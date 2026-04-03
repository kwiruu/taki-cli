#!/usr/bin/env node
import React from "react";
import { createRequire } from "node:module";
import { Command } from "commander";
import { render } from "ink";
import { loadConfig, setConfigThemePreference } from "../core/config.js";
import { runAddService } from "../core/add.js";
import { runInteractiveInit } from "../core/init.js";
import { ProcessManager } from "../core/process-manager.js";
import { installSignalHandlers } from "../core/shutdown-handler.js";
import { RingBuffer } from "../io/ring-buffer.js";
import { App } from "../ui/app.js";
import type { LogEntry } from "../types/index.js";

const require = createRequire(import.meta.url);
const packageJson = require("../../package.json") as { version?: string };
const TAKI_CLI_VERSION = packageJson.version ?? "0.0.0";

type RunOptions = {
  config: string;
  maxLogLines?: number;
  shutdownTimeout: number;
};

type ConfigOptions = {
  config: string;
};

type AddOptions = {
  config: string;
  name?: string;
  command?: string;
  args?: string;
  color?: string;
  cwd?: string;
  startAfter?: string;
  yes?: boolean;
};

const parseNumberOption = (value: string): number => Number.parseInt(value, 10);

const program = new Command()
  .name("taki")
  .description(
    "Run multiple local services in one color-coded terminal dashboard.",
  )
  .enablePositionalOptions()
  .version(TAKI_CLI_VERSION, "-v, --version", "Show Taki CLI version")
  .option("-c, --config <path>", "Path to the config file", "taki.json")
  .option(
    "--max-log-lines <count>",
    "In-memory ring buffer line count",
    parseNumberOption,
  )
  .option(
    "--shutdown-timeout <ms>",
    "Grace period before force killing child processes",
    parseNumberOption,
    4000,
  )
  .action(async () => {
    await runDashboard(program.opts<RunOptions>());
  });

program
  .command("version")
  .alias("v")
  .description("Show current taki version.")
  .action(() => {
    printVersion();
  });

program
  .command("config")
  .description("Print validated taki config JSON.")
  .option("-c, --config <path>", "Path to the config file", "taki.json")
  .action(async (options: ConfigOptions) => {
    await printCurrentConfig(options);
  });

program
  .command("run")
  .description("Run services using taki.json in the current folder.")
  .option("-c, --config <path>", "Path to the config file", "taki.json")
  .option(
    "--max-log-lines <count>",
    "In-memory ring buffer line count",
    parseNumberOption,
  )
  .option(
    "--shutdown-timeout <ms>",
    "Grace period before force killing child processes",
    parseNumberOption,
    4000,
  )
  .action(async (options: RunOptions) => {
    await runDashboard(options);
  });

program
  .command("init")
  .description("Create a taki.json file with an interactive setup wizard.")
  .option("-c, --config <path>", "Path to write the config", "taki.json")
  .option("-f, --force", "Overwrite existing config without prompt", false)
  .action(async (options: { config: string; force: boolean }) => {
    await runInteractiveInit({
      configPath: options.config,
      force: options.force,
    });
  });

program
  .command("add")
  .description("Add a new service entry to taki config.")
  .option("-c, --config <path>", "Path to the config file", "taki.json")
  .option("--name <name>", "Service name")
  .option("--command <command>", "Command executable")
  .option("--args <args>", 'Args as a quoted string, e.g. "run dev"')
  .option("--color <color>", "Service color")
  .option("--cwd <path>", "Service working directory")
  .option(
    "--start-after <names>",
    "Comma-separated service names to start after",
  )
  .option("-y, --yes", "Skip interactive prompts and use only provided flags")
  .action(async (options: AddOptions) => {
    await runAddService({
      configPath: options.config,
      name: options.name,
      command: options.command,
      args: options.args,
      color: options.color,
      cwd: options.cwd,
      startAfter: options.startAfter,
      yes: options.yes,
    });
  });

void main();

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected CLI startup failure";
    console.error(`Taki failed: ${message}`);
    process.exit(1);
  }
}

async function runDashboard(options: RunOptions): Promise<void> {
  const config = await loadConfig(options.config);
  const maxLogLines = options.maxLogLines ?? config.maxLogLines ?? 200;
  const configuredTheme = config.ui?.theme;

  if (process.stdout.isTTY) {
    console.clear();
  }

  const manager = new ProcessManager();
  const logBuffer = new RingBuffer<LogEntry>(maxLogLines);
  const startedAt = Date.now();

  let shuttingDown = false;

  const ui = render(
    React.createElement(App, {
      manager,
      logBuffer,
      startedAt,
      maxDisplayLines: maxLogLines,
      initialThemeId: configuredTheme,
      onThemeChange: async (theme) => {
        await setConfigThemePreference(options.config, theme);
      },
      onQuitRequest: () => {
        void shutdown("SIGINT");
      },
    }),
  );

  const disposeSignals = installSignalHandlers(async (signal) => {
    await shutdown(signal);
  });

  try {
    await manager.startAll(config.services);
    await manager.waitForIdle();
    await shutdown("SIGTERM", false);
    process.exit(manager.getOverallExitCode());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown startup failure";
    console.error(`Taki failed: ${message}`);
    await shutdown("SIGTERM", false);
    process.exit(1);
  }

  async function shutdown(
    signal: NodeJS.Signals,
    shouldExit = true,
  ): Promise<void> {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    disposeSignals();

    await manager.shutdownAll(options.shutdownTimeout);
    ui.unmount();

    if (shouldExit) {
      process.exit(signal === "SIGINT" ? 130 : 0);
    }
  }
}

async function printCurrentConfig(options: ConfigOptions): Promise<void> {
  const config = await loadConfig(options.config);
  console.log(JSON.stringify(config, null, 2));
}

function printVersion(): void {
  console.log(`taki v${TAKI_CLI_VERSION}`);
}
