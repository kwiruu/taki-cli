setInterval(() => {
  // Keep process alive to validate process-tree cleanup.
}, 250);

const shutdown = () => {
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
