import { describe, expect, it, vi } from "vitest";
import { shouldUseShellForCommand } from "../../src/core/process-manager.js";

describe("shouldUseShellForCommand", () => {
  it("returns true when command has no args", () => {
    expect(shouldUseShellForCommand("npm run dev", false)).toBe(true);
  });

  it("returns false on non-Windows when args are provided", () => {
    const platformSpy = vi
      .spyOn(process, "platform", "get")
      .mockReturnValue("linux");

    expect(shouldUseShellForCommand("npm", true)).toBe(false);

    platformSpy.mockRestore();
  });

  it("returns true for Windows command shims when args are provided", () => {
    const platformSpy = vi
      .spyOn(process, "platform", "get")
      .mockReturnValue("win32");

    expect(shouldUseShellForCommand("npm", true)).toBe(true);
    expect(shouldUseShellForCommand("yarn", true)).toBe(true);

    platformSpy.mockRestore();
  });

  it("returns true for .cmd and .bat on Windows", () => {
    const platformSpy = vi
      .spyOn(process, "platform", "get")
      .mockReturnValue("win32");

    expect(shouldUseShellForCommand("tool.cmd", true)).toBe(true);
    expect(shouldUseShellForCommand("tool.bat", true)).toBe(true);

    platformSpy.mockRestore();
  });

  it("returns false for non-shim executables on Windows", () => {
    const platformSpy = vi
      .spyOn(process, "platform", "get")
      .mockReturnValue("win32");

    expect(shouldUseShellForCommand("node", true)).toBe(false);

    platformSpy.mockRestore();
  });
});
