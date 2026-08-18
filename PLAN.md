# HW06 — AI API Testing · Execution Plan

**Student:** Luong Linh Khoi · **ID:** 23127396 · folder suffix `_090` = self-assessed grade
**SUT:** EShop backend (`http://localhost:3000`), copied to `sut/` · **Tool:** Postman + Newman 6.2.2
**AI:** Claude Code (Opus 5) · **Plan written:** 2026-08-18 · **Budget:** 10 hours

> Status: **environment, skills and pipeline are built and verified. No test cases generated yet.**
> The smoke harness runs green end to end (3 requests, 9 assertions) — see §2.

---

## 0. Decisions taken up front

| Decision | Choice | Rationale |
|---|---|---|
| Tool | **Postman + Newman** (§8 default), collections hand-committed as JSON | Karate/RestAssured would need a JVM toolchain for zero extra rubric points. Newman is what the CI job runs. |
| Reporter | `newman-reporter-htmlextra` | The stock HTML reporter drops request/response bodies, which are exactly what makes a failure diagnosable in the graded report. |
| SUT copy | `sut/` inside this repo, `node_modules` + `database.sqlite` gitignored | A TA can clone, `npm ci`, and reproduce every run. The SUT source is **unmodified** — it is the oracle, and patching it would invalidate the bug reports. |
| Repo | New public repo **`eshop-sut-hw06-api`** (owner `linhkhoi1309`); this folder is its working tree | §14 wants a public repo; §12 wants a commit per step; the Issues tab must be fresh for HW06 bugs. |
| Fixtures | `scripts/seed-api-data.js`, re-run **before every collection** | Not cosmetic — see the two traps in §1. |
| Student header | Collection-level pre-request script + a collection-level `pm.test` | §11 checks it. Setting it per-request is one copy-paste away from being missed; asserting it turns the requirement into a reported result rather than a claim. |
| Test-case IDs | `A<n>-S<stage>-<nn>` (e.g. `A2-S3-05`) | The generation stage stays visible through audit, collection, and Newman report — a thin stage is then obvious at a glance. |
| Expected-fail policy | Cases targeting real defects assert the **spec** behaviour and are tagged `EXPECTED-FAIL` | Rewriting an expectation to match a buggy implementation turns the suite green and deletes the finding. |

### API selection (§5 — one per pool, must not duplicate a groupmate's set)

| Pool | FR | Endpoint | Why this one |
|---|---|---|---|
| **A** | FR-02 | `POST /api/login` | Densest single endpoint for domain partitions (email format, password), the lockout **state machine**, and four SEC requirements at once (SEC-01 plaintext, SEC-02 JWT, SEC-05 injection). |
| **B** | FR-09 | `POST /api/apply-coupon` | Five stated business conditions C1–C5 with an explicit discount **formula** and an explicit `>=` threshold — the richest partition/boundary surface in the SUT, plus an unauthenticated `user_id` in the body (IDOR). |
| **C** | FR-18 | `PUT /api/admin/orders/:id/status` | The FR-10 **order state machine** directly (5 states, final-state rules) plus vertical privilege escalation on an `/api/admin/` route (SEC-03). |

Between them these three cover all four mandated dimensions — partitions, state transitions, security, schema — without any one endpoint carrying a dimension alone. HW05 used `GET /api/products`, `POST /api/forgot-password` and `PUT /api/orders/:id/cancel`, so there is no overlap with my own prior work either.

**Open item:** §5 also forbids duplication *within the group*. I cannot verify that from here — confirm the trio with groupmates before the generation step starts, since changing an API afterwards invalidates that API's whole pipeline.

---

## 1. Grounded facts about the SUT — verified by reading the source, do not re-derive

Line references are into `sut/backend/`. These decide whether the suite is reproducible and where the defects are.

