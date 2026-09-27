# Claude1

A web app built with [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/) and [Vite](https://vite.dev/).

## Getting started

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

Then open the URL printed in the terminal (usually http://localhost:5173).

## Scripts

| Command                | What it does                                   |
| ---------------------- | ---------------------------------------------- |
| `npm run dev`          | Start the dev server with hot reload           |
| `npm run build`        | Type-check and build for production to `dist/` |
| `npm run preview`      | Serve the production build locally             |
| `npm test`             | Run the tests once (Vitest)                    |
| `npm run test:watch`   | Run the tests in watch mode                    |
| `npm run lint`         | Lint with oxlint                               |
| `npm run typecheck`    | Type-check with TypeScript                     |
| `npm run format`       | Format all files with Prettier                 |
| `npm run format:check` | Check formatting without changing files        |

## Project layout

```
.
├── .github/workflows/ci.yml   # CI: lint, format, typecheck, test, build
├── public/                    # Static files served as-is (favicon, etc.)
├── src/
│   ├── assets/                # Images, fonts and other imported files
│   ├── components/            # Reusable UI components
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Helpers, API clients, non-React code
│   ├── pages/                 # Page-level components
│   ├── test/setup.ts          # Test setup (jest-dom matchers)
│   ├── App.tsx                # Root component
│   └── main.tsx               # Entry point
├── index.html
└── vite.config.ts             # Vite + Vitest config
```

## Working with Claude Code

This repo comes with a Claude Code team in `.claude/`:

- **Product team:** `product-strategist`, `requirements-analyst` and `user-advocate` work out what to build. Their output goes to `docs/product/`.
- **Build team:** `ui-ux-designer`, `frontend-developer`, `test-engineer`, `ponytail` (keeps code lean) and `code-reviewer`.
- **Commands:** `/spec <idea>`, `/new-component <Name>` and `/check`.
- **Hook:** Prettier auto-formats every file Claude edits.

See [CLAUDE.md](CLAUDE.md) for the workflow.

## License

[MIT](LICENSE)
