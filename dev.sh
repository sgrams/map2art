#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Stan Grams <sjg@haxx.space>
#
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Bring up the map2art backend (actix-web) and frontend (Vite) together.
# Both run in the foreground; Ctrl+C tears down both cleanly.
#
# Usage: ./dev.sh [extra cargo run args...]
#   e.g. ./dev.sh -- --bind 0.0.0.0:8080

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

command -v cargo >/dev/null || { echo "error: cargo not found (install a Rust toolchain)"; exit 1; }
command -v npm   >/dev/null || { echo "error: npm not found (install Node 18+)"; exit 1; }

# Install frontend deps on first run.
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo ">> installing frontend dependencies..."
  (cd "$ROOT/frontend" && npm install)
fi

pids=()

cleanup() {
  trap - INT TERM EXIT
  echo
  echo ">> shutting down..."
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo ">> starting backend (cargo run)..."
(cd "$ROOT" && cargo run "$@") &
pids+=($!)

echo ">> starting frontend (npm run dev)..."
(cd "$ROOT/frontend" && npm run dev) &
pids+=($!)

echo ">> both running. Open the URL Vite prints (usually http://127.0.0.1:5173/). Ctrl+C to stop."

# Exit as soon as either process dies, then cleanup runs via the trap.
wait -n
