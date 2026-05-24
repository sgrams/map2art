<!--
SPDX-FileCopyrightText: 2026 Stan Grams <sjg@haxx.space>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

# map2art

[![License: AGPL v3 or later](https://img.shields.io/badge/License-AGPL_v3+-blue.svg)](LICENSES/AGPL-3.0-or-later.txt)
[![REUSE status](https://img.shields.io/badge/REUSE-compliant-brightgreen.svg)](https://reuse.software/)

Turn any patch of OpenStreetMap into a customisable, print-ready SVG art map. Pick a bounding box, choose a theme, tweak the CSS live, drop POIs and routes on top, then export to SVG or pixel-perfect PNG.

<!-- Drop a screenshot or demo gif at the path below; the README will pick it up automatically. -->
<p align="center">
  <img src="docs/screenshot.png" alt="map2art screenshot" width="820">
</p>

## What it does

- **Browse and select** any area on an interactive MapLibre map; drag the corners of the rendering rectangle or type in exact paper proportions (10×15, A4, A3, …).
- **Render** the selected bbox to SVG via the Overpass API, cached locally so re-renders are instant.
- **Style** the map with built-in themes (pastel, neon, blueprint, mid-century, risograph, topo, …) or your own CSS — edited live in a CodeMirror panel with full preview.
- **Annotate** with text overlays (rotation, font picker, multi-line, presets), POIs in several marker styles, and routes that can be straight lines or hand-shaped Bezier curves with draggable per-segment handles.
- **Frame** the result with Polaroid, Field Notes, Atlas (auto coordinate strip), Poster, or fully freeform layouts; add a scale bar, lat/lng crosshair, attribution corner.
- **Export** to SVG (vector) or PNG (rasterised server-side with [resvg](https://github.com/RazrFalcon/resvg), so the output matches the in-browser preview exactly).

## Quick start

You need a recent Rust toolchain (stable, edition 2024) and Node 18+.

```bash
# 1. Run the backend (actix-web + Overpass client + resvg)
cargo run

# 2. In another terminal, run the frontend dev server
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api/*` to the backend on `127.0.0.1:8080`, so opening the URL Vite prints (usually `http://127.0.0.1:5173/`) is all you need.

### Building for production

```bash
# Backend
cargo build --release

# Frontend (outputs to frontend/dist/)
cd frontend
npm run build
```

Point the backend's static-file serving (or a reverse proxy) at `frontend/dist/` to deploy.

### Configuration

The backend takes a handful of optional flags:

| Flag             | Default                                          | What it controls                            |
|------------------|--------------------------------------------------|---------------------------------------------|
| `--bind`         | `127.0.0.1:8080`                                 | HTTP listen address                         |
| `--styles`       | `styles.css`                                     | Working stylesheet (auto-created on first run from `themes/pastel.css`) |
| `--themes`       | `themes`                                         | Read-only theme presets directory           |
| `--overpass-url` | `https://overpass-api.de/api/interpreter`        | Overpass endpoint                           |

## Repository layout

```
src/                Rust backend (actix-web HTTP, Overpass client, SVG renderer)
  main.rs           Routes, CLI, LRU cache, /api/render and /api/raster handlers
  overpass.rs       Overpass query builder + JSON fetcher
  render.rs         OSM data → SVG (layers, multipolygons, label placement)
frontend/           Vite + TypeScript + MapLibre frontend
  src/main.ts       Editor app: map picker, render preview, overlays, POIs, routes
  src/style.css     Editor UI styles
themes/             Read-only theme CSS presets (pastel, neon, blueprint, …)
LICENSES/           SPDX-named license texts
REUSE.toml          Licensing for files that can't hold SPDX headers
```

## Themes

Each theme is a single CSS file in `themes/`, applied as `<style>` inside the rendered SVG. Selectors target either layer groups (`.layer-road polyline`, `.layer-water :where(polygon, path)`) or specific subclasses (`.road-motorway`, `.landuse-forest`, `.coastline`). Adding a new theme is as simple as dropping `themes/yours.css` next to the existing ones — it shows up in the picker on next reload.

## License & attribution

Source code is licensed under **[GNU AGPL v3.0 or later](LICENSES/AGPL-3.0-or-later.txt)** — derivatives (including network-served forks) must remain open under the same terms.

Map data is © OpenStreetMap contributors, available under the [Open Database License](https://www.openstreetmap.org/copyright). Every rendered map carries a `Map data from OpenStreetMap` attribution by default; keep it visible if you publish or print.

The project is fully [REUSE 3.3](https://reuse.software/spec/) compliant — every file has machine-readable copyright + license metadata. Run `reuse lint` to verify.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Short version: sign your commits (`git commit -s`), use [Conventional Commits](https://www.conventionalcommits.org/), and keep new files REUSE-compliant.
