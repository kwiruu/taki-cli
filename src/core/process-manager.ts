import { EventEmitter } from "node:events";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import kill from "tree-kill";
import { createChunkLineParser } from "../io/line-parser.js";
import { getServiceColor } from "../ui/formatters.js";
import type {
  HealthCheckConfig,
  LogEntry,
  ServiceConfig,
  ServiceState,
} from "../types/index.js";

type ManagerEvents = {
  log: (entry: LogEntry) => void;
  serviceState: (state: ServiceState) => void;
  idle: () => void;
};

interface ManagedChild {
  child: ChildProcess;
  state: ServiceState;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  settled: () => boolean;
}

interface LogHealthTracker {
  matcher: RegExp;
  timeout: NodeJS.Timeout;
  markReady: () => void;
  markFailed: (reason: string) => void;
}

export class ProcessManager extends EventEmitter {
  private readonly children = new Map<string, ManagedChild>();
  private readonly serviceConfigs = new Map<string, ServiceConfig>();
  private readonly states = new Map<string, ServiceState>();
  private readonly readyDeferreds = new Map<string, Deferred<void>>();
  private readonly startPromises = new Map<string, Promise<void>>();
  private readonly logHealthTrackers = new Map<string, LogHealthTracker>();
  private readonly restartingServices = new Set<string>();
  private serviceOrder: string[] = [];
  private lineId = 0;
  private shuttingDown = false;

  on<K extends keyof ManagerEvents>(
    event: K,
    listener: ManagerEvents[K],
  ): this {
    return super.on(event, listener);
  }

  emit<K extends keyof ManagerEvents>(
    event: K,
    ...args: Parameters<ManagerEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }

  async startAll(services: ServiceConfig[]): Promise<void> {
    this.shuttingDown = false;

    this.serviceOrder = services.map((service) => service.name);
    for (const service of services) {
      this.serviceConfigs.set(service.name, service);
      if (!this.states.has(service.name)) {
        this.states.set(service.name, {
          name: service.name,
          color: getServiceColor(service.color),
          status: "starting",
          ready: false,
        });
      }
      this.getOrCreateReadyDeferred(service.name);
    }

    await Promise.all(
      services.map((service) =>
        this.startServiceWithDependencies(service.name, new Set()),
      ),
    );
  }

  getServiceStates(): ServiceState[] {
    if (this.serviceOrder.length === 0) {
      return Array.from(this.states.values()).map((state) => ({ ...state }));
    }

    return this.serviceOrder
      .map((name) => this.states.get(name))
      .filter((state): state is ServiceState => Boolean(state))
      .map((state) => ({ ...state }));
  }

  async restartService(name: string): Promise<void> {
    const service = this.serviceConfigs.get(name);
    if (!service) {
      throw new Error(`Cannot restart unknown service \"${name}\".`);
    }

    this.restartingServices.add(name);

    try {
      const managed = this.children.get(name);
      if (managed && managed.child.exitCode === null) {
        this.emitSystemLog(
          name,
          managed.state.color,
          "Restart requested. Stopping existing process...",
        );
        await this.killTree(managed.child.pid, "SIGTERM");
        await this.waitForExit(managed.child);
      }

      this.readyDeferreds.set(name, createDeferred<void>());
      this.startPromises.delete(name);
      this.startOne(service);
    } finally {
      this.restartingServices.delete(name);
      if (
        !this.shuttingDown &&
        this.restartingServices.size === 0 &&
        !this.hasRunningChildren()
      ) {
        this.emit("idle");
      }
    }
  }

  hasRunningChildren(): boolean {
    return Array.from(this.children.values()).some(
      (managed) =>
        managed.child.exitCode === null && managed.child.signalCode === null,
    );
  }

