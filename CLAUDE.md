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

## Team workflow

The main session acts as **project manager and architect**. It breaks work into tasks, delegates each one to a subagent (`.claude/agents/`), and reviews what comes back. Nothing gets built without an approved spec.

**1. Discover (what to build)**

1. `product-strategist`: brainstorm options, pick an MVP, then update `docs/product/vision.md` and `docs/product/backlog.md`.
2. `/spec <feature>`: `requirements-analyst` drafts `docs/product/specs/<feature>.md`, and `user-advocate` critiques it.
3. The user answers the spec's open questions and approves it. Its status becomes `approved`.

**2. Build (how to build it)**

1. `ui-ux-designer`: design proposal for the screens in the spec.
2. `frontend-developer`: implements it against the acceptance criteria.
3. `test-engineer`: gives every acceptance criterion a test and covers the edge cases.
4. `ponytail`: trims dead code, duplication and needless dependencies without changing behavior.
5. `code-reviewer`: read-only review; blockers go back to the developer.
6. `/check`: everything green, then commit and mark the backlog item `done`.

Skip steps that don't apply: a small bug fix doesn't need a designer.

### Tools

- `/check`: runs lint, format, typecheck, tests and build, then summarizes failures.
- `/new-component <Name> [components|pages]`: scaffolds a component and its test.
- `/spec <feature idea>`: drafts and critiques a spec.
- Auto-format hook (`.claude/settings.json`): runs Prettier on every file Claude edits or writes.