1. **Starting the server wipes the database.** `server.js:4` requires `./database`; `database.js:117` calls `initDatabase()` at module load, which DROPs and re-seeds every table. **Seed only after the server is listening** — `scripts/start-sut.ps1` and the CI job both enforce start → wait → seed.
2. **Lockout trips on the *second* wrong password, not the third.** `server.js:54` does `login_attempts + 2` and `:56` locks at `>= 3` for **180 s** (`:57`). The spec (README FR-02) says increment by **exactly 1** and lock for **30 s**. Three separate defects in one branch — and operationally, any negative login case poisons every later case needing that account, hence `scripts/reset-lockout.js`.
3. **Login returns the entire user row, password included.** `server.js:52` — `res.json({ message, token, user })` where `user` is `SELECT *`. Direct SEC-01 violation and an S5 absence-assertion target.
4. **Passwords are stored in plaintext.** `database.js:92-93`, `server.js:23` — no hashing anywhere. SEC-01.
5. **The percent discount formula is wrong.** `server.js:399-401` (and the duplicated no-`user_id` branch at `:419-421`) computes `total_amount * (1 - discount_value)`. Spec says `total × discount_value / 100`. For `SAVE10` on 500,000 ₫: spec → discount 50,000, final 450,000; implementation → `500000 * (1-10)` = −4,500,000, so `final_amount` = **5,000,000**, i.e. the "discount" multiplies the bill by ten.
6. **The coupon threshold is `>` where the spec says `>=`.** `server.js:379` — `total_amount > coupon.min_order_amount`. An order of exactly 300,000 ₫ with `SAVE10` is rejected. Classic exact-boundary defect; only a case sitting *on* the threshold catches it.
7. **`/api/apply-coupon` requires no authentication at all.** `server.js:363` has no `authenticateToken`, and `user_id` arrives **in the request body**. Violates FR-09 C4 and SEC-02: the per-user usage limit (C5) is bypassed by omitting `user_id`, and another user's quota is consumable by passing their id.
8. **No `/api/admin/*` route checks `role`.** `authenticateToken` (`server.js:100-110`) only verifies the signature and sets `req.user`. `server.js:525` (order status), `:494` (list users), `:504` (delete user) accept **any** valid token. Direct SEC-03 violation — a plain user can drive the whole order state machine.
9. **`canceled → delivered` is explicitly allowed.** `server.js:550-551`. The spec calls `canceled` and `delivered` final states with no outgoing transitions. Planted defect, and the exact case an AI that reads the forward-drawn diagram will not generate.
10. **`PUT /api/users/me` accepts `role` from the client.** `server.js:118-127` appends `role = ?` when the body contains it. SEC-06 violation and a full privilege-escalation chain: register → self-promote to admin → drive admin routes. (Not one of my three APIs, but it is the mechanism that makes the API-3 escalation cases trivially reachable, and it is a reportable bug.)
11. **`GET /api/orders/:id` has no `authenticateToken` at all** (`server.js:344`) — unauthenticated IDOR on order detail. Supporting evidence for the API-3 bug report.
12. **JWT has no expiry** (`server.js:51`, no `expiresIn`) and the secret is hard-coded (`server.js:9`). A token minted at t=0 is valid for the whole run — convenient for the suite, reportable as a finding.
13. **Product search interpolates SQL directly** — `LIKE '%${searchQuery}%'` (`server.js:144`). SEC-05 violation. Login itself *is* parameterised (`server.js:35`), so the API-1 injection cases are expected to be **negative results** — worth stating explicitly in the report rather than quietly omitting.
14. **Error paths ignore the `err` argument** in several handlers (`server.js:372`, `:504`, `:510`), so a DB error surfaces as a 200 with `undefined` fields rather than a 500.

Seeded fixture IDs (deterministic, asserted by the smoke run): tester `id=2` orders **1–5**, victim `id=3` orders **6–10**, one per state in `pending, confirmed, shipping, delivered, canceled`.

---

## 2. What is already built and verified

| Component | Path | Verified |
|---|---|---|
| SUT working copy + deps | `sut/backend/` | `npm ci` clean, sqlite3 native build OK |
| Start / wait / stop | `scripts/start-sut.ps1`, `wait-for-sut.js`, `stop-sut.ps1` | SUT ready in <1 s, pid tracked |
| Deterministic fixtures | `scripts/seed-api-data.js` | 3 users, 10 orders (one per state × 2 owners), coupon_usage cleared |
| Lockout reset | `scripts/reset-lockout.js` | — |
| Postman environment | `postman/environments/local.postman_environment.json` | 24 variables, resolves under Newman |
| Harness smoke collection | `postman/collections/_harness-smoke.postman_collection.json` | **3 requests / 9 assertions / 0 failures** |
| Reseeding multi-collection runner | `scripts/run-newman.js` | Correctly reports "no graded collections yet" |
| CI/CD pipeline | `.github/workflows/api-tests.yml` | Written; first run happens at §3 step T0 |
| Agent Skills | `skills/{api-testcase-generator,api-testcase-audit,newman-execution-evidence,ai-audit-log}` | Discoverable via `.claude/skills` junction |

The `X-Student-Id: 23127396` header is set by a collection-level pre-request script, `console.log`ged for the §11 screenshot, and asserted by a collection-level `pm.test` — already passing in the smoke run.

---

## 3. Execution steps (each ends in its own git commit — §12)

