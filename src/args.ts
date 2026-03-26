export interface CliArgs {
  all: boolean;
  services: boolean;
  env: boolean;
  local: boolean;
  watch: boolean;
  watchInterval: number;
  help: boolean;
  version: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  const has = (flag: string) => args.includes(flag);

  const intervalIdx = args.indexOf("--interval");
  let watchInterval = 120_000; // 2 minutes default
  if (intervalIdx !== -1 && args[intervalIdx + 1]) {
    const secs = parseInt(args[intervalIdx + 1], 10);
    if (!isNaN(secs) && secs >= 10) {
      watchInterval = secs * 1000;
    }
  }

  const explicit = has("--services") || has("--env") || has("--local");

  return {
    all: has("--all") || !explicit,
    services: has("--services"),
    env: has("--env"),
    local: has("--local"),
    watch: has("--watch") || has("-w"),
    watchInterval,
    help: has("--help") || has("-h"),
    version: has("--version") || has("-v"),
  };
}

export function printHelp(): void {
  console.log(`
  tate — quick sanity check before debugging

  Usage:
    npx tate-dev [flags]

  Flags:
    --all         run all checks (default)
    --services    only check external services
    --env         only check environment variables
    --local       only check local server
    --watch, -w   background monitoring mode (paid)
    --interval N  seconds between watch checks (default: 120)
    --help, -h    show this help
    --version, -v show version
`);
}
