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
        changes.push(`${svc.name} changed: ${prevStatus} → ${svc.status}`);
      } else if (prevStatus === "degraded" || prevStatus === "down") {
        changes.push(`${svc.name} recovered: ${prevStatus} → ${svc.status}`);
      }
    }
  }

  if (prev.envStatus !== env.status && env.status !== "ok") {
    changes.push(`env changed: ${prev.envStatus} → ${env.status}`);
  }

  if (prev.localStatus !== local.status) {
    if (local.status === "down") {
      changes.push("local server went down");
    } else if (prev.localStatus === "down") {
      changes.push("local server came back up");
    }
  }

  return changes;
}

function buildState(services: ServiceResult[], env: EnvResult, local: LocalResult): WatchState {
  const svcMap = new Map<string, Status>();
  for (const s of services) svcMap.set(s.name, s.status);
  return { services: svcMap, envStatus: env.status, localStatus: local.status };
}

export async function startWatch(intervalMs: number): Promise<void> {
  console.log(fmt.heading("tate watch — monitoring your stack"));
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

    const diagnosis = diagnose(services, env, local);
    const currentState = buildState(services, env, local);

    if (prevState) {
      const changes = detectChanges(prevState, services, env, local);

      if (changes.length > 0) {
        console.log(`\n${fmt.dim(`[${timestamp}]`)} ${fmt.bold("status changed:")}`);
        for (const change of changes) {
          console.log(`  ${fmt.arrow(change)}`);
        }

        if (diagnosis.severity !== "ok") {
          console.log(`  ${fmt.arrow(diagnosis.cause)}`);
          notify(
            "⚠ tate watch",
            `don't debug right now — ${diagnosis.cause}`,
          );
        } else {
          notify("✓ tate watch", "all clear — systems recovered");
        }
      } else {
        process.stdout.write(fmt.dim(`\r  [${timestamp}] check #${checkCount} — no changes`));
      }
    } else {
      // First run: show full report
      console.log(fmt.dim(`  [${timestamp}] initial check\n`));
      for (const svc of services) {
        console.log(fmt.line(svc.status, svc.name, svc.detail));
      }
      console.log(fmt.line(env.status, "env variables", env.fileExists ? `${env.present.length} found` : "no .env file"));
      console.log(fmt.line(local.status, "local server", local.detail));
      console.log();

      if (diagnosis.severity !== "ok") {
        console.log(`  ${fmt.arrow(diagnosis.cause)}`);
        notify("tate watch started", diagnosis.cause);
      } else {
        console.log(`  ${fmt.arrow(fmt.ok("all systems healthy — watching for changes"))}`);
      }
    }

    prevState = currentState;
  };

  await tick();
  setInterval(tick, intervalMs);
}
