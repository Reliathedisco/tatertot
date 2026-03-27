import { ServiceResult } from "./checks/services.js";
import { EnvResult } from "./checks/env.js";
import { LocalResult } from "./checks/local.js";

export interface Diagnosis {
  headline: string;
  cause: string;
  directive: string;
  confidence: number;
  severity: "ok" | "warning" | "critical";
  timeSaved: string;
  blame: "external" | "config" | "local" | "code";
}

export function diagnose(
  services: ServiceResult[] | null,
  env: EnvResult | null,
  local: LocalResult | null,
): Diagnosis {
  const degraded = services?.filter((s) => s.status === "degraded") ?? [];
  const down = services?.filter((s) => s.status === "down") ?? [];
  const okServices = services?.filter((s) => s.status === "ok") ?? [];
  const totalServices = services?.length ?? 0;
  const envBroken = env?.status === "down";
  const envDegraded = env?.status === "degraded";
  const serverDown = local?.status === "down";

  // --- MULTIPLE SERVICES DOWN ---
  if (down.length >= 2) {
    const names = down.map((s) => s.name).join(", ");
    return {
      headline: "this is NOT your code",
      cause: `${names} are down`,
      directive: "do not debug locally — wait for recovery",
      confidence: 97,
      severity: "critical",
      timeSaved: "~1–2 hours",
      blame: "external",
    };
  }

  // --- ONE DOWN + OTHERS DEGRADED ---
  if (down.length >= 1 && degraded.length >= 1) {
    const names = [...down, ...degraded].map((s) => s.name).join(", ");
    return {
      headline: "this is NOT your code",
      cause: `${names} are having issues`,
      directive: "don't touch your code — external services are unstable",
      confidence: 94,
      severity: "critical",
      timeSaved: "~45–90 min",
      blame: "external",
    };
  }

  // --- ONE SERVICE DOWN ---
  if (down.length === 1) {
    const svc = down[0].name;
    return {
      headline: "this is NOT your code",
      cause: `${svc} is down`,
      directive: `wait for ${svc} to recover, or mock its responses`,
      confidence: 91,
      severity: "critical",
      timeSaved: "~30–60 min",
      blame: "external",
    };
  }

  // --- SERVICES DEGRADED ---
  if (degraded.length >= 2) {
    const names = degraded.map((s) => s.name).join(", ");
    return {
      headline: "probably not your code",
      cause: `${names} are degraded`,
      directive: "retry in 10–15 min or mock responses",
      confidence: 85,
      severity: "warning",
      timeSaved: "~30–60 min",
      blame: "external",
    };
  }

  if (degraded.length === 1) {
    const svc = degraded[0].name;
    const detail = degraded[0].detail ? ` (${degraded[0].detail})` : "";
    return {
      headline: "probably not your code",
      cause: `${svc} is degraded${detail}`,
      directive: `if your bug involves ${svc}, wait — otherwise debug normally`,
      confidence: 78,
      severity: "warning",
      timeSaved: "~15–30 min",
      blame: "external",
    };
  }

  // --- NO .ENV FILE ---
  if (envBroken && !env?.fileExists) {
    return {
      headline: "your setup is broken",
      cause: "no .env file found",
      directive: "create .env with your API keys — nothing can authenticate",
      confidence: 99,
      severity: "critical",
      timeSaved: "~5 min",
      blame: "config",
    };
  }

  // --- ENV EXISTS BUT EMPTY/MISCONFIGURED ---
  if (envBroken) {
    return {
      headline: "this is a config problem",
      cause: "no recognized API keys in your .env",
      directive: "add your keys to .env and restart",
      confidence: 95,
      severity: "critical",
      timeSaved: "~10 min",
      blame: "config",
    };
  }

  // --- SOME ENV VARS EMPTY ---
  if (envDegraded) {
    const empties = env!.empty.slice(0, 3).join(", ");
    const more = env!.empty.length > 3 ? ` +${env!.empty.length - 3} more` : "";
    return {
      headline: "check your config",
      cause: `empty env vars: ${empties}${more}`,
      directive: "fill in the empty values in .env and restart",
      confidence: 88,
      severity: "warning",
      timeSaved: "~10 min",
      blame: "config",
    };
  }

  // --- SERVER NOT RUNNING ---
  if (serverDown) {
    return {
      headline: "your app isn't running",
      cause: "no local server detected",
      directive: "start your dev server (npm run dev)",
      confidence: 96,
      severity: "warning",
      timeSaved: "~5 min",
      blame: "local",
    };
  }

  // --- ALL CLEAR ---
  const conf = totalServices > 0 ? Math.min(60 + okServices.length * 5, 80) : 60;
  return {
    headline: "it's probably your code",
    cause: "everything external looks healthy",
    directive: "debug with confidence — the problem is local",
    confidence: conf,
    severity: "ok",
    timeSaved: "~5 min",
    blame: "code",
  };
}
