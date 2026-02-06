# Playwright Troubleshooting (9-slice demo)

## 1) Browser path points to mac-x64 on Apple Silicon

Symptoms:

- `Executable doesn't exist ... chrome-headless-shell-mac-x64`
- `icudtl.dat not found in bundle`

Fix:

```fish
set -gx PLAYWRIGHT_HOST_PLATFORM_OVERRIDE mac15-arm64
pnpm exec playwright uninstall --all
pnpm exec playwright install chromium
pnpm exec playwright install --list
```

If this is a normal local terminal (not sandboxed tooling), remove the override after recovery:

```fish
set -e PLAYWRIGHT_HOST_PLATFORM_OVERRIDE
```

## 2) Cannot bind local port or cannot launch browser in sandbox

Symptoms:

- `listen EPERM: operation not permitted`
- `bootstrap_check_in ... Permission denied (1100)`

Cause:

- Sandboxed runner blocked local port or browser process capabilities.

Fix:

- Re-run smoke/manual checks outside the sandbox (or with escalated permissions in the runner).

## 3) Wrapper hangs on `npx --package @playwright/mcp`

Symptoms:

- `playwright_cli.sh` does not return.

Fix:

- Use project-native commands first:

```fish
pnpm run playwright:smoke
pnpm exec vite --host 127.0.0.1 --port 4173 --strictPort
```

- Then run direct Playwright Node scripts or local `pnpm exec playwright ...` commands.

## 4) Validate the current project state quickly

```fish
pnpm exec playwright --version
pnpm exec playwright install --list
pnpm run playwright:smoke
```