| Step | Work | Artefacts | Commit message |
|---|---|---|---|
| **T0** | Push repo, run the pipeline once on the smoke collection to prove CI is wired | Actions run URL | `chore: environment, skills and CI pipeline` |
| **T1** | Confirm API trio with groupmates (§5 non-duplication) | note in `report.md` | — |
| **A1-G** | API 1 `POST /api/login` — generate via the 6 stages of `api-testcase-generator` | `docs/api1-login/generated.md` (**≥35**) | `feat(api1): AI-generated test cases (stages S1-S6)` |
| **A1-A** | Audit: VALID / INVALID / INCOMPLETE + corrections | `docs/api1-login/audit.md` | `docs(api1): human audit of generated cases` |
| **A1-E** | Extend: ≥5 human cases + why the AI missed each | `docs/api1-login/extended.md` | `feat(api1): human-added cases the AI missed` |
| **A1-X** | Build + run the collection | `postman/collections/API1-Login...json`, `reports/api1-login.html` | `test(api1): Postman collection and Newman run` |
| **A2-\*** | Same four steps for `POST /api/apply-coupon`, plus the **data-driven** CSV run (`postman/data/coupon-cases.csv`) | `docs/api2-apply-coupon/*`, `reports/api2-...html` | `…(api2): …` |
| **A3-\*** | Same four steps for `PUT /api/admin/orders/:id/status`; S3 carries the full 5×5 transition matrix | `docs/api3-admin-order-status/*` | `…(api3): …` |
| **B** | File every confirmed bug as a GitHub Issue with a screenshot; mirror into `bug-report.md` | `bug-report.md`, `evidence/bug-*.png` | `docs: bug reports and GitHub issues` |
| **C1** | Green CI commit (known-defect folder quarantined + documented) | run URL + screenshot | `ci: full API suite passing` |
| **C2** | Red CI commit — flip **one** expected status in **one** test case | run URL + screenshot | `test: deliberate failing case for CI evidence (HW06 §6)` |
| **C3** | Revert C2 | — | `revert: restore correct expectation` |
| **D** | Generator design: self-drawn diagram + pseudocode (§7, §11 — **must not be AI-generated**) | `docs/generator-design.md`, `evidence/generator-diagram.png`, `generator.py` | `docs: AI test-generator design` |
| **E** | Excel test cases + summary, `report.md`, CI/CD report, AI audit + critique, README self-assessment, `git-commit-log.txt` | `submission/` | `docs: final report and submission bundle` |

**Ordering constraint:** the diagram (step D) is *drawn by hand* and must not be produced by the AI (§11). Draw it after A3 so it describes the pipeline actually used, not an idealised one.

---

## 4. Target coverage per API (≥35 each, §6.1)

| Stage | API 1 login | API 2 apply-coupon | API 3 admin order status |
|---|---|---|---|
| S2 domain partitions | ~16 (email format ×6, password ×5, missing/type/case-sensitivity ×5) | ~14 (`code`, `total_amount` incl. the exact 300k/500k thresholds, `user_id`, types) | ~8 (`status` enum incl. unknown/empty/case, `:id` non-numeric/absent/huge) |
| S3 state transitions | ~7 (attempt counter 0→1→2, lock, 180 s expiry, reset on success) | ~5 (usage count vs `max_uses_per_user`, incl. exactly-at-limit) | **~25** (full 5×5 matrix + the two final states) |
| S4 security | ~8 (SEC-01 ×2, SEC-02, SEC-05 injection ×4, enumeration via error-message diff) | ~7 (SEC-02 no-auth, IDOR via body `user_id`, quota bypass by omission, injection on `code`) | ~9 (SEC-03 user token, no token, malformed token, cross-user, escalation chain via SEC-06) |
| S5 schema | ~6 (token shape, `user` object, **absence** of `password`, error shape) | ~6 (`discount_amount`/`final_amount` types and sign, `success`, error shape) | ~5 (message shape, 400/404 error shape, no state leak) |
| **Total** | **~37** | **~32 + ≥5 extended** | **~47** |

API 2 lands closest to the floor; its data-driven CSV run is where the extra rows come from.

---

## 5. Expected findings (hypotheses — each must be reproduced before it is filed)

Ordered by severity. Every one traces to a numbered fact in §1.

