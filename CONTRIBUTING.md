<!--
SPDX-FileCopyrightText: 2026 Stan Grams <sjg@haxx.space>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Contributing to map2art

Thanks for considering a contribution! A few things to know before opening a PR.

## Developer Certificate of Origin (DCO)

map2art uses the [Developer Certificate of Origin](https://developercertificate.org/) instead of a Contributor License Agreement. Every commit must carry a `Signed-off-by` trailer that asserts you wrote the change (or have the right to contribute it) under the project's AGPL-3.0-or-later license.

To add the trailer automatically:

```bash
git commit -s -m "feat(scope): summary"
```

This appends a line like:

```
Signed-off-by: Your Name <you@example.com>
```

Configure `user.name` and `user.email` in git first so the sign-off matches the author. Commits without a `Signed-off-by` line will be asked to be amended.

If you forget on a single commit:

```bash
git commit --amend --signoff
```

For a range of commits already pushed to a branch:

```bash
git rebase --signoff <base-branch>
```

## Conventional Commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). The first line is `type(scope): summary` where `type` is one of:

| Type     | When to use                                                |
|----------|------------------------------------------------------------|
| `feat`   | New user-visible feature                                   |
| `fix`    | Bug fix                                                    |
| `docs`   | Documentation only                                         |
| `refactor` | Code restructuring without changing behaviour            |
| `perf`   | Performance improvement                                    |
| `test`   | Adding or fixing tests                                     |
| `chore`  | Build, deps, tooling, repo housekeeping                    |
| `style`  | Formatting, whitespace (no logic change)                   |
| `ci`     | CI/CD configuration                                        |

Scope is optional but encouraged — common ones in this repo: `frontend`, `render`, `themes`, `deps`. Examples lifted from the history:

```
feat(frontend): draggable route curves, simpler POI size, Firefox PNG fix
fix(render): pin fill=none on polylines and line-shaped multipolygons
chore(deps): add codemirror for CSS tab
```

Keep the summary under ~72 characters, imperative mood, no trailing period. Add a body if the *why* isn't obvious from the diff.

## Licensing of new files

The repo is [REUSE 3.3](https://reuse.software/spec/) compliant — every file needs copyright and license metadata.

For source files that support comments (Rust, TypeScript, CSS, HTML, TOML, the gitignore, …), add an SPDX header at the top:

```
SPDX-FileCopyrightText: 2026 Your Name <you@example.com>

SPDX-License-Identifier: AGPL-3.0-or-later
```

…wrapped in the file's comment syntax (`// …`, `/* … */`, `<!-- … -->`, or `# …`). The easiest way is the `reuse` CLI:

```bash
reuse annotate --copyright="Your Name <you@example.com>" \
               --license=AGPL-3.0-or-later \
               --year=$(date +%Y) \
               path/to/new-file.rs
```

For files that can't carry inline headers (JSON, lock files, auto-generated artifacts), add an entry to `REUSE.toml` instead.

Run `reuse lint` before committing — CI will run it eventually, but it's faster to catch locally.

## Code style

- **Rust**: standard `cargo fmt`. Run `cargo check` before committing.
- **TypeScript**: type-check passes (`cd frontend && npx tsc -p tsconfig.json --noEmit`). No formatter is enforced yet; match the surrounding code.
- **CSS themes**: follow the structure of an existing theme (`themes/pastel.css` is a good reference) so the layer / subclass / label rules stay in roughly the same order across files.

## Pull requests

- Open against `master`.
- Keep PRs focused — one logical change per PR is easier to review than a bundle.
- Reference any related issue in the description.
- If the change is user-visible (new UI, new theme, behaviour change), include a screenshot or short clip.

## Reporting issues

When opening an issue, please include:

- **What you expected** and **what actually happened**.
- The browser + version if it's a frontend issue (especially helpful for SVG rendering bugs — Firefox and Chromium have different quirks).
- A bounding box / theme / render config that reproduces the bug, when possible.
