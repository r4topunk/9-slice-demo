---
name: playwright-nine-slice-demo
description: Playwright workflow for /Users/r4to/Script/9-slice-demo (Vite canvas game). Use when validating browser behavior, running smoke checks, capturing debug screenshots, or troubleshooting Playwright on macOS ARM in this repository.
---

# Playwright Nine Slice Demo

## Quick Start

Run commands from `/Users/r4to/Script/9-slice-demo`.

```fish
pnpm install
pnpm exec playwright install chromium
pnpm run playwright:smoke
```

`pnpm run playwright:smoke` does the project baseline check:

- Starts Vite on `127.0.0.1:4173`
- Opens Chromium headless
- Verifies `#canvas` is visible and sized
- Sends keyboard controls (`ArrowRight`, `D`, `R`)
- Saves artifacts to `output/playwright/`

## Manual Debug Loop

Use this loop when you need headed browser checks, snapshots, or step-by-step interactions.

Start the app server:

```fish
pnpm exec vite --host 127.0.0.1 --port 4173 --strictPort
```

In another shell, use the shared Playwright CLI wrapper:

```fish
set -gx CODEX_HOME ~/.codex
set -gx PWCLI "$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"

$PWCLI open http://127.0.0.1:4173 --headed
$PWCLI snapshot
$PWCLI screenshot --output output/playwright/manual.png
```

Always re-run `snapshot` after UI-changing interactions.

## App-Specific Checks

Prefer these checks for this game:

- Canvas render exists: `#canvas` visible
- Shirt controls: `ArrowLeft` / `ArrowRight`
- Pants controls: `A` / `D`
- Randomize outfit: `R`
- Fullscreen toggle: `F`

## Artifact Rules

- Write screenshots, traces, and logs to `output/playwright/`
- Do not create new top-level artifact folders

## Troubleshooting

Read `references/troubleshooting.md` for macOS ARM browser issues, sandbox limits, and wrapper fallback.