| # | Fact | API | Severity | Requirement violated |
|---|---|---|---|---|
| BUG-01 | §1.5 percent discount inverted — a 10% coupon multiplies the total ~10× | 2 | **Critical** | FR-09 formula |
| BUG-02 | §1.8 no `role` check on `/api/admin/*` — any user drives the order state machine | 3 | **Critical** | SEC-03, FR-12 |
| BUG-03 | §1.10 `PUT /api/users/me` accepts `role` — self-promotion to admin | — | **Critical** | SEC-06 |
| BUG-04 | §1.3 + §1.4 plaintext passwords, returned in the login response | 1 | **Critical** | SEC-01 |
| BUG-05 | §1.9 `canceled → delivered` accepted | 3 | High | FR-10 final states |
| BUG-06 | §1.7 `apply-coupon` unauthenticated; per-user quota bypassed | 2 | High | FR-09 C4/C5, SEC-02 |
| BUG-07 | §1.11 `GET /api/orders/:id` unauthenticated IDOR | 3 | High | SEC-02 |
| BUG-08 | §1.2 lockout after 2 failures, not 3; 180 s not 30 s | 1 | Medium | FR-02 |
| BUG-09 | §1.6 coupon threshold `>` instead of `>=` | 2 | Medium | FR-09 C3 |
| BUG-10 | §1.12 JWT never expires, hard-coded secret | 1 | Medium | SEC-02 |
| BUG-11 | §1.14 swallowed DB errors return 200 with `undefined` fields | 2,3 | Low | — |

---

## 6. Postman features to exercise (§6 — must be listed in the report)

Planned, with where each will actually be used — a feature list without a use is not evidence.

| Feature | Where |
|---|---|
| Workspace | One HW06 workspace holding all three collections |
| Collections + folders | One per API, foldered by generation stage S2–S5 |
| Environment | `EShop Local (HW06)`, 24 variables, secrets typed as `secret` |
| Collection variables | Static per-API constants that must not vary by environment |
| Pre-request scripts | Collection-level `X-Student-Id`; request-level token acquisition |
| Test scripts + chai assertions | One `pm.test` per assertion, named by case ID |
| Dynamic variables | `{{$randomEmail}}`, `{{$timestamp}}` for uniqueness in registration setup |
| **Data-driven run** | `postman/data/coupon-cases.csv` through the Collection Runner / `newman -d` (API 2) |
| Newman CLI + htmlextra | `scripts/run-newman.js` |
| **Mock server** | A mock of `apply-coupon` returning the **spec-correct** response, to demonstrate the assertions pass against a correct implementation and that BUG-01 is in the SUT, not in my test |
| **Monitor** | Scheduled run of a small health subset against the mock (the local SUT is not reachable from Postman cloud — this limitation gets stated, not hidden) |
| Newman in CI | `.github/workflows/api-tests.yml` |

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Group-duplicate API selection (§5) | Confirm at step T1, **before** generation — a late change costs a full API pipeline |
| Lockout poisoning later cases | Reseed between collections (`run-newman.js`); `reset-lockout.js` for ad-hoc runs |
| "Green pipeline" achieved by weakening assertions | Known-defect cases quarantined into a folder CI excludes, and named in the CI report |
| Monitor/mock need a Postman cloud account and cannot reach `localhost` | Mock covers a spec-correct `apply-coupon`; monitor targets the mock; the limitation is documented |
| Diagram accidentally AI-generated (§11 = zero) | Drawn by hand at step D; only the pseudocode is co-written with AI, and that is declared |
| Time budget | 10 h: ~5 h across the three API pipelines, ~1.5 h execution + evidence, ~1 h CI runs, ~1 h generator design, ~1.5 h reports |

---

## 8. Deliverables map (§14 → artefact)

| §14 item | Path | Status |
|---|---|---|
| Main report (MD + PDF) | `report.md`, `submission/report.pdf` | pending |
| Public GitHub repo link | `eshop-sut-hw06-api` | pending T0 |
| Postman collections (`.json`) | `postman/collections/API{1,2,3}-*.json` | pending |
| Newman HTML reports | `reports/*.html` | pending |
| Postman feature list | `report.md` §Postman features | drafted in §6 above |
| CI/CD report + 2 runs | `docs/cicd-report.md`, `evidence/ci-*.png` | pending C1/C2 |
| Excel test cases + summary | `submission/23127396_HW06_TestCases.xlsx` | pending |
| Generator diagram + pseudocode | `evidence/generator-diagram.png`, `generator.py`, `docs/generator-design.md` | pending D |
| OpenAPI conversion (optional) | `docs/openapi.yaml` | optional |
| Bug report + Issue screenshots | `bug-report.md`, `evidence/bug-*.png` | pending B |
| AI critique + audit (MD + PDF) | `ai-critique.md`, `ai-audit-report.md` | log appended continuously |
| Git commit log | `git-commit-log.txt` | generated at E |
| README with self-assessment + test summary | `README.md` | pending E |

---

## 9. How to reproduce right now

```powershell
npm ci
npm run sut:install
npm run sut:start      # start -> wait -> seed
npm run test:smoke     # 3 requests, 9 assertions, 0 failures
npm test               # graded collections (none yet - reports "no graded collections found")
npm run sut:stop
```
