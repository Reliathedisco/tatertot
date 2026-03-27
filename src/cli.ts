#!/usr/bin/env node

import { parseArgs, printHelp } from "./args.js";
import { checkServices } from "./checks/services.js";
import { checkEnv } from "./checks/env.js";
import { checkLocal } from "./checks/local.js";
import { diagnose } from "./diagnose.js";
import { startWatch } from "./watch.js";
import { activate, isActivated } from "./license.js";
import * as fmt from "./format.js";

const VERSION = "2.0.0";

async function run(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.version) {
    console.log(`tate v${VERSION}`);
    process.exit(0);
  }

  if (args.activate) {
    console.log(fmt.dim("\n  activating tate watch...\n"));
    try {
      await activate(args.activate);
      console.log(fmt.line("ok", "license key saved", "~/.tate.json"));
      console.log(fmt.line("ok", "tate watch activated"));
      console.log(`\n  ${fmt.arrow("run " + fmt.bold("npx tate-dev --watch") + " to start monitoring")}\n`);
    } catch (err: any) {
      console.log(fmt.line("down", "activation failed", err.message));
    }
    process.exit(0);
  }

  if (args.watch) {
    const activated = await isActivated();
    if (!activated) {
      console.log(fmt.heading("tate watch — not activated"));
      console.log(`  ${fmt.warn("watch mode requires a tate watch license")}\n`);
      console.log(`${fmt.arrow("get yours at " + fmt.bold("https://tatertot-ochre.vercel.app/#pricing"))}`);
      console.log(`${fmt.arrow("then run: " + fmt.bold("npx tate-dev --activate YOUR_KEY"))}\n`);
      process.exit(1);
    }
    await startWatch(args.watchInterval);
    return;
  }

  const start = Date.now();
  console.log(fmt.brain());

  const runServices = args.all || args.services;
  const runEnv = args.all || args.env;
  const runLocal = args.all || args.local;

  const [services, env, local] = await Promise.all([
    runServices ? checkServices() : Promise.resolve(null),
    runEnv ? checkEnv() : Promise.resolve(null),
    runLocal ? checkLocal() : Promise.resolve(null),
  ]);

  const elapsed = Date.now() - start;

  // --- LOCAL SETUP GROUP ---
  if (env || local) {
    console.log(fmt.groupLabel("local"));

    if (env) {
      if (!env.fileExists) {
        console.log(fmt.line("down", "env", "no .env file found"));
      } else if (env.empty.length > 0) {
        console.log(fmt.line("degraded", "env", `${env.present.length} loaded, ${env.empty.length} empty`));
      } else if (env.present.length > 0) {
        console.log(fmt.line("ok", "env", `${env.present.length} keys loaded`));
      } else {
        console.log(fmt.line("degraded", "env", "no recognized keys"));
      }
    }

    if (local) {
      if (local.serverRunning) {
        const health = local.healthEndpoint === "ok" ? " • /api/health ok" : "";
        console.log(fmt.line("ok", "server", `${local.detail}${health}`));
      } else {
        console.log(fmt.line("down", "server", "not running"));
      }
    }
  }

  // --- SERVICES GROUP ---
  if (services) {
    console.log(fmt.groupLabel("services"));
    for (const svc of services) {
      console.log(fmt.svcLine(svc.status, svc.name, svc.latencyMs, svc.detail));
    }
  }

  // --- VERDICT ---
  const d = diagnose(services, env, local);

  console.log(fmt.verdictBlock(
    d.headline,
    d.cause,
    d.directive,
    d.confidence,
    d.severity,
    d.timeSaved,
  ));

  console.log(`\n  ${fmt.dim(`scanned in ${elapsed}ms`)}\n`);
}

run().catch((err) => {
  console.error(fmt.err(`\n  fatal: ${err.message}`));
  process.exit(1);
});
