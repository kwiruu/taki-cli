import { describe, expect, it } from "vitest";
import {
  formatRunCommand,
  getPreviewMode,
  normalizeConfigPathForScript,
  parseArgsInput,
  parseCsvList,
} from "../../src/core/init.js";

describe("init helpers", () => {
  it("parses space-separated args with quotes", () => {
    expect(parseArgsInput('run dev --port "3000" --host "127.0.0.1"')).toEqual([
      "run",
      "dev",
      "--port",
      "3000",
      "--host",
      "127.0.0.1",
    ]);
  });

  it("parses unique csv dependency names", () => {
    expect(parseCsvList("api, ui, api, worker")).toEqual([
      "api",
      "ui",
      "worker",
    ]);
  });

  it("normalizes relative script config path", () => {
    expect(normalizeConfigPathForScript("taki.json")).toBe("./taki.json");
    expect(normalizeConfigPathForScript("configs/taki.json")).toBe(
      "./configs/taki.json",
    );
    expect(normalizeConfigPathForScript("./custom.json")).toBe("./custom.json");
  });

  it("formats run command for default config", () => {
    expect(formatRunCommand("taki.json")).toBe("taki");
    expect(formatRunCommand("./taki.json")).toBe("taki");
  });

  it("formats run command for custom config", () => {
    expect(formatRunCommand("configs/taki.json")).toBe(
      "taki --config ./configs/taki.json",
    );
  });

  it("uses compact preview for small terminal", () => {
    expect(
      getPreviewMode(
        {
          serviceCount: 2,
          services: [],
          maxLogLines: 200,
          setupScript: true,
        },
        { columns: 70, rows: 30 },
      ),
    ).toBe("compact");
  });

  it("uses full preview for larger terminal with short config", () => {
    expect(
      getPreviewMode(
        {
          serviceCount: 2,
          services: [{ name: "API", command: "npm" }],
          maxLogLines: 200,
          setupScript: true,
        },
        { columns: 120, rows: 40 },
      ),
    ).toBe("full");
  });
});
