---
name: spec
description: Turns a feature idea into a reviewed spec. The requirements-analyst drafts it, the user-advocate critiques it, and you get back the decisions to make. Use when a feature idea needs defining before it's built.
argument-hint: <feature idea>
---

# /spec

Feature idea: `$ARGUMENTS`. If it is empty, ask the user which feature they want specced (the backlog in `docs/product/backlog.md` has candidates) and stop.

1. **Draft.** Delegate to the `requirements-analyst` subagent. Give it the feature idea and any context from this conversation. It writes `docs/product/specs/<feature-slug>.md` and updates the backlog.
2. **Critique.** Delegate to the `user-advocate` subagent with the path to the new spec. It returns concerns ranked by impact.
3. **Revise.** Apply the advocate's concerns that are clearly right, such as missing edge cases or unclear criteria, to the spec yourself. Anything that is a product decision goes into the spec's **Open questions** instead.
4. **Report back to the user:**
   - A link to the spec and a 3-line summary.
   - The acceptance criteria count and the scope (in and out).
   - The advocate's top concerns and what you changed because of them.
   - The open questions, as a short numbered list of decisions for the user to make.

The spec stays `draft` until the user answers the open questions and approves it. Only then set its status to `approved` in both the spec and the backlog, and hand it to the build team.
