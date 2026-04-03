export type ServiceColor =
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "gray";

export type ThemePresetId =
  | "default-white"
  | "basic-blue"
  | "basic-red"
  | "basic-cyan"
  | "basic-pink"
  | "vscode-dark-plus"
  | "vscode-light-plus"
  | "vscode-monokai"
  | "vscode-github-dark"
  | "vscode-github-light"
  | "terminal-gruvbox-dark"
  | "terminal-solarized-dark"
  | "terminal-solarized-light"
  | "terminal-nord"
  | "terminal-dracula"
  | "terminal-one-dark";

export interface UiConfig {
  theme?: ThemePresetId;
}

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
  ui?: UiConfig;
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
