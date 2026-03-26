import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const CONFIG_PATH = join(homedir(), ".tate.json");

interface TateConfig {
  key?: string;
  activatedAt?: string;
}

async function readConfig(): Promise<TateConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeConfig(config: TateConfig): Promise<void> {
  await mkdir(dirname(CONFIG_PATH), { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}

export async function activate(key: string): Promise<boolean> {
  const config = await readConfig();
  config.key = key;
  config.activatedAt = new Date().toISOString();
  await writeConfig(config);
  return true;
}

export async function isActivated(): Promise<boolean> {
  const config = await readConfig();
  return !!config.key;
}

export async function getKey(): Promise<string | null> {
  const config = await readConfig();
  return config.key ?? null;
}

export async function verify(key: string): Promise<{ valid: boolean; status?: string }> {
  const VERIFY_URL = "https://tatertot-ochre.vercel.app/api/verify";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
      signal: controller.signal,
    });
    return await res.json();
  } catch {
    // If verification server is unreachable, allow offline use
    return { valid: true, status: "offline-grace" };
  } finally {
    clearTimeout(timeout);
  }
}
