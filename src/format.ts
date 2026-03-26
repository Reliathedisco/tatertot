const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const MAGENTA = "\x1b[35m";
const WHITE = "\x1b[37m";

export type Status = "ok" | "degraded" | "down" | "unknown";

export function symbol(status: Status): string {
  switch (status) {
    case "ok":
      return `${GREEN}✓${RESET}`;
    case "degraded":
      return `${YELLOW}⚠${RESET}`;
    case "down":
      return `${RED}✗${RESET}`;
    case "unknown":
      return `${DIM}?${RESET}`;
  }
}

export function statusText(status: Status): string {
  switch (status) {
    case "ok":
      return `${GREEN}all good${RESET}`;
    case "degraded":
      return `${YELLOW}degraded${RESET}`;
    case "down":
      return `${RED}down${RESET}`;
    case "unknown":
      return `${DIM}unknown${RESET}`;
  }
}

export function heading(text: string): string {
  return `\n${BOLD}${CYAN}${text}${RESET}\n`;
}

export function line(status: Status, label: string, detail?: string): string {
  const det = detail ? `  ${DIM}${detail}${RESET}` : "";
  return `  ${symbol(status)} ${label}${det}`;
}

export function arrow(text: string): string {
  return `${MAGENTA}→${RESET} ${text}`;
}

export function bold(text: string): string {
  return `${BOLD}${text}${RESET}`;
}

export function dim(text: string): string {
  return `${DIM}${text}${RESET}`;
}

export function warn(text: string): string {
  return `${YELLOW}${text}${RESET}`;
}

export function err(text: string): string {
  return `${RED}${text}${RESET}`;
}

export function ok(text: string): string {
  return `${GREEN}${text}${RESET}`;
}

export function brain(): string {
  return `${BOLD}${MAGENTA}🧠 diagnosing your app...${RESET}\n`;
}

export function separator(): string {
  return `\n${DIM}${"─".repeat(42)}${RESET}\n`;
}
