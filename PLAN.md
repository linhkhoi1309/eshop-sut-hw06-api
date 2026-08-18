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
| **A** | FR-04 | `PUT /api/users/me` | FR-04 states a **numeric format rule** for `phone` (starts with `0`, 10–11 digits) — an exact boundary surface — and states **verbatim** that a user "cannot change their own `role`", which makes SEC-06 an unambiguous oracle rather than an inference. Also the only Pool A endpoint that is authenticated, so it carries a real authorization surface. |
| **B** | FR-09 | `POST /api/apply-coupon` | Five stated business conditions C1–C5 with an explicit discount **formula** and an explicit `>=` threshold — the richest partition/boundary surface in the SUT, plus an unauthenticated `user_id` in the body (IDOR). |
| **C** | FR-18 | `PUT /api/admin/orders/:id/status` | The FR-10 **order state machine** directly (5 states, final-state rules) plus vertical privilege escalation on an `/api/admin/` route (SEC-03). |

Between them these three cover all four mandated dimensions — partitions, state transitions, security, schema — without any one endpoint carrying a dimension alone. They also form **one coherent attack chain**: API 1's SEC-06 defect promotes a plain user to admin, which is exactly the token API 3's SEC-03 cases need. That chain is the narrative spine of the report.

`POST /api/login` was the original Pool A pick and was dropped — it is a groupmate's endpoint (§5 forbids duplication within the group). HW05 used `GET /api/products`, `POST /api/forgot-password` and `PUT /api/orders/:id/cancel`, so there is no overlap with my own prior work either.

**Selection CONFIRMED 2026-08-18** — student confirmed the trio against the group's allocations before any generation work started. `POST /api/login` was the one collision and has been replaced. This trio is now **frozen**: from here on, changing an API costs that API's entire pipeline (generate → audit → extend → execute → report), so any later conflict is escalated rather than absorbed.

---

## 1. Grounded facts about the SUT — verified by reading the source, do not re-derive

Line references are into `sut/backend/`. These decide whether the suite is reproducible and where the defects are. Facts marked **[✓ reproduced]** were confirmed with live requests against the running SUT during planning, not merely read off the source.

**Harness-critical**

1. **Starting the server wipes the database.** `server.js:4` requires `./database`; `database.js:117` calls `initDatabase()` at module load, which DROPs and re-seeds every table. **Seed only after the server is listening** — `scripts/start-sut.ps1` and the CI job both enforce start → wait → seed.
2. **Lockout trips on the *second* wrong password, not the third.** `server.js:54` does `login_attempts + 2` and `:56` locks at `>= 3` for **180 s** (`:57`), against README FR-02's "increment by exactly 1, lock 30 s". Login is a groupmate's endpoint so this is not a finding I report — but every collection logs in to get a token, so one mistyped credential in a setup step locks the account for three minutes. Hence `scripts/reset-lockout.js`.
3. **`POST /api/register` accepts literally anything** — no format, uniqueness, or complexity checks; an empty body `{}` creates a NULL/NULL row. **[✓ reproduced]** Not my API either, but it means any account-creating step leaves junk behind, which is why `seed-api-data.js` purges non-fixture users.

**API 1 — `PUT /api/users/me` (FR-04)**

