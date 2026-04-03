import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdDirs.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  createdDirs.length = 0;
});

describe("CLI command behavior", () => {
  it("prints version for command and alias", async () => {
    const resultVersion = await runCli(["version"]);
    expect(resultVersion.exitCode).toBe(0);
    expect(resultVersion.stdout).toMatch(/^taki v\d+\.\d+\.\d+/m);

    const resultAlias = await runCli(["v"]);
    expect(resultAlias.exitCode).toBe(0);
    expect(resultAlias.stdout).toMatch(/^taki v\d+\.\d+\.\d+/m);

    const resultFlag = await runCli(["--version"]);
    expect(resultFlag.exitCode).toBe(0);
    expect(resultFlag.stdout).toMatch(/^\d+\.\d+\.\d+/m);
  });

  it("uses subcommand --config for config output", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "taki-cli-commands-"));
    createdDirs.push(tempDir);

    const targetConfig = path.join(tempDir, "target.json");
    await writeFile(
      targetConfig,
      JSON.stringify({
        services: [{ name: "target", command: "npm", args: ["run", "dev"] }],
      }),
      "utf8",
    );

    const result = await runCli(["config", "--config", targetConfig]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"name": "target"');
  });

  it("uses subcommand --config for add and does not mutate cwd config", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "taki-cli-add-"));
    createdDirs.push(tempDir);

    const targetConfig = path.join(tempDir, "target.json");
    const cwdConfig = path.join(tempDir, "taki.json");

    await writeFile(
      targetConfig,
      JSON.stringify({
        services: [{ name: "target", command: "npm", args: ["run", "dev"] }],
      }),
      "utf8",
    );

    await writeFile(
      cwdConfig,
      JSON.stringify({
        services: [{ name: "cwd", command: "npm", args: ["run", "dev"] }],
      }),
      "utf8",
    );

    const result = await runCli(
      [
        "add",
        "--config",
        targetConfig,
        "--name",
        "web",
        "--command",
        "npm",
        "--args",
        "run dev",
        "--color",
        "cyan",
        "--yes",
      ],
      tempDir,
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Added service");

    const target = JSON.parse(await readFile(targetConfig, "utf8")) as {
      services: Array<{ name: string }>;
    };
    const cwd = JSON.parse(await readFile(cwdConfig, "utf8")) as {
      services: Array<{ name: string }>;
    };

    expect(target.services.map((service) => service.name)).toEqual([
      "target",
      "web",
    ]);
    expect(cwd.services.map((service) => service.name)).toEqual(["cwd"]);
  });
});

type CliResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

async function runCli(args: string[], cwd?: string): Promise<CliResult> {
  const workspaceRoot = path.resolve(here, "..", "..");
  const tsxCli = path.join(
    workspaceRoot,
    "node_modules",
    "tsx",
    "dist",
    "cli.mjs",
  );
  const takiCli = path.join(workspaceRoot, "src", "bin", "cli.ts");

  const child = spawn(process.execPath, [tsxCli, takiCli, ...args], {
    cwd: cwd ?? workspaceRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk: Buffer | string) => {
    stdout += chunk.toString();
  });

  child.stderr.on("data", (chunk: Buffer | string) => {
    stderr += chunk.toString();
  });

  const exitCode = await new Promise<number | null>((resolve) => {
    child.on("exit", (code) => resolve(code));
  });

  return {
    exitCode,
    stdout,
    stderr,
  };
}
