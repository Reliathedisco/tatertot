#!/usr/bin/env node

import { parseArgs, printHelp } from "./args.js";
import { checkServices } from "./checks/services.js";
import { checkEnv } from "./checks/env.js";
import { checkLocal } from "./checks/local.js";
import { diagnose, Diagnosis } from "./diagnose.js";
import { startWatch } from "./watch.js";
import { activate, isActivated } from "./license.js";
import * as fmt from "./format.js";

const VERSION = "1.0.1";

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
      console.log(`  ${fmt.arrow("get yours at " + fmt.bold("https://tatertot-fvjgtoqwd-reliathediscos-projects.vercel.app/#pricing"))}`);
      console.log(`  ${fmt.arrow("then run: " + fmt.bold("npx tate-dev --activate YOUR_KEY"))}\n`);
      process.exit(1);
    }
    await startWatch(args.watchInterval);
    return;
  }

  console.log(fmt.brain());

  const runServices = args.all || args.services;
  const runEnv = args.all || args.env;
  const runLocal = args.all || args.local;

  const promises: [
    Promise<Awaited<ReturnType<typeof checkServices>> | null>,
    Promise<Awaited<ReturnType<typeof checkEnv>> | null>,
    Promise<Awaited<ReturnType<typeof checkLocal>> | null>,
  ] = [
    runServices ? checkServices() : Promise.resolve(null),
    runEnv ? checkEnv() : Promise.resolve(null),
    runLocal ? checkLocal() : Promise.resolve(null),
  ];

  const [services, env, local] = await Promise.all(promises);

  // --- ENV ---
  if (env) {
    if (!env.fileExists) {
      console.log(fmt.line("down", "env variables", "no .env file found"));
    } else if (env.empty.length > 0) {
      console.log(fmt.line("degraded", "env variables loaded", `${env.empty.length} empty`));
    } else if (env.present.length > 0) {
      console.log(fmt.line("ok", "env variables loaded", `${env.present.length} keys found`));
    } else {
      console.log(fmt.line("degraded", "env variables", "no common keys detected"));
    }
  }

  // --- LOCAL ---
  if (local) {
    if (local.serverRunning) {
      const healthNote = local.healthEndpoint === "ok" ? "health endpoint ok" : "";
      console.log(fmt.line("ok", `local server responding`, `${local.detail}${healthNote ? " • " + healthNote : ""}`));
    } else {
      console.log(fmt.line("down", "local server not running", local.detail));
    }
  }

  // --- SERVICES ---
  if (services) {
    for (const svc of services) {
      const latency = svc.latencyMs ? `${svc.latencyMs}ms` : "";
      const detail = [svc.detail, latency].filter(Boolean).join(" • ");
      console.log(fmt.line(svc.status, svc.name, detail));
    }
  }

  // --- DIAGNOSIS ---
  const diagnosis = diagnose(services, env, local);
  console.log(fmt.separator());
  printDiagnosis(diagnosis);
}

function printDiagnosis(d: Diagnosis): void {
  const causePrefix = d.severity === "ok" ? fmt.ok("likely cause") : fmt.warn("likely cause");
  console.log(`${fmt.arrow(`${causePrefix}: ${d.cause}`)}`);
  console.log(`${fmt.arrow(`suggestion: ${d.suggestion}`)}`);
  console.log();
}

run().catch((err) => {
  console.error(fmt.err(`\n  fatal: ${err.message}`));
  process.exit(1);
});
