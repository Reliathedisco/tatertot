import { ServiceResult } from "./checks/services.js";
import { EnvResult } from "./checks/env.js";
import { LocalResult } from "./checks/local.js";

export interface Diagnosis {
  cause: string;
  suggestion: string;
  severity: "ok" | "warning" | "critical";
}

export function diagnose(
  services: ServiceResult[] | null,
  env: EnvResult | null,
  local: LocalResult | null,
): Diagnosis {
  const degradedServices = services?.filter((s) => s.status === "degraded") ?? [];
  const downServices = services?.filter((s) => s.status === "down") ?? [];
  const envBroken = env?.status === "down";
  const envDegraded = env?.status === "degraded";
  const serverDown = local?.status === "down";

  // Multiple services down
  if (downServices.length >= 2) {
    return {
      cause: "multiple external services are down",
      suggestion: "don't debug locally — this is not your code",
      severity: "critical",
    };
  }

  // One service down + others degraded
  if (downServices.length >= 1 && degradedServices.length >= 1) {
    const names = [...downServices, ...degradedServices].map((s) => s.name).join(", ");
    return {
      cause: `external service instability (${names})`,
      suggestion: "avoid debugging locally, wait for services to recover",
      severity: "critical",
    };
  }

  // One service down
  if (downServices.length === 1) {
    return {
      cause: `${downServices[0].name} is down`,
      suggestion: `check ${downServices[0].name} status page — your code is probably fine`,
      severity: "warning",
    };
  }

  // Services degraded
  if (degradedServices.length > 0) {
    const names = degradedServices.map((s) => s.name).join(", ");
    return {
      cause: `external service instability (${names})`,
      suggestion: "if your issue involves these services, retry later",
      severity: "warning",
    };
  }

  // No env file at all
  if (envBroken && !env?.fileExists) {
    return {
      cause: "no .env file found",
      suggestion: "create a .env file with your API keys — nothing will work without it",
      severity: "critical",
    };
  }

  // Env file exists but no known keys
  if (envBroken) {
    return {
      cause: "environment variables not configured",
      suggestion: "add your API keys to .env — your services can't authenticate",
      severity: "critical",
    };
  }

  // Empty env vars
  if (envDegraded) {
    const empties = env!.empty.join(", ");
    return {
      cause: `some env variables are empty (${empties})`,
      suggestion: "fill in the empty values in your .env file",
      severity: "warning",
    };
  }

  // Server not running
  if (serverDown) {
    return {
      cause: "app not running locally",
      suggestion: "start your dev server first (npm run dev, etc.)",
      severity: "warning",
    };
  }

  // All good
  return {
    cause: "everything looks healthy",
    suggestion: "the issue is likely in your code — happy debugging!",
    severity: "ok",
  };
}
