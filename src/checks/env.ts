import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import { Status } from "../format.js";

export interface EnvResult {
  fileExists: boolean;
  status: Status;
  present: string[];
  missing: string[];
  empty: string[];
}

const COMMON_KEYS = [
  "OPENAI_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_PUBLISHABLE_KEY",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "RESEND_API_KEY",
  "GITHUB_TOKEN",
  "VERCEL_TOKEN",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

export async function checkEnv(): Promise<EnvResult> {
  const envPaths = [".env", ".env.local", ".env.development", ".env.development.local"];
  let combined = new Map<string, string>();
  let anyFileExists = false;

  for (const p of envPaths) {
    const full = resolve(process.cwd(), p);
    try {
      await access(full);
      anyFileExists = true;
      const content = await readFile(full, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        combined.set(key, val);
      }
    } catch {
      // file doesn't exist, skip
    }
  }

  if (!anyFileExists) {
    return {
      fileExists: false,
      status: "down",
      present: [],
      missing: COMMON_KEYS,
      empty: [],
    };
  }

  const present: string[] = [];
  const missing: string[] = [];
  const empty: string[] = [];

  for (const key of COMMON_KEYS) {
    if (!combined.has(key)) {
      missing.push(key);
    } else if (!combined.get(key)) {
      empty.push(key);
    } else {
      present.push(key);
    }
  }

  // Only flag as issue if zero known keys found
  const status: Status =
    present.length === 0 && empty.length === 0
      ? "down"
      : empty.length > 0
        ? "degraded"
        : "ok";

  return { fileExists: true, status, present, missing, empty };
}