  async waitForIdle(): Promise<void> {
    if (!this.hasRunningChildren()) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.once("idle", resolve);
    });
  }

  async shutdownAll(timeoutMs: number): Promise<void> {
    if (this.shuttingDown) {
      return;
    }

    this.shuttingDown = true;

    const active = Array.from(this.children.values())
      .map((managed) => managed.child)
      .filter((child) => child.exitCode === null);

    await Promise.all(
      active.map((child) => this.killTree(child.pid, "SIGTERM")),
    );

    await Promise.race([
      Promise.all(active.map((child) => this.waitForExit(child))),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);

    const stillRunning = active.filter((child) => child.exitCode === null);
    if (stillRunning.length > 0) {
      await Promise.all(
        stillRunning.map((child) => this.killTree(child.pid, "SIGKILL")),
      );
    }

    for (const tracker of this.logHealthTrackers.values()) {
      clearTimeout(tracker.timeout);
    }
    this.logHealthTrackers.clear();
  }

  getOverallExitCode(): number {
    const failed = Array.from(this.states.values()).some(
      (state) => state.status === "failed",
    );

    return failed ? 1 : 0;
  }

  private getOrCreateReadyDeferred(serviceName: string): Deferred<void> {
    const existing = this.readyDeferreds.get(serviceName);
    if (existing) {
      return existing;
    }

    const deferred = createDeferred<void>();
    deferred.promise.catch(() => undefined);
    this.readyDeferreds.set(serviceName, deferred);
    return deferred;
  }

  private async startServiceWithDependencies(
    serviceName: string,
    trail: Set<string>,
  ): Promise<void> {
    const existing = this.startPromises.get(serviceName);
    if (existing) {
      await existing;
      return;
    }

    const service = this.serviceConfigs.get(serviceName);
    if (!service) {
      throw new Error(`Unknown service \"${serviceName}\".`);
    }

    if (trail.has(serviceName)) {
      throw new Error(
        `Circular startAfter dependency detected at service \"${serviceName}\".`,
      );
    }

    const nextTrail = new Set(trail);
    nextTrail.add(serviceName);

    const startPromise = (async () => {
      for (const dependency of service.startAfter ?? []) {
        await this.startServiceWithDependencies(dependency, nextTrail);
        await this.getOrCreateReadyDeferred(dependency).promise;
      }

      if (this.shuttingDown) {
        return;
      }

      this.startOne(service);
    })();

    this.startPromises.set(serviceName, startPromise);
    await startPromise;
  }

  private startOne(service: ServiceConfig): void {
    const state: ServiceState = {
      name: service.name,
      color: getServiceColor(service.color),
      status: "starting",
      ready: false,
      pid: undefined,
      exitCode: null,
      signal: null,
    };

    this.states.set(service.name, state);
    this.emit("serviceState", { ...state });

    const spawnOptions = {
      cwd: service.cwd ?? process.cwd(),
      env: { ...process.env, ...service.env },
      detached: process.platform !== "win32",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"] as ("ignore" | "pipe")[],
    };

    const usingArgs = Boolean(service.args && service.args.length > 0);
    const shouldUseShell = shouldUseShellForCommand(service.command, usingArgs);
    const child = spawn(service.command, service.args ?? [], {
      ...spawnOptions,
      shell: shouldUseShell,
    });

    if (!child.stdout || !child.stderr) {
      throw new Error(
        `Failed to attach stdio streams for service \"${service.name}\".`,
      );
    }

    state.pid = child.pid;
    state.status = "running";
    state.ready = false;
    this.states.set(service.name, state);

    this.children.set(service.name, { child, state });
    this.emit("serviceState", { ...state });

    const readiness = this.getOrCreateReadyDeferred(service.name);
    const markReady = () => {
      if (state.ready) {
        return;
      }
      state.ready = true;
      this.states.set(service.name, state);
      this.emit("serviceState", { ...state });
      readiness.resolve();
    };

    const markFailed = (reason: string) => {
      if (readiness.settled()) {
        return;
      }

      state.status = "failed";
      state.ready = false;
      this.states.set(service.name, state);
      this.emit("serviceState", { ...state });
      this.emitSystemLog(service.name, state.color, reason);
      readiness.reject(new Error(reason));
      void this.killTree(child.pid, "SIGTERM");
    };

    this.setupHealthCheck(service, child, markReady, markFailed);

    const emitLog = (source: LogEntry["source"], line: string): void => {
      const entry: LogEntry = {
        id: ++this.lineId,
        serviceName: service.name,
        serviceColor: state.color,
        source,
        line,
        timestamp: Date.now(),
      };
      this.emit("log", entry);

      const tracker = this.logHealthTrackers.get(service.name);
      if (tracker && tracker.matcher.test(line)) {
        clearTimeout(tracker.timeout);
        this.logHealthTrackers.delete(service.name);
        tracker.markReady();
      }
    };

    const stdoutParser = createChunkLineParser((line) =>
      emitLog("stdout", line),
    );
    const stderrParser = createChunkLineParser((line) =>
      emitLog("stderr", line),
    );

    child.stdout.on("data", (chunk: Buffer | string) =>
      stdoutParser.push(chunk),
    );
    child.stderr.on("data", (chunk: Buffer | string) =>
      stderrParser.push(chunk),
    );

    child.stdout.on("end", () => stdoutParser.flush());
    child.stderr.on("end", () => stderrParser.flush());

    child.on("error", (error: Error) => {
      emitLog("system", `Process error: ${error.message}`);
      if (!readiness.settled()) {
        readiness.reject(error);
      }
    });

    child.on(
      "exit",
      (exitCode: number | null, signal: NodeJS.Signals | null) => {
        stdoutParser.flush();
        stderrParser.flush();

        const tracker = this.logHealthTrackers.get(service.name);
        if (tracker) {
          clearTimeout(tracker.timeout);
          this.logHealthTrackers.delete(service.name);
        }

        state.exitCode = exitCode;
        state.signal = signal;

        if (this.shuttingDown) {
          state.status = "stopped";
        } else if ((exitCode ?? 0) === 0) {
          state.status = "exited";
        } else {
          state.status = "failed";
        }

        if (!state.ready && !readiness.settled()) {
          readiness.reject(
            new Error(
              `Service \"${service.name}\" exited before becoming ready.`,
            ),
          );
        }

        this.states.set(service.name, state);
        this.emit("serviceState", { ...state });

        if (!this.hasRunningChildren() && this.restartingServices.size === 0) {
          this.emit("idle");
        }
      },
    );
  }

  private setupHealthCheck(
    service: ServiceConfig,
    child: ChildProcess,
    markReady: () => void,
    markFailed: (reason: string) => void,
  ): void {
    if (!service.healthCheck) {
      markReady();
      return;
    }

    if (service.healthCheck.type === "log") {
      this.setupLogHealthCheck(
        service.name,
        service.healthCheck,
        markReady,
        markFailed,
      );
      return;
    }

    void this.runHttpHealthCheck(
      service,
      child,
      service.healthCheck,
      markReady,
      markFailed,
    );
  }

  private setupLogHealthCheck(
    serviceName: string,
    healthCheck: Extract<HealthCheckConfig, { type: "log" }>,
    markReady: () => void,
    markFailed: (reason: string) => void,
  ): void {
    let matcher: RegExp;

    try {
      matcher = new RegExp(healthCheck.pattern);
    } catch {
      markFailed(
        `Invalid healthCheck.pattern for service \"${serviceName}\": ${healthCheck.pattern}`,
      );
      return;
    }

    const timeoutMs = healthCheck.timeoutMs ?? 15000;
    const timeout = setTimeout(() => {
      this.logHealthTrackers.delete(serviceName);
      markFailed(
        `Health check timed out for service \"${serviceName}\" while waiting for log pattern ${healthCheck.pattern}.`,
      );
    }, timeoutMs);

    this.logHealthTrackers.set(serviceName, {
      matcher,
      timeout,
      markReady,
      markFailed,
    });
  }

  private async runHttpHealthCheck(
    service: ServiceConfig,
    child: ChildProcess,
    healthCheck: Extract<HealthCheckConfig, { type: "http" }>,
    markReady: () => void,
    markFailed: (reason: string) => void,
  ): Promise<void> {
    const timeoutMs = healthCheck.timeoutMs ?? 15000;
    const intervalMs = healthCheck.intervalMs ?? 500;
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      if (this.shuttingDown) {
        return;
      }

      if (child.exitCode !== null || child.signalCode !== null) {
        return;
      }

      try {
        const response = await fetch(healthCheck.url);
        if (response.ok) {
          markReady();
          return;
        }
      } catch {
        // Keep polling until timeout.
      }

      await delay(intervalMs);
    }

    markFailed(
      `Health check timed out for service \"${service.name}\" at ${healthCheck.url}.`,
    );
  }

  private emitSystemLog(
    serviceName: string,
    serviceColor: LogEntry["serviceColor"],
    line: string,
  ): void {
    this.emit("log", {
      id: ++this.lineId,
      serviceName,
      serviceColor,
      source: "system",
      line,
      timestamp: Date.now(),
    });
  }

  private async killTree(
    pid: number | undefined,
    signal: NodeJS.Signals,
  ): Promise<void> {
    if (!pid) {
      return;
    }

    await new Promise<void>((resolve) => {
      kill(pid, signal, () => {
        resolve();
      });
    });
  }

  private async waitForExit(child: ChildProcess): Promise<void> {
    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }

    await new Promise<void>((resolve) => {
      child.once("exit", () => resolve());
    });
  }
}

function createDeferred<T>(): Deferred<T> {
  let isSettled = false;

  let resolveInternal!: (value: T) => void;
  let rejectInternal!: (error: unknown) => void;

  const promise = new Promise<T>((resolve, reject) => {
    resolveInternal = (value) => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      resolve(value);
    };

    rejectInternal = (error) => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      reject(error);
    };
  });

  return {
    promise,
    resolve: resolveInternal,
    reject: rejectInternal,
    settled: () => isSettled,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shouldUseShellForCommand(
  command: string,
  usingArgs: boolean,
): boolean {
  if (!usingArgs) {
    // A single command string (no args array) relies on shell parsing.
    return true;
  }

  if (process.platform !== "win32") {
    return false;
  }

  const commandExt = path.extname(command).toLowerCase();
  if (commandExt === ".cmd" || commandExt === ".bat") {
    return true;
  }

  const base = path.basename(command, commandExt).toLowerCase();
  return WINDOWS_COMMAND_SHIMS.has(base);
}

const WINDOWS_COMMAND_SHIMS = new Set([
  "npm",
  "npx",
  "pnpm",
  "yarn",
  "yarnpkg",
  "corepack",
]);
