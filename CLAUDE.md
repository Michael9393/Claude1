# CLAUDE.md

Notes for Claude Code when working in this repository.

## Stack

- React 19 + TypeScript, bundled with Vite
- Tests: Vitest + React Testing Library (jsdom), setup in `src/test/setup.ts`
- Lint: oxlint (`.oxlintrc.json`); format: Prettier (`.prettierrc`: no semicolons, single quotes)

## Commands

- `npm run dev` — dev server
- `npm test` — run tests once
- `npm run lint` / `npm run typecheck` / `npm run format:check`
- `npm run build` — production build

Before committing, run `npm run lint && npm run format:check && npm run typecheck && npm test`. CI (`.github/workflows/ci.yml`) runs the same checks plus `npm run build`.

## Conventions

- `src/components/` reusable UI components, `src/pages/` page-level components, `src/hooks/` custom hooks (`useXxx.ts`), `src/lib/` non-React code.
- One component per file, named in PascalCase (`UserCard.tsx`), with its test beside it (`UserCard.test.tsx`).
- Import local modules with the `.ts`/`.tsx` extension (`import App from './App.tsx'`).
- Use function components and hooks, not class components.
