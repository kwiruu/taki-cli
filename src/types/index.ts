export type ServiceColor =
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "gray";

export interface ServiceConfig {
  name: string;
  command: string;
  args?: string[];
  color?: ServiceColor;
  cwd?: string;
  env?: Record<string, string>;
  startAfter?: string[];
  healthCheck?: HealthCheckConfig;
}

export type HealthCheckConfig =
  | {
      type: "http";
      url: string;
      intervalMs?: number;
      timeoutMs?: number;
    }
  | {
      type: "log";
      pattern: string;
      timeoutMs?: number;
    };

export interface TakiConfig {
  services: ServiceConfig[];
  maxLogLines?: number;
}

export type LogSource = "stdout" | "stderr" | "system";

export interface LogEntry {
  id: number;
  serviceName: string;
  serviceColor: ServiceColor;
  source: LogSource;
  line: string;
  timestamp: number;
}

export type ServiceStatus =
  | "starting"
  | "running"
  | "exited"
  | "failed"
  | "stopped";

export interface ServiceState {
  name: string;
  color: ServiceColor;
  status: ServiceStatus;
  ready: boolean;
  pid?: number;
  exitCode?: number | null;
  signal?: NodeJS.Signals | null;
}
