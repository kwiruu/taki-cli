import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, rm, mkdtemp, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
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

describe("CLI integration", () => {
  it("stops service trees on Ctrl+C", async () => {
    const workspaceRoot = path.resolve(here, "..", "..");
    const tempDir = await mkdtemp(path.join(tmpdir(), "taki-integration-"));
    createdDirs.push(tempDir);

    const parentPidFile = path.join(tempDir, "parent.pid");
    const childPidFile = path.join(tempDir, "child.pid");
    const configPath = path.join(tempDir, "taki.json");

    await writeFile(
      configPath,
      JSON.stringify({
        services: [
          {
            name: "tree",
            command: process.execPath,
            args: [
              path.join(workspaceRoot, "test", "fixtures", "tree-parent.js"),
            ],
            color: "yellow",
            env: {
              TAKI_PARENT_PID_FILE: parentPidFile,
              TAKI_CHILD_PID_FILE: childPidFile,
            },
            healthCheck: {
              type: "log",
              pattern: "PARENT_READY",
              timeoutMs: 5000,
            },
          },
        ],
      }),
      "utf8",
    );

    const tsxCli = path.join(
      workspaceRoot,
      "node_modules",
      "tsx",
      "dist",
      "cli.mjs",
    );
    const takiCli = path.join(workspaceRoot, "src", "bin", "cli.ts");

    const cli = spawn(
      process.execPath,
      [tsxCli, takiCli, "--config", configPath],
      {
        cwd: workspaceRoot,
        stdio: "pipe",
        env: process.env,
      },
    );

    await waitForFile(parentPidFile, 8000);
    await waitForFile(childPidFile, 8000);

    const parentPid = Number((await readFile(parentPidFile, "utf8")).trim());
    const childPid = Number((await readFile(childPidFile, "utf8")).trim());

    expect(isPidAlive(parentPid)).toBe(true);
    expect(isPidAlive(childPid)).toBe(true);

    cli.kill("SIGINT");
    await once(cli, "exit");

    await waitForDeath(parentPid, 6000);
    await waitForDeath(childPid, 6000);

    expect(isPidAlive(parentPid)).toBe(false);
    expect(isPidAlive(childPid)).toBe(false);
  }, 25000);
});

async function waitForFile(filePath: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      await access(filePath);
      return;
    } catch {
      await delay(100);
    }
  }

  throw new Error(`Timed out waiting for file: ${filePath}`);
}

async function waitForDeath(pid: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) {
      return;
    }

    await delay(100);
  }

  throw new Error(`Timed out waiting for PID ${pid} to stop.`);
}

function isPidAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (typeof error === "object" && error && "code" in error) {
      return (error as { code?: string }).code === "EPERM";
    }

    return false;
  }
}
