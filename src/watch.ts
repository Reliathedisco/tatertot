import { execSync } from "node:child_process";
import { platform } from "node:os";
import { checkServices, ServiceResult } from "./checks/services.js";
import { checkEnv, EnvResult } from "./checks/env.js";
import { checkLocal, LocalResult } from "./checks/local.js";
import { diagnose } from "./diagnose.js";
import * as fmt from "./format.js";
import { Status } from "./format.js";

interface WatchState {
  services: Map<string, Status>;
  envStatus: Status;
  localStatus: Status;
}

function notify(title: string, message: string): void {
  if (platform() !== "darwin") return;
  try {
    const escaped = message.replace(/"/g, '\\"');
    const titleEsc = title.replace(/"/g, '\\"');
    execSync(
      `osascript -e 'display notification "${escaped}" with title "${titleEsc}"'`,
      { stdio: "ignore" },
    );
  } catch {
    // notification failed silently
  }
}

function detectChanges(
  prev: WatchState,
  services: ServiceResult[],
  env: EnvResult,
  local: LocalResult,
): string[] {
  const changes: string[] = [];

  for (const svc of services) {
    const prevStatus = prev.services.get(svc.name);
    if (prevStatus && prevStatus !== svc.status) {
      if (svc.status === "degraded" || svc.status === "down") {
        changes.push(`${svc.name}: ${prevStatus} → ${svc.status}`);
      } else if (prevStatus === "degraded" || prevStatus === "down") {
        changes.push(`${svc.name}: recovered`);
      }
    }
  }

  if (prev.envStatus !== env.status && env.status !== "ok") {
    changes.push(`env: ${prev.envStatus} → ${env.status}`);
  }

  if (prev.localStatus !== local.status) {
    if (local.status === "down") changes.push("server went down");
    else if (prev.localStatus === "down") changes.push("server back up");
  }

  return changes;
}

function buildState(services: ServiceResult[], env: EnvResult, local: LocalResult): WatchState {
  const svcMap = new Map<string, Status>();
  for (const s of services) svcMap.set(s.name, s.status);
  return { services: svcMap, envStatus: env.status, localStatus: local.status };
}

export async function startWatch(intervalMs: number): Promise<void> {
  console.log(fmt.heading("tate watch"));
  console.log(fmt.dim(`  checking every ${Math.round(intervalMs / 1000)}s • ctrl+c to stop\n`));

  let prevState: WatchState | null = null;
  let checkCount = 0;

  const tick = async () => {
    checkCount++;
    const timestamp = new Date().toLocaleTimeString();

    const [services, env, local] = await Promise.all([
      checkServices(),
      checkEnv(),
      checkLocal(),
    ]);

    const d = diagnose(services, env, local);
    const currentState = buildState(services, env, local);

    if (prevState) {
      const changes = detectChanges(prevState, services, env, local);

      if (changes.length > 0) {
        console.log(`\n${fmt.dim(`  [${timestamp}]`)} ${fmt.bold("change detected:")}`);
        for (const change of changes) {
          console.log(fmt.arrow(change));
        }
        console.log(fmt.watchVerdict(d.headline, d.cause, d.directive));

        if (d.severity !== "ok") {
          notify("⚠ tate", `${d.headline} — ${d.directive}`);
        } else {
          notify("✓ tate", "all clear — systems recovered");
        }
      } else {
        process.stdout.write(fmt.dim(`\r  [${timestamp}] #${checkCount} — no changes`));
      }
    } else {
      console.log(fmt.dim(`  [${timestamp}] initial scan\n`));
      for (const svc of services) {
        console.log(fmt.svcLine(svc.status, svc.name, svc.latencyMs, svc.detail));
      }
      console.log(fmt.line(env.status, "env", env.fileExists ? `${env.present.length} keys` : "no .env"));
      console.log(fmt.line(local.status, "server", local.detail));
      console.log();
      console.log(fmt.watchVerdict(d.headline, d.cause, d.directive));

      if (d.severity !== "ok") {
        notify("tate watch", `${d.headline} — ${d.directive}`);
      }
    }

    prevState = currentState;
  };

  await tick();
  setInterval(tick, intervalMs);
}
