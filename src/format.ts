const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const ITALIC = "\x1b[3m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const MAGENTA = "\x1b[35m";
const WHITE = "\x1b[97m";
const BG_RED = "\x1b[41m";
const BG_YELLOW = "\x1b[43m";
const BG_GREEN = "\x1b[42m";
const BLACK = "\x1b[30m";

export type Status = "ok" | "degraded" | "down" | "unknown";

export function symbol(status: Status): string {
  switch (status) {
    case "ok":      return `${GREEN}✓${RESET}`;
    case "degraded": return `${YELLOW}⚠${RESET}`;
    case "down":    return `${RED}✗${RESET}`;
    case "unknown": return `${DIM}?${RESET}`;
  }
}

export function line(status: Status, label: string, detail?: string): string {
  const det = detail ? `  ${DIM}${detail}${RESET}` : "";
  return `  ${symbol(status)} ${label}${det}`;
}

export function svcLine(status: Status, name: string, latencyMs?: number, detail?: string): string {
  const pad = name.length < 10 ? " ".repeat(10 - name.length) : " ";
  const lat = latencyMs ? `${DIM}${latencyMs}ms${RESET}` : "";
  const det = detail ? `${DIM} • ${detail}${RESET}` : "";
  return `  ${symbol(status)} ${name}${pad}${lat}${det}`;
}

export function heading(text: string): string {
  return `\n${BOLD}${CYAN}${text}${RESET}\n`;
}

export function arrow(text: string): string {
  return `  ${DIM}→${RESET} ${text}`;
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
  return `\n  ${BOLD}${MAGENTA}tate${RESET} ${DIM}scanning...${RESET}\n`;
}

export function separator(): string {
  return `${DIM}  ${"─".repeat(40)}${RESET}`;
}

export function groupLabel(text: string): string {
  return `\n  ${DIM}${text}${RESET}`;
}

export function verdictBlock(
  headline: string,
  cause: string,
  directive: string,
  confidence: number,
  severity: "ok" | "warning" | "critical",
  timeSaved: string,
): string {
  const headColor =
    severity === "critical" ? RED :
    severity === "warning" ? YELLOW : GREEN;

  const confColor =
    confidence >= 90 ? GREEN :
    confidence >= 70 ? YELLOW : DIM;

  const confBar = renderConfBar(confidence);

  const lines = [
    "",
    separator(),
    "",
    `  ${BOLD}${headColor}${headline}${RESET}`,
    "",
    `  ${DIM}cause${RESET}       ${cause}`,
    `  ${DIM}confidence${RESET}  ${confColor}${confidence}%${RESET} ${confBar}`,
    "",
    `  ${BOLD}${WHITE}→ ${directive}${RESET}`,
    "",
    `  ${DIM}⏱ saved you ${timeSaved} of debugging${RESET}`,
  ];

  return lines.join("\n");
}

function renderConfBar(pct: number): string {
  const filled = Math.round(pct / 10);
  const empty = 10 - filled;
  const color = pct >= 90 ? GREEN : pct >= 70 ? YELLOW : RED;
  return `${color}${"█".repeat(filled)}${DIM}${"░".repeat(empty)}${RESET}`;
}

export function watchVerdict(headline: string, cause: string, directive: string): string {
  return `  ${BOLD}${headline}${RESET} — ${cause}\n  ${DIM}→${RESET} ${directive}`;
}
