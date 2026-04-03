import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runAddService } from "../../src/core/add.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdDirs.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  createdDirs.length = 0;
});

describe("runAddService", () => {
  it("adds service in non-interactive mode and preserves existing config fields", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "taki-add-"));
    createdDirs.push(dir);

    const configPath = path.join(dir, "taki.json");
    await writeFile(
      configPath,
      JSON.stringify(
        {
          services: [{ name: "api", command: "npm", args: ["run", "dev"] }],
          maxLogLines: 321,
          ui: { theme: "vscode-dark-plus" },
        },
        null,
        2,
      ),
      "utf8",
    );

    await runAddService({
      configPath,
      name: "web",
      command: "npm",
      args: "run web",
      color: "cyan",
      yes: true,
    });

    const next = JSON.parse(await readFile(configPath, "utf8")) as {
      services: Array<{ name: string; color?: string }>;
      maxLogLines?: number;
      ui?: { theme?: string };
    };

    expect(next.maxLogLines).toBe(321);
    expect(next.ui?.theme).toBe("vscode-dark-plus");
    expect(next.services.map((service) => service.name)).toEqual([
      "api",
      "web",
    ]);
    expect(next.services[1]?.color).toBe("cyan");
  });

  it("rejects duplicate service names", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "taki-add-"));
    createdDirs.push(dir);

    const configPath = path.join(dir, "taki.json");
    await writeFile(
      configPath,
      JSON.stringify({
        services: [{ name: "api", command: "npm", args: ["run", "dev"] }],
      }),
      "utf8",
    );

    await expect(
      runAddService({
        configPath,
        name: "api",
        command: "npm",
        args: "run dev",
        yes: true,
      }),
    ).rejects.toThrow("already exists");
  });

  it("rejects invalid service color in non-interactive mode", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "taki-add-"));
    createdDirs.push(dir);

    const configPath = path.join(dir, "taki.json");
    await writeFile(
      configPath,
      JSON.stringify({
        services: [{ name: "api", command: "npm", args: ["run", "dev"] }],
      }),
      "utf8",
    );

    await expect(
      runAddService({
        configPath,
        name: "web",
        command: "npm",
        args: "run dev",
        color: "orange",
        yes: true,
      }),
    ).rejects.toThrow("Invalid --color value");
  });

  it("rejects unknown startAfter dependencies", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "taki-add-"));
    createdDirs.push(dir);

    const configPath = path.join(dir, "taki.json");
    await writeFile(
      configPath,
      JSON.stringify({
        services: [{ name: "api", command: "npm", args: ["run", "dev"] }],
      }),
      "utf8",
    );

    await expect(
      runAddService({
        configPath,
        name: "web",
        command: "npm",
        args: "run dev",
        startAfter: "missing-service",
        yes: true,
      }),
    ).rejects.toThrow("Unknown dependencies");
  });
});
