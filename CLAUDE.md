# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A coursework submission (HW06, student 23127396) that performs AI-assisted API testing of a bundled
System Under Test (SUT), "EShop" — a Node/Express/SQLite e-commerce backend. This repo is **not** the
product being built; it is the test harness, generated test cases, Postman/Newman collections, and
audit trail *around* `sut/`. `sut/backend/` is a vendored, deliberately-unmodified copy of the system
being tested — it is the oracle, and patching it would invalidate the bug reports. Only three endpoints
are in scope (see "The frozen API trio" below); everything else in the SUT is out of scope by design.

Full context — grounded facts about the SUT (with `server.js` line numbers), the coverage plan, and the
list of expected/reproduced bugs — lives in `PLAN.md`. Read it before making non-trivial changes; it is
the source of truth for *why* the harness is shaped the way it is, and duplicating that reasoning here
would just let the two drift.

## Commands

```powershell
npm ci                  # install test tooling (Newman)
npm run sut:install     # install sut/backend deps
npm run sut:start       # start -> wait-for-ready -> seed (PowerShell script)
npm run sut:stop
npm run seed            # re-seed deterministic fixtures on a running SUT
npm run reset-lockout   # clear the login-attempt lockout counter
npm run test:smoke      # harness self-check: 3 requests / 9 assertions
npm test                # all graded collections (node scripts/run-newman.js)
npm run test:api1       # just API1 (PUT /api/users/me)
npm run test:api2       # just API2 (POST /api/apply-coupon)
npm run test:api3       # just API3 (PUT /api/admin/orders/:id/status)
```

`scripts/run-newman.js` accepts `--bail` and `--only=API1|API2|API3` directly if you need finer control
than the npm scripts above.

There is no linter or unit-test suite in the JS sense — "tests" here are Postman collections executed
by Newman against a live server, and grading correctness means reproducing the documented bug or
passing the documented negative-result case, not a green build.

## Architecture: the generate → audit → extend → execute pipeline

Each of the three in-scope APIs goes through the same four-stage pipeline, and every stage is a real
artifact on disk (not just a step you did once and threw away):

1. **Generate** (`docs/api<N>-*/generated.md`, plus `s1-parameter-inventory.md` through
   `s5-schema-validation.md`) — AI produces test cases in six deliberate stages: parameter inventory →
   domain partitions → boundaries → state transitions → security (authN/authZ/injection) → response-schema
   validation. Driven one stage at a time via the `api-testcase-generator` skill — never "generate all
   test cases" in one shot, because that collapses the partition/boundary/state/security dimensions into
   a shallow, undifferentiated list.
2. **Audit** (`docs/api<N>-*/audit.md`) — every generated case is labelled VALID / INVALID / INCOMPLETE
   with a reason, bad ones corrected. Driven by the `api-testcase-audit` skill.
3. **Extend** (`docs/api<N>-*/extended.md`) — ≥5 human-added cases the AI structurally could not produce,
   each with a note on *why* the AI missed it.
4. **Execute** — a hand-committed Postman v2.1 collection under `postman/collections/API<N>-*.json`, run
   via `scripts/run-newman.js`, producing `reports/api<n>-*.html` (htmlextra) and `.json`. Evidence
   capture (X-Student-Id header proof, deterministic fixtures, CI red/green pair) is driven by the
   `newman-execution-evidence` skill.

Test case IDs follow `A<n>-S<stage>-<nn>` (e.g. `A2-S3-05`) so the generation stage stays visible
through audit, collection names, and the Newman report.

**Cases that target a real SUT defect assert spec-correct behavior and are tagged `EXPECTED-FAIL`.**
Never "fix" such a case by rewriting its expectation to match the buggy implementation — that turns the
suite green and silently deletes the finding. Known-defect cases are quarantined into their own folder
that CI excludes from the pass/fail gate, and that exclusion is named explicitly in the CI report; the
gate must never be made to pass by weakening an assertion.

## The frozen API trio

