export function installSignalHandlers(
  onShutdown: (signal: NodeJS.Signals) => Promise<void>,
): () => void {
  let running = false;

  const handler = (signal: NodeJS.Signals): void => {
    if (running) {
      return;
    }

    running = true;
    void onShutdown(signal);
  };

  process.on("SIGINT", handler);
  process.on("SIGTERM", handler);

  return () => {
    process.off("SIGINT", handler);
    process.off("SIGTERM", handler);
  };
}