4. **The client can set its own `role`.** `server.js:118-127` appends `role = ?` to the UPDATE whenever the body carries it. **[✓ reproduced]** — a plain user sent `{"role":"admin"}` and `GET /api/users/me` then returned `role: admin`. Flat SEC-06 violation, and FR-04 states the rule verbatim, so there is no interpretive wiggle room. This is also the key that unlocks API 3.
5. **There is no input validation of any kind.** FR-04 requires `phone` to start with `0` and be 10–11 digits; `phone: "abc"` is accepted and persisted. **[✓ reproduced]** No length, type, or format check on `name` or `shipping_address` either.
6. **A partial update silently destroys data.** The UPDATE always writes all three columns (`server.js:120-121`), so omitted fields bind as NULL. Sending `{"name":"X"}` alone wiped both `shipping_address` and `phone`. **[✓ reproduced]** Data-loss defect, and the case only appears if a test omits a field rather than sending an invalid one — a partition an AI rarely generates.
7. **`email` in the body is correctly ignored** — it is not in the UPDATE's column list, so FR-04's email-immutability rule holds. **[✓ reproduced]** A **negative** result: it belongs in the report as a rule that was tested and *passed*, not omitted.
8. **`GET /api/users/me` returns the whole row including the plaintext password** (`server.js:112-116`, `SELECT *`). **[✓ reproduced]** The companion read endpoint for API 1's schema stage, and the natural home for the S5 **absence** assertion.
9. **Passwords are stored in plaintext** (`database.js:92-93`, `server.js:23`) — no hashing anywhere. SEC-01.

**API 2 — `POST /api/apply-coupon` (FR-09)**

10. **The percent discount formula is wrong.** `server.js:399-401` (and the duplicated no-`user_id` branch at `:419-421`) computes `total_amount * (1 - discount_value)`. Spec says `total × discount_value / 100`. For `SAVE10` on 500,000 ₫: spec → discount 50,000, final 450,000; implementation → `500000 * (1-10)` = −4,500,000, so `final_amount` = **5,000,000** — the "discount" multiplies the bill by ten.
11. **The threshold is `>` where the spec says `>=`.** `server.js:379` — an order of exactly 300,000 ₫ with `SAVE10` is rejected. Only a case sitting *on* the threshold catches it.
12. **No authentication at all.** `server.js:363` has no `authenticateToken`, and `user_id` arrives **in the request body**. Violates FR-09 C4 and SEC-02: the per-user limit (C5) is bypassed by omitting `user_id`, and another user's quota is consumable by passing their id.

**API 3 — `PUT /api/admin/orders/:id/status` (FR-18)**

13. **No `/api/admin/*` route checks `role`.** `authenticateToken` (`server.js:100-110`) only verifies the signature and sets `req.user`. `server.js:525` (order status), `:494` (list users), `:504` (delete user) accept **any** valid token. SEC-03 violation — and combined with fact 4, a brand-new user reaches full admin in two requests.
14. **`canceled → delivered` is explicitly allowed.** `server.js:550-551`. The spec calls `canceled` and `delivered` final states with no outgoing transitions. Planted defect, and exactly the case an AI reading the forward-drawn diagram will not generate.
15. **`GET /api/orders/:id` has no `authenticateToken` at all** (`server.js:344`) — unauthenticated IDOR on order detail.

**Cross-cutting**

16. **JWT has no expiry** (`server.js:51`, no `expiresIn`) and the secret is hard-coded (`server.js:9`). A token minted at t=0 is valid for the whole run — convenient for the suite, reportable as a finding.
17. **SQL injection exists, but not on my endpoints.** `server.js:144` interpolates the product search term directly. The three chosen endpoints all use parameterised queries, so their SEC-05 injection cases are expected to be **negative results** — state that explicitly rather than quietly dropping the cases.
18. **Error paths ignore the `err` argument** in several handlers (`server.js:372`, `:504`, `:510`), so a DB error surfaces as a 200 with `undefined` fields rather than a 500.

Seeded fixture IDs (deterministic, asserted by the smoke run): tester `id=2` orders **1–5**, victim `id=3` orders **6–10**, one per state in `pending, confirmed, shipping, delivered, canceled`.

---

## 2. What is already built and verified