Only these three endpoints are tested (one per requirement pool, chosen to avoid duplicating groupmates'
selections — see `PLAN.md` §0 for the constraint and rationale):

| Pool | Endpoint | Spec ref | Why this one |
|---|---|---|---|
| A | `PUT /api/users/me` | FR-04 | numeric `phone` format rule + explicit role-immutability rule (SEC-06) |
| B | `POST /api/apply-coupon` | FR-09 | 5 stated business conditions (C1–C5), explicit discount formula, unauthenticated `user_id` in body (IDOR) |
| C | `PUT /api/admin/orders/:id/status` | FR-18/FR-10 | full order state machine + vertical privilege escalation (SEC-03) |

This trio is **frozen** as of `PLAN.md` T1 — changing an endpoint means redoing that endpoint's entire
pipeline (generate → audit → extend → execute → report). The three form one attack chain: API 1's
SEC-06 defect (client can set its own `role`) promotes a plain user to admin, which is exactly what
lets API 3's SEC-03 cases (no `/api/admin/*` route checks `role`) succeed. Don't test them in isolation
without being aware of that dependency when reasoning about "why does this pass/fail."

Full spec: `sut/api_specification.md` (endpoint list) and `Requirement/2026.HW06.API Testing_En.md`
(the graded business requirements, FR-01..FR-24, SEC-01..SEC-07) describe the *intended* system;
`sut/backend/server.js` and `database.js` are the actual (buggy) implementation — the gap between them
is what the test cases are designed to surface.

## Why fixtures are reseeded before every collection, not once

`server.js` requires `database.js`, which DROPs and re-seeds every table **at module load** — so the
server must be up before `scripts/seed-api-data.js` runs (start → wait → seed, enforced by both
`scripts/start-sut.ps1` and the CI job). Beyond that, `scripts/run-newman.js` reseeds **between every
graded collection**, not just once at the start, because the collections corrupt each other's starting
state if run back to back:

- API 1 can escalate the tester's `role` to admin (the SEC-06 finding) and can NULL profile fields via
  its partial-update cases. Leaving `role=admin` behind would make API 3's authorization cases pass for
  the wrong reason.
- API 3 mutates the very order rows its own state-machine cases start from.

A single Newman invocation over all three collections without reseeding between them would therefore be
order-dependent and flaky — this is intentional design, not an oversight, so don't "simplify" it away.

Also note: logging in on the wrong password locks the account (see `scripts/reset-lockout.js`), and
`POST /api/register` accepts literally anything with no validation — both are groupmates' endpoints, not
bugs to report here, but they affect how setup steps must be written (never assume a fixture-creating
request is inert).

## Skills

`skills/` (symlinked into `.claude/skills`) holds four project skills that encode the required workflow
— prefer invoking them over reimplementing the same steps ad hoc:

- `api-testcase-generator` — drives the six-stage generation described above
- `api-testcase-audit` — VALID/INVALID/INCOMPLETE labelling + correction + gap analysis
- `newman-execution-evidence` — running collections and capturing gradable evidence
- `ai-audit-log` — maintains the mandatory AI Audit Report (prompt/output/human-correction log) and the
  AI Critique required by the assignment

## CI/CD

`.github/workflows/api-tests.yml` boots a fresh SUT on Ubuntu, waits for it, seeds it, runs the smoke
harness, then runs every graded collection via `scripts/run-newman.js`, uploading HTML/JSON reports as
artifacts regardless of outcome. It deliberately fails (exit 1) if `postman/collections/` has zero
non-`_`-prefixed collections, so a renamed/deleted collection can never pass silently — this is gated
on collection files existing (`Detect graded collections` step) rather than weakened, so the pipeline
can still report a clean "bootstrap, nothing graded yet" state without being green for the wrong reason.
`_harness-smoke.postman_collection.json` (leading underscore) is intentionally excluded from grading.

The assignment requires demonstrating both a green run and a deliberate red run (flip one expected
status in one test case, capture the failure, then revert) — see `PLAN.md` steps C1–C3.
