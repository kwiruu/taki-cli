import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { TakiConfig } from "../types/index.js";

const healthCheckSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("http"),
    url: z.string().url("healthCheck.url must be a valid URL."),
    intervalMs: z.number().int().positive().max(60000).optional(),
    timeoutMs: z.number().int().positive().max(300000).optional(),
  }),
  z.object({
    type: z.literal("log"),
    pattern: z
      .string()
      .min(1, "healthCheck.pattern is required for log checks."),
    timeoutMs: z.number().int().positive().max(300000).optional(),
  }),
]);

const serviceSchema = z.object({
  name: z.string().min(1, "Service name is required."),
  command: z.string().min(1, "Service command is required."),
  args: z.array(z.string()).optional(),
  color: z
    .enum([
      "red",
      "green",
      "yellow",
      "blue",
      "magenta",
      "cyan",
      "white",
      "gray",
    ])
    .optional(),
  cwd: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
  startAfter: z.array(z.string().min(1)).optional(),
  healthCheck: healthCheckSchema.optional(),
});

const configSchema = z.object({
  services: z
    .array(serviceSchema)
    .min(1, "Add at least one service in taki.json."),
  maxLogLines: z.number().int().positive().max(5000).optional(),
});

export async function loadConfig(configPath: string): Promise<TakiConfig> {
  const absolutePath = path.resolve(configPath);
  let rawText: string;

  try {
    rawText = await fs.readFile(absolutePath, "utf8");
  } catch (error) {
    throw new Error(
      `Unable to read config at ${absolutePath}. Create a taki.json file and try again.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    throw new Error(
      `Invalid JSON in ${absolutePath}. Check for trailing commas or malformed quotes.`,
    );
  }

  const result = configSchema.safeParse(parsed);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `- ${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("\n");

    throw new Error(`Invalid taki.json:\n${details}`);
  }

  const duplicateNames = findDuplicateNames(
    result.data.services.map((service) => service.name),
  );
  if (duplicateNames.length > 0) {
    throw new Error(
      `Invalid taki.json:\n- services: Duplicate service names found: ${duplicateNames.join(", ")}`,
    );
  }

  const knownNames = new Set(
    result.data.services.map((service) => service.name),
  );
  for (const service of result.data.services) {
    for (const dependency of service.startAfter ?? []) {
      if (!knownNames.has(dependency)) {
        throw new Error(
          `Invalid taki.json:\n- services.${service.name}.startAfter: Unknown dependency \"${dependency}\".`,
        );
      }

      if (dependency === service.name) {
        throw new Error(
          `Invalid taki.json:\n- services.${service.name}.startAfter: Service cannot depend on itself.`,
        );
      }
    }
  }

  return result.data;
}

function findDuplicateNames(names: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const name of names) {
    if (seen.has(name)) {
      duplicates.add(name);
      continue;
    }
    seen.add(name);
  }

  return Array.from(duplicates.values());
}