| Component | Path | Verified |
|---|---|---|
| SUT working copy + deps | `sut/backend/` | `npm ci` clean, sqlite3 native build OK |
| Start / wait / stop | `scripts/start-sut.ps1`, `wait-for-sut.js`, `stop-sut.ps1` | SUT ready in <1 s, pid tracked |
| Deterministic fixtures | `scripts/seed-api-data.js` | 3 users (profile fields + `role` reset, non-fixture accounts purged), 10 orders — one per state × 2 owners, coupon_usage cleared |
| Lockout reset | `scripts/reset-lockout.js` | — |
| Postman environment | `postman/environments/local.postman_environment.json` | 27 variables, resolves under Newman |
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
| **T1** | ~~Confirm API trio with groupmates (§5 non-duplication)~~ — **DONE 2026-08-18**, trio frozen | note in `report.md` | — |
| **A1-G** | API 1 `PUT /api/users/me` — generate via the 6 stages of `api-testcase-generator` | `docs/api1-users-me/generated.md` (**≥35**) | `feat(api1): AI-generated test cases (stages S1-S6)` |
| **A1-A** | Audit: VALID / INVALID / INCOMPLETE + corrections | `docs/api1-users-me/audit.md` | `docs(api1): human audit of generated cases` |
| **A1-E** | Extend: ≥5 human cases + why the AI missed each | `docs/api1-users-me/extended.md` | `feat(api1): human-added cases the AI missed` |
| **A1-X** | Build + run the collection | `postman/collections/API1-UsersMe...json`, `reports/api1-usersme.html` | `test(api1): Postman collection and Newman run` |
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

| Stage | API 1 `PUT /api/users/me` | API 2 apply-coupon | API 3 admin order status |
|---|---|---|---|
| S2 domain partitions | **~18** — `phone` ×9 (9/10/11/12 digits, leading `0` vs not, `+84` form, letters, empty, symbols), `name` ×4 (empty, 1 char, very long, unicode/emoji), `shipping_address` ×3, plus omitted-field and wrong-type cases | ~14 (`code`, `total_amount` incl. the exact 300k/500k thresholds, `user_id`, types) | ~8 (`status` enum incl. unknown/empty/case, `:id` non-numeric/absent/huge) |
| S3 state transitions | ~6 — the **privilege state** `user → admin → user` (does a stale token keep the old claim?), and the **profile-completeness state** set → partial-update → wiped → restored | ~5 (usage count vs `max_uses_per_user`, incl. exactly-at-limit) | **~25** (full 5×5 matrix + the two final states) |
| S4 security | ~10 — SEC-06 `role` mass assignment (the flagship), `email` immutability, `id`/`password`/`login_attempts` mass assignment, SEC-02 (absent/malformed/other-user token), cross-user write attempt, SEC-04 XSS payload persisted in `name` | ~7 (SEC-02 no-auth, IDOR via body `user_id`, quota bypass by omission, injection on `code`) | ~9 (SEC-03 user token, no token, malformed token, cross-user, escalation chain via SEC-06) |
| S5 schema | ~6 — response shape `{message}`, error shape, and on the companion `GET /api/users/me` the **absence** of `password`, `reset_token`, `login_attempts` | ~6 (`discount_amount`/`final_amount` types and sign, `success`, error shape) | ~5 (message shape, 400/404 error shape, no state leak) |
| **Total** | **~40** | **~32 + ≥5 extended** | **~47** |

API 2 lands closest to the floor; its data-driven CSV run is where the extra rows come from.

Two notes on API 1's shape. Its S2 count is high and its S3 count is low, which is honest rather than convenient — FR-04 is a validation-heavy endpoint with only a shallow state model, and API 3 carries the state-transition dimension for the suite. And the `phone` rule is the single best boundary surface in the SUT: FR-04 gives an exact numeric range (10–11 digits) *and* a prefix rule, so 9/10/11/12-digit values with and without the leading `0` are all derivable from the spec rather than invented.

---

## 5. Expected findings (hypotheses — each must be reproduced before it is filed)

Ordered by severity. Every one traces to a numbered fact in §1.

