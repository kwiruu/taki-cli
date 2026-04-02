import type { LogEntry, ServiceState } from "../types/index.js";

export type ManagerEventMap = {
  log: (entry: LogEntry) => void;
  serviceState: (state: ServiceState) => void;
  idle: () => void;
};
