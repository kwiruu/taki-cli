import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../../src/core/config.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdDirs.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  createdDirs.length = 0;
});

describe("loadConfig", () => {
  it("loads valid taki.json", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "taki-config-"));
    createdDirs.push(dir);

    const file = path.join(dir, "taki.json");
    await writeFile(
      file,
      JSON.stringify({
        services: [
          {
            name: "UI",
            command: "npm",
            args: ["run", "dev"],
            color: "cyan",
            healthCheck: {
              type: "log",
              pattern: "ready",
            },
          },
          {
            name: "API",
            command: "python",
            args: ["-m", "http.server", "8000"],
            startAfter: ["UI"],
            healthCheck: {
              type: "http",
              url: "http://127.0.0.1:8000/health",
            },
          },
        ],
        maxLogLines: 100,
      }),
    );

    const config = await loadConfig(file);
    expect(config.services).toHaveLength(2);
    expect(config.maxLogLines).toBe(100);
    expect(config.services[0]?.args).toEqual(["run", "dev"]);
    expect(config.services[1]?.startAfter).toEqual(["UI"]);
  });

  it("throws on invalid schema", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "taki-config-"));
    createdDirs.push(dir);

    const file = path.join(dir, "taki.json");
    await writeFile(file, JSON.stringify({ services: [] }));

    await expect(loadConfig(file)).rejects.toThrow("Invalid taki.json");
  });

  it("throws on unknown startup dependency", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "taki-config-"));
    createdDirs.push(dir);

    const file = path.join(dir, "taki.json");
    await writeFile(
      file,
      JSON.stringify({
        services: [
          {
            name: "UI",
            command: "npm run dev",
            startAfter: ["missing-service"],
          },
        ],
      }),
    );

    await expect(loadConfig(file)).rejects.toThrow("Unknown dependency");
  });

  it("throws on duplicate service names", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "taki-config-"));
    createdDirs.push(dir);

    const file = path.join(dir, "taki.json");
    await writeFile(
      file,
      JSON.stringify({
        services: [
          { name: "UI", command: "npm run dev" },
          { name: "UI", command: "npm run dev" },
        ],
      }),
    );

    await expect(loadConfig(file)).rejects.toThrow("Duplicate service names");
  });
});
