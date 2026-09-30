# Product vision

> Status: **partly decided.** The product already exists and has had two review rounds ([round 1](../product-review/README.md), [round 2](../product-review/round-2/README.md)). On 30 September 2026 the user answered the strategist's questions and set the direction: **a personal study tool for one first-time candidate (the user), with the goal of passing the CBR theory exam B on the first try.** The next increment is still **pending the user's pick** (see [MVP / next increment](#mvp--next-increment)).
>
> Notation: **Fact** = true of the shipped app, stated in a review with a source, or answered by the user. **Opinion** = the product strategist's judgement (30 September 2026), open to change by the user.

## Decisions from the user (30 September 2026)

**Facts (the user's answers)**

1. Goal: for themselves, to pass the CBR theory exam B.
2. First user: themselves, a first-time candidate who wants to pass on the first try (not a retake).
3. Time: own pace, no fixed budget per increment.
4. Backend: not decided; the user asked for an explanation. Until then: **no backend** (see [Open questions](#open-questions)).
5. Hosting: GitHub Pages, on the shared `username.github.io` origin.
6. Content checking: by subagents and possibly Codex; no human instructor or expert.
7. Language: Dutch only.
8. Money: own use only; no donations, paid tiers or grants.
9. MoSCoW priorities: not answered, so the priorities in [backlog.md](backlog.md) are the strategist's proposal.

## Problem

**Facts**

- The CBR theory exam B, since 7 April 2025: one block of 50 questions, 30 minutes, 44 needed to pass, with hazard perception built in (round 1, review 5; round 2, review 5; secondary sources, since cbr.nl was blocked from the review environment, so this still needs a word-for-word check).
- About 40% pass first time (39.7% in 2024, 40% in 2025), and a retake costs about €50 plus weeks of waiting (round 2, review 5).
- In the persona test, the learner's mock-exam score rose from 38/50 to 43/50 in three evenings, still below the pass line (round 2, review 3).
- The instructor review found no factual errors in the numbers but left 6 content points to check against the law (round 2, review 1).

**Opinion**

- The user's pain is *"I don't know whether I'm ready, and I don't know what to study today to get there."* A first-timer has no earlier score to calibrate on, so the app has to supply that signal.
- With no human expert checking content, a wrong answer in the question bank is a direct risk to the user's own exam. Content correctness therefore matters as much as features.

## Target users

**Facts**

- One user: the owner of this repository, a first-time candidate for exam B, studying on a phone, sighted, Dutch-speaking.

**Opinion**

- Design every decision for this one person. Other learners may find the app on GitHub Pages, but they are not a target and the app should not bend to them.

## Goals

**Facts (what the shipped app already does)**

- Free, no account, no ads, works offline (PWA, `localStorage`).
- Every answer is backed by a cited legal source (`docs/verificatie.md`).
- Spaced repetition, a mistake log that resolves on two different days, a one-tap "Vandaag" plan.
- A mock exam in the current CBR format (50 / 30 min / 44).

**Opinion (goals for the next phase)**

- **Pass the real exam on the first try.** Everything else serves this.
- The user knows each day what to study, given the days left to the exam date.
- The user can trust a readiness signal: per topic and overall, based on recent mock exams and practice, with a clear statement of what the app does not cover (hazard perception, photo questions).
- The mock exam feels like the real one: format, timing and distractor style.
- The question bank is correct: every open content point checked against the law and recorded in `docs/verificatie.md`.

## Non-goals

**Facts (decided by the stack, the reviews and the user's answers)**

- No accounts, no server-side storage, no tracking, no ads (README; round 2, reviews 4 and 5).
- No official CBR questions or CBR photos; content is written from the law (README).
- Dutch only (user, answer 7).
- No monetisation: no donations, paid tiers or grants (user, answer 8).

**Opinion (follow from "one first-time user")**

- No growth work: no SEO pages, no marketing, no positioning copy for other learners.
- No instructor or school features (links, homework sets, dashboards). There is no instructor in the loop (user, answer 6).
- No B1 plain-language mode and no English mode.
- No multi-user concerns: no privacy notice aimed at the public, no retake onboarding, no support for other personas.
- No backend until the user decides on it (user, answer 4).
- Accessibility work is judged by usability for a sighted phone user, not by WCAG conformance as a goal in itself. Items that also make the app nicer on a phone (timer warnings, focus and scroll position after a new question, 320px reflow) stay in.
- Not competing on question volume or video hazard perception.

## MVP / next increment

> **Pending the user's pick.** The round-1 MVP (mock exam in the current format, Vandaag, mistake log, installable offline app) is shipped; see the `done` rows in [backlog.md](backlog.md).

**Updated recommendation (opinion):** start with **"Exam-ready loop"**, in this order:

1. **Trust the content first** (small): verify the exam format against cbr.nl and fix the 6 open content points against the law. Cheap, and a wrong fact in the bank costs points on the real exam.
2. **Know where you stand** (medium): result screen with score per topic and change since the last mock exam, plus a readiness indicator from the last 3 mock exams, topic accuracy and open mistakes, with a note that hazard perception and photo questions are not covered.
3. **Know what to do today** (medium): an exam-date plan for a first-timer, where plan size and number of mock exams scale with days left, with same-day practice of today's mistakes.

Hazard perception (still SVG scenes) is the biggest content gap after that, and a candidate for the increment after.

## Success measures

**Facts (current baseline)**

- Persona test: 38/50 to 43/50 in three evenings (round 2, review 3).
- 6 content points open to check (round 2, review 1).
- No analytics exist; the app stores mock-exam results in `localStorage`, so the measures below can be read from the user's own device.

**Opinion (proposed measures)**

- **Primary:** the user passes the real CBR theory exam B on the first try.
- In the last 7 days before the exam: every mock exam scores at least 46/50 (2 above the pass line, as a margin for exam nerves and uncovered question types).
- Every topic is above a mastery threshold (proposal: at least 90% correct over the last 20 answers in that topic) at least 3 days before the exam.
- 0 open mistakes older than 2 days on the day before the exam.
- Every content point from the reviews is checked and recorded in `docs/verificatie.md`; 0 factual errors found by the next subagent/Codex content review.

## Open questions

Only the user can answer these:

1. **Backend (answer 4):** do you want an explanation now? In short: without a backend everything stays on your phone (simple, free, private, but lost if the browser clears storage and not shared between devices). A backend would allow sync between phone and laptop and push reminders, but needs a server, an account and upkeep. Current assumption: no backend.
2. **Exam date:** do you have one booked? It sets how much fits in before the exam and which increment comes first.
3. **Devices:** do you study only on your phone, or also on a laptop? If both, progress export/import becomes more important.
4. **Mastery threshold:** is "46/50 in the last week" and "90% per topic" the bar you want, or stricter/looser?
5. **MoSCoW (answer 9):** do you accept the proposed priorities in [backlog.md](backlog.md)?
