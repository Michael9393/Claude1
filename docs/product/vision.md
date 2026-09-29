# Product vision

> Status: **partly decided.** The product already exists and has had two review rounds ([round 1](../product-review/README.md), [round 2](../product-review/round-2/README.md)). The sections below record what the product and the reviews already settle. The next increment is **pending the user's choice** (see [MVP / next increment](#mvp--next-increment)).
>
> Notation: **Fact** = true of the shipped app or stated in a review with a source. **Opinion** = the product strategist's judgement (29 September 2026), open to change by the user.

## Problem

**Facts**

- Learners for the Dutch car licence must pass the CBR theory exam B: since 7 April 2025 one block of 50 questions, 30 minutes, 44 needed to pass, with hazard perception built in as animations (round 1, review 5; round 2, review 5, secondary sources, cbr.nl was blocked from the review environment).
- About 40% pass first time (39.7% in 2024, 40% in 2025), and a retake costs about €50 plus weeks of waiting (round 2, review 5).
- Competing prep products cost roughly €40–50, need an account, and do not show why an answer is right. Free sites are thin or ad-driven (round 2, review 5).
- Learners with Dutch as a second language get stuck on legal and compound vocabulary, not on the rules themselves (round 2, review 3, "Ahmed").

**Opinion**

- The pain this app can solve best is *"I keep getting rules wrong and I don't know why"*, felt daily in the 2–6 weeks before the exam, and more sharply in the 10 days before a retake.

## Target users

**Facts (who the reviews tested with or named)**

- **First-time learners, 16½–18**, studying on a phone in short sessions, usually next to a paid course or book ("Sanne", 17, round 1).
- **Retake candidates short on time**, often working, sometimes with Dutch as a second language ("Ahmed", 24, B1 Dutch, retake in 10 days, round 2).
- **Driving instructors** who would recommend it if they could see and steer a student's progress (round 2, review 1).
- Named by the market analyst as reachable niches: NT2 / newcomers, VO/MBO schools, expats (round 2, review 5).

**Opinion**

- Primary user for now: **the learner who is already paying for a course or book and wants a free, trustworthy second tool**, with retake candidates as the sharpest sub-group. Instructors are a channel to reach them, not a primary user.

## Goals

**Facts (what the shipped app already aims at)**

- Free, no account, no ads, works offline (PWA, `localStorage`).
- Every answer is backed by a cited legal source (`docs/verificatie.md`).
- Learning design, not just exam drilling: spaced repetition, a mistake log that resolves on two different days, a one-tap "Vandaag" plan.
- A mock exam that matches the current CBR format (50 / 30 min / 44).

**Opinion (goals for the next phase)**

- A learner can tell, from the app, what to do today and whether they are close to ready, and trusts that signal.
- The app is usable by keyboard and screen reader to WCAG 2.2 AA.
- Positioning: *"Oefenen met bewijs: bij elk antwoord het wetsartikel."* (round 2, review 5).

## Non-goals

**Facts (decided by the stack and the reviews)**

- No accounts, no server-side storage of learner data, no tracking, no ads, no data sales (README; round 2, reviews 4 and 5).
- No official CBR questions or CBR photos; content is written from the law (README).
- Not competing on question volume (1,500–3,500 at competitors) or on video hazard perception (round 2, review 5).

**Opinion**

- No backend in the next increment. Anything that needs one (instructor dashboards with live sync, reminders by push from a server) waits until the user explicitly accepts running a server.
- No paid tier in the next increment.

## MVP / next increment

> **Pending the user's choice.** The strategist's recommended option is **"Retake & exam-date plan, with the round-2 quick fixes first"** (see the brainstorm in the conversation of 29 September 2026). The round-1 MVP (mock exam in the current format, Vandaag, mistakes log, installable offline app) is already shipped; see the `done` rows in [backlog.md](backlog.md).

## Success measures

**Facts (what the reviews used as evidence)**

- Ahmed went from 38/50 to 43/50 in three evenings (round 2, review 3).
- Accessibility: 2 High and 5 Medium WCAG 2.2 AA findings open (round 2, review 2).
- The instructor found no factual errors in the numbers; 6 content points are open to check (round 2, review 1).

**Opinion (proposed measures; no analytics exist, so these are checked in review rounds and user tests, not tracked)**

- A retake learner who sets an exam date and last score gets a different, date-aware plan each evening, and can name their 2 weakest topics after one mock exam without reading every wrong answer.
- In a persona test, mock-exam score rises between the first and third timed exam.
- 0 High and 0 Medium WCAG findings in the next accessibility audit.
- Every content change is recorded in `docs/verificatie.md`; 0 factual errors found in the next instructor review.
- An instructor reviewer says they would recommend it "next to the theory book" without caveats about the mock-exam format or accessibility.
