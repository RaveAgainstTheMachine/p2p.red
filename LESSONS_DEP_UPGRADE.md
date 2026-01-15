# Dependency Upgrade Attempt — Lessons Learned

## Context
- Goal: upgrade web/desktop to React 19, ESLint 9, TypeScript-ESLint 8, TypeScript 5.7, Tailwind 4 (later deferred), and align shared package.
- Scaffolded Tauri desktop app already committed (state restored to commit `9de8448`). Dependency upgrade was rolled back after lint/build friction.

## What We Tried
- Upgraded package.json in root and `packages/web` (React 19, ESLint 9, TS-ESLint 8, TS 5.7, Vite bump, Tailwind briefly to v4 then reverted to v3.4.19 to avoid breaking changes).
- Added root ESLint flat config delegating to package configs; scoped package configs with `tsconfigRootDir` and project references.
- Updated web CSS/postcss/tailwind configs back to Tailwind v3 after v4 issues.
- Typed API error handling and adjusted React hooks to satisfy stricter lint rules.

## Pain Points / Breakages
- ESLint v9 + TS-ESLint 8 surfaced many `prefer-const`, constant-condition, and typing errors in `packages/web/src/App.tsx` and other components.
- Tailwind v4 migration was disruptive (postcss + entrypoint changes) and was deferred; kept Tailwind v3 for stability.
- Root lint needed ignores for non-package files (vite configs, d.ts) to avoid parsing errors.
- Tauri build prerequisites on Linux required extra system packages (pkg-config, GTK/WebKit deps) — documented in previous work.

## Decisions
- Rolled back all dependency upgrades to last known good commit (`9de8448`) to keep repo stable.
- Tailwind v4 migration postponed to a dedicated pass after lint/build are green on current stack.
- Will revisit dependency upgrades incrementally (likely package-by-package with smaller diffs and lint fixes alongside code changes).

## Recommendations for Next Attempt
1. Upgrade in smaller steps: start with TypeScript + TS-ESLint, fix lint issues, then React, then tooling.
2. Keep Tailwind on v3 until lint/build are clean; plan a separate v4 migration with the official codemods.
3. Run lint/build per package (`packages/web`, `packages/desktop`) to avoid root parsing surprises.
4. Add temporary eslint rule relaxations only when needed; prefer code fixes (e.g., convert `let`→`const`, avoid constant loops).
5. For Tauri/Linux builds, ensure required system deps are installed before CI runs.

## Next Steps (proposed)
- Re-attempt TypeScript/ESLint upgrades first, fix surfaced issues, then proceed to React/tooling.
- After successful lint/build, plan Tailwind v4 migration with test coverage for styling regressions.
- Add CI jobs to lint/build both web and desktop to catch regressions early.
