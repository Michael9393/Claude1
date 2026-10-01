# Handover (1 October 2026)

Read this first in a new chat, then `CLAUDE.md`.

## Who and why

- The repo owner is the **only user**. Goal: pass the CBR theory exam B (car) **on the first try**.
- Exam: **"somewhere in November 2026"**, no exact date booked yet.
- Studies on a **phone plus a theory book**. Own pace, own use, Dutch UI only.
- No backend for now. The owner asked what a backend would give; the answer was "sync, backup and reminders, not worth it for one phone; export/import (backlog #17) covers backup". Not formally decided.
- Content is checked by subagents (and maybe Codex), not by a human expert.

Full decisions: `docs/product/vision.md` (section "Decisions from the user").

## Where things are

- **Branch:** everything up to Part 3 is merged into `main` (PR #2, 1 Oct 2026). Start new work on a branch from `main`.
- **App:** plain HTML/CSS/JS, no build. See `CLAUDE.md` for layout, commands and conventions.
- **Team workflow:** `CLAUDE.md` → "Team workflow". Agents in `.claude/agents/`, skills `/check` and `/spec` in `.claude/skills/`. The main session is project manager and architect; it delegates and reviews.
- **Product docs:** `docs/product/vision.md`, `docs/product/backlog.md` (numbered, MoSCoW, status), `docs/product/specs/`.
- **Reviews:** `docs/product-review/` (round 1 and `round-2/`).
- **Content checks:** `docs/verificatie.md`.

## Current state

**Exam-ready loop** (`docs/product/specs/exam-ready-loop.md`, approved 30 Sep 2026), built in three parts:

| Part | What | Status |
|---|---|---|
| 1 | Answer history per topic, `seen`, per-topic exam scores, three-way exam date (not planned / month / precise), honesty note on the result | **done** (AC-1…9) |
| 2 | Result per topic, change since last mock, "Oefen zwakke onderwerpen", same-day mistake practice | **done** (AC-10…16) |
| 3 | Plan from the exam date, daily target in minutes, readiness ("Klaar volgens deze app") | **done** (AC-17…35) |

Design proposals: `docs/product/specs/exam-ready-loop-part1-design.md`, `…-part2-design.md`, `…-part3-design.md` (its "Decided" section holds the Part 3 design choices: literal "Bijna", "Welkom terug." after a missed day, "Oefen <onderwerp>" max 15, 44-vs-46 line).

**User decisions for Part 3** (in the spec's "Decided" section):
- Readiness eis 1: the **last 3 mock exams all ≥ 46/50** (no 7-day window, no higher margin).
- A mock where time ran out **counts** (open questions wrong).
- The app does **not** suggest moving the exam date.
- Workload: about **15 min/day** (up to 30 questions, max 20 new) plus a 30-minute mock every few days.
- Month-only date: plan counts to the 1st; from the 1st, maintenance mode plus a prompt to enter the date.

**Also done this session:**
- Exam format checked: 50 questions, 30 min, 44 to pass (+2 unscored test questions), via search summaries of cbr.nl (backlog #1).
- Six reviewer content points checked against the law; fixes in `docs/verificatie.md` (backlog #2).
- Store hardening partly done (prototype-key guards everywhere, exam and mistake fields validated, impossible dates rejected); the rest of backlog #18 is open.
- Light-mode green contrast fixed (part of #24).

**Checks:** `/check` green after the Part 3 review fixes: validate OK, logic tests OK (including a `TZ=Europe/Amsterdam` rerun), smoke 303/303 (about 60 s).

**Part 3 notes:** plan and readiness logic are pure functions in `js/util.js` (`dayPlan`, `planRules`, `readiness`, `todayStatus`, `replanToday`, `extraRound`, `oldPractice`, `topicPractice`, `freshFirst`). New store fields `today` and `practisedDay` ("gedaan" = first answer per question per day outside a mock). Backlog #5 and #6 are `done`.

## Next step

By backlog priority: #7 hazard perception with still scenes (L), #8 CBR-style distractors, #10/#11 more crossings and signs, #17 export/import. Start with `product-strategist` or `/spec` for the next item.

## Things to know

- **Blocked sites:** cbr.nl and wetten.overheid.nl are blocked by the proxy. For law texts use the CC0 copy at `github.com/Apolloccrypt/wetgeving-nl` (RVV 1990, 1 July 2026) and `statengeneraal/laws-markdown` for bijlage I. For CBR use search results restricted to cbr.nl.
- **Bump `CACHE` in `sw.js`** after changing any file the app loads. The current value is `theorie-b-2026-10-01h`.
- **Commit as you go:** a stop hook asks to commit and push uncommitted changes. While a subagent is still editing, commit only the files it has finished with.
- **Agents:** the custom agent types (`frontend-developer`, `test-engineer`, …) are available as subagent types from session start.
- **Bash approvals** sometimes fail with "classifier gave no verdict"; retry, or use Read/Edit/Write meanwhile.
- **Tests that need a browser** use the global Playwright: `NODE_PATH=$(npm root -g) node tests/smoke.js`. Never run `playwright install`.
- **The owner prefers** short answers, decisions offered as multiple choice, and plain explanations of technical choices.
