import type { ServiceColor, ServiceState } from "../types/index.js";

export function getServiceColor(color?: ServiceColor): ServiceColor {
  return color ?? "white";
}

export function formatUptime(startedAt: number, now: number): string {
  const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function countRunning(states: ServiceState[]): number {
  return states.filter(
    (state) => state.status === "running" || state.status === "starting",
  ).length;
}

export function countReady(states: ServiceState[]): number {
  return states.filter((state) => state.ready).length;
}