| # | Fact | API | Severity | Requirement violated |
|---|---|---|---|---|
| BUG-01 | §1.4 `PUT /api/users/me` accepts `role` — self-promotion to admin **[✓ reproduced]** | 1 | **Critical** | SEC-06, FR-04 |
| BUG-02 | §1.13 no `role` check on `/api/admin/*` — any user drives the order state machine | 3 | **Critical** | SEC-03, FR-12 |
| BUG-03 | §1.10 percent discount inverted — a 10% coupon multiplies the total ~10× | 2 | **Critical** | FR-09 formula |
| BUG-04 | §1.8 + §1.9 plaintext passwords, returned by `GET /api/users/me` **[✓ reproduced]** | 1 | **Critical** | SEC-01 |
| BUG-05 | §1.14 `canceled → delivered` accepted | 3 | High | FR-10 final states |
| BUG-06 | §1.12 `apply-coupon` unauthenticated; per-user quota bypassed | 2 | High | FR-09 C4/C5, SEC-02 |
| BUG-07 | §1.15 `GET /api/orders/:id` unauthenticated IDOR | 3 | High | SEC-02 |
| BUG-08 | §1.6 partial update silently NULLs `shipping_address` and `phone` **[✓ reproduced]** | 1 | High | FR-04 (data loss) |
| BUG-09 | §1.5 no validation on `phone` / `name` / `shipping_address` — `"abc"` accepted as a phone **[✓ reproduced]** | 1 | Medium | FR-04 phone format |
| BUG-10 | §1.11 coupon threshold `>` instead of `>=` | 2 | Medium | FR-09 C3 |
| BUG-11 | §1.16 JWT never expires, hard-coded secret | 1,3 | Medium | SEC-02 |
| BUG-12 | §1.18 swallowed DB errors return 200 with `undefined` fields | 2,3 | Low | — |

Note the chain BUG-01 → BUG-02: a brand-new account reaches full admin in two requests. Reported as one escalation path with two component defects, not as two unrelated tickets — the severity is in the composition.

**Not bugs, reported as tested-and-passed negative results:** `email` is correctly rejected as a mutable field (§1.7), and the three chosen endpoints are all parameterised against SQL injection (§1.17). Both were tested; saying so is worth more than silently dropping the cases.

---

## 6. Postman features to exercise (§6 — must be listed in the report)

Planned, with where each will actually be used — a feature list without a use is not evidence.

| Feature | Where |
|---|---|
| Workspace | One HW06 workspace holding all three collections |
| Collections + folders | One per API, foldered by generation stage S2–S5 |
| Environment | `EShop Local (HW06)`, 27 variables, secrets typed as `secret` |
| Collection variables | Static per-API constants that must not vary by environment |
| Pre-request scripts | Collection-level `X-Student-Id`; request-level token acquisition |
| Test scripts + chai assertions | One `pm.test` per assertion, named by case ID |
| Dynamic variables | `{{$randomFullName}}`, `{{$timestamp}}` to keep API 1's profile writes distinguishable between runs |
| **Data-driven runs** | `postman/data/phone-cases.csv` (API 1 — the 9/10/11/12-digit × leading-`0` matrix is a natural table) and `postman/data/coupon-cases.csv` (API 2), through the Collection Runner / `newman -d` |
| Newman CLI + htmlextra | `scripts/run-newman.js` |
| **Mock server** | A mock of `apply-coupon` returning the **spec-correct** response, to demonstrate the assertions pass against a correct implementation and that BUG-03 is in the SUT, not in my test |
| **Monitor** | Scheduled run of a small health subset against the mock (the local SUT is not reachable from Postman cloud — this limitation gets stated, not hidden) |
| Newman in CI | `.github/workflows/api-tests.yml` |

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Group-duplicate API selection (§5) — hit once on `POST /api/login`, **now closed** | Trio confirmed against the group 2026-08-18, before any generation. Residual risk is a groupmate changing *their* selection later; that surfaces as a conflict on their side, not silently on mine |
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
