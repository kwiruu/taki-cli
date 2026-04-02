import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const childScript = path.join(here, "tree-child.js");

const parentPidFile = process.env.TAKI_PARENT_PID_FILE;
const childPidFile = process.env.TAKI_CHILD_PID_FILE;

if (parentPidFile) {
  writeFileSync(parentPidFile, String(process.pid));
}

const child = spawn(process.execPath, [childScript], {
  stdio: "ignore",
});

if (childPidFile && child.pid) {
  writeFileSync(childPidFile, String(child.pid));
}

console.log("PARENT_READY");

const ticker = setInterval(() => {
  console.log("parent heartbeat");
}, 300);

const shutdown = () => {
  if (child.pid) {
    child.kill("SIGTERM");
  }
  clearInterval(ticker);
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
