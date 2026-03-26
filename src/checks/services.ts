import { Status } from "../format.js";

export interface ServiceResult {
  name: string;
  status: Status;
  detail?: string;
  latencyMs?: number;
}

interface ServiceDef {
  name: string;
  url: string;
  parse: (body: string, status: number, latencyMs: number) => ServiceResult;
}

function quickParse(name: string, body: string, httpStatus: number, latencyMs: number): ServiceResult {
  if (httpStatus >= 500) return { name, status: "down", detail: "status page returned 5xx", latencyMs };
  if (httpStatus >= 400) return { name, status: "unknown", detail: "status page unreachable", latencyMs };

  const lower = body.toLowerCase();

  if (lower.includes('"none"') || lower.includes("all systems operational") || lower.includes('"indicator":"none"')) {
    return { name, status: "ok", latencyMs };
  }
  if (lower.includes('"critical"') || lower.includes('"major"') || lower.includes("major outage")) {
    return { name, status: "down", detail: "major incident", latencyMs };
  }
  if (lower.includes('"minor"') || lower.includes("degraded") || lower.includes("partial")) {
    return { name, status: "degraded", detail: "partial issues", latencyMs };
  }

  if (latencyMs > 3000) {
    return { name, status: "degraded", detail: `high latency (${latencyMs}ms)`, latencyMs };
  }

  return { name, status: "ok", latencyMs };
}

const SERVICES: ServiceDef[] = [
  {
    name: "stripe",
    url: "https://status.stripe.com",
    parse: (_body, httpStatus, ms) => {
      if (httpStatus >= 500) return { name: "stripe", status: "down", detail: "status page 5xx", latencyMs: ms };
      if (httpStatus >= 400) return { name: "stripe", status: "degraded", detail: "status page error", latencyMs: ms };
      if (ms > 3000) return { name: "stripe", status: "degraded", detail: `high latency (${ms}ms)`, latencyMs: ms };
      return { name: "stripe", status: "ok", latencyMs: ms };
    },
  },
  {
    name: "openai",
    url: "https://status.openai.com/api/v2/status.json",
    parse: (body, status, ms) => quickParse("openai", body, status, ms),
  },
  {
    name: "github",
    url: "https://www.githubstatus.com/api/v2/status.json",
    parse: (body, status, ms) => quickParse("github", body, status, ms),
  },
  {
    name: "vercel",
    url: "https://www.vercel-status.com/api/v2/status.json",
    parse: (body, status, ms) => quickParse("vercel", body, status, ms),
  },
  {
    name: "supabase",
    url: "https://status.supabase.com/api/v2/status.json",
    parse: (body, status, ms) => quickParse("supabase", body, status, ms),
  },
  {
    name: "resend",
    url: "https://resend-status.com/api/v2/status.json",
    parse: (body, status, ms) => quickParse("resend", body, status, ms),
  },
  {
    name: "clerk",
    url: "https://status.clerk.com/api/v2/status.json",
    parse: (body, status, ms) => quickParse("clerk", body, status, ms),
  },
];

async function checkOne(svc: ServiceDef): Promise<ServiceResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const start = Date.now();

  try {
    const res = await fetch(svc.url, {
      signal: controller.signal,
      headers: { "User-Agent": "tate-cli/1.0" },
    });
    const latency = Date.now() - start;
    const body = await res.text();
    return svc.parse(body, res.status, latency);
  } catch (e: any) {
    const latency = Date.now() - start;
    if (e.name === "AbortError") {
      return { name: svc.name, status: "degraded", detail: "timeout (>5s)", latencyMs: latency };
    }
    return { name: svc.name, status: "unknown", detail: "unreachable", latencyMs: latency };
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkServices(): Promise<ServiceResult[]> {
  return Promise.all(SERVICES.map(checkOne));
}
