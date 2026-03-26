import { Status } from "../format.js";

export interface LocalResult {
  port: number | null;
  serverRunning: boolean;
  healthEndpoint: Status;
  status: Status;
  detail?: string;
}

const COMMON_PORTS = [3000, 3001, 4000, 5173, 5000, 8000, 8080];

async function tryPort(port: number): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    await fetch(`http://localhost:${port}`, { signal: controller.signal });
    return true;
  } catch (e: any) {
    if (e.name !== "AbortError" && e.cause?.code === "ECONNREFUSED") {
      return false;
    }
    // If we got any response (even error), the server is running
    return e.name !== "AbortError" && e.cause?.code !== "ECONNREFUSED";
  } finally {
    clearTimeout(timeout);
  }
}

async function tryHealth(port: number): Promise<Status> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(`http://localhost:${port}/api/health`, { signal: controller.signal });
    return res.ok ? "ok" : "degraded";
  } catch {
    return "unknown";
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkLocal(): Promise<LocalResult> {
  for (const port of COMMON_PORTS) {
    const running = await tryPort(port);
    if (running) {
      const health = await tryHealth(port);
      return {
        port,
        serverRunning: true,
        healthEndpoint: health,
        status: health === "ok" ? "ok" : health === "degraded" ? "degraded" : "ok",
        detail: `localhost:${port}`,
      };
    }
  }

  return {
    port: null,
    serverRunning: false,
    healthEndpoint: "unknown",
    status: "down",
    detail: `no server on ports ${COMMON_PORTS.join(", ")}`,
  };
}
