# API 2 — `POST /api/apply-coupon` (FR-09) — Human Audit of AI-Generated Test Cases

**Student:** 23127396 · **Audited:** 2026-08-18
**Source:** [`generated.md`](file:///C:/Users/Khoi/Downloads/23127396_HW06_AI_API_090/docs/api2-apply-coupon/generated.md)
**Oracles:** Spec = FR-09 C1–C5 + formula, SEC-02, SEC-05 · Impl = [`server.js:362-441`](file:///C:/Users/Khoi/Downloads/23127396_HW06_AI_API_090/sut/backend/server.js#L362-L441) (`apply-coupon`), [`:443-451`](file:///C:/Users/Khoi/Downloads/23127396_HW06_AI_API_090/sut/backend/server.js#L443-L451) (`coupon-usage`), [`:457-486`](file:///C:/Users/Khoi/Downloads/23127396_HW06_AI_API_090/sut/backend/server.js#L457-L486) (admin coupon CRUD), [`database.js:29-38,106-110`](file:///C:/Users/Khoi/Downloads/23127396_HW06_AI_API_090/sut/backend/database.js#L29-L38) (schema + seed values)

**The single most important fact this audit found, that the generation stage could not have known:**
`apply-coupon` **never writes to `coupon_usage`**. It only ever `SELECT COUNT(*)`s it (line 388).
The only endpoint that inserts a usage row is the separately-authenticated `POST /api/coupon-usage`
(line 443-451), which is called "after successful checkout" per its own comment and keys the insert
on `req.user.id` from the token — **not** on any body field. Every S3 case assumed a single
`apply-coupon` call both previews *and* consumes a use; that assumption is false, and it invalidates
every S3 case as originally written. See the S3 table below.

---

## Audit Labels

| Label | Count |
|---|---|
| **VALID** | 2 |
| **INVALID** | 9 |
| **INCOMPLETE** | 22 |

The high INCOMPLETE count mirrors API 1's audit for the same reason: the generation stage correctly
left an assertion as `UNDETERMINED` whenever the spec alone didn't determine it (per the generator's
own no-guessing rule) — reading `server.js` now resolves nearly all of them to a concrete value.

---

## S2 — Domain Partitions

| ID | Label | Reasoning | Correction (if any) |
|---|---|---|---|
| A2-S2-01 | **INCOMPLETE** | Right happy-path case, but "discount_amount/final_amount per formula" was left abstract and doesn't flag that the SUT's formula is wrong. `server.js:398-401`: for `type==="percent"`, `discount_amount = Math.floor(total_amount * (1 - coupon.discount_value))`. `SAVE10.discount_value = 10` (an integer, `database.js:107` — **not** `0.1`), so for `total_amount=500000`: `500000 * (1-10) = -4,500,000`, `final_amount = 500000 - (-4500000) = 5,000,000`. | **Correction:** Assert the **spec-correct** values: `discount_amount=50000`, `final_amount=450000` (FR-09: `total × discount_value / 100`). Tag `EXPECTED-FAIL` → BUG-03 — confirmed by source, not just predicted. Also note the response literal (`server.js:407-413`) includes `success` (bool) and `message` (string) beyond the two spec-mandated fields — not a violation, spec doesn't say "only these". |
| A2-S2-02 | **INVALID** | Expected 400 was a guess. `server.js:373-376`: no matching `code` (including a genuinely nonexistent one) returns **404**, not 400. | **Correction:** Expected status = **404**. Body = `{"error":"Mã giảm giá không tồn tại hoặc đã bị vô hiệu hóa"}`. Not `EXPECTED-FAIL` — spec doesn't mandate a status code, so 404 is a legitimate implementation choice. Carries the merged S5-04 assertion: body MUST NOT contain `discount_amount`/`final_amount` — confirmed, the error branch returns only `{error}`. |
| A2-S2-03 | **INVALID** | Precondition ("a deactivated coupon row") is **not producible through any API in this SUT**. `POST /api/admin/coupons` (`server.js:457-480`) never sets `is_active` in its INSERT column list; the schema default is `1` (`database.js:36`). `DELETE /api/admin/coupons/:id` (`server.js:483-486`) is a **hard delete**, not a soft-deactivate. There is no PUT/update-coupon endpoint. | **Correction:** Not executable via the harness as an end-to-end API test. Options for A2-X: (a) drop the case, or (b) add one extra fixture coupon with `is_active=0` directly via `scripts/seed-api-data.js` (bypassing the API, same category as API1's `A1-S3-05` fix — document the fixture as a deliberate DB seed, not an API-driven precondition). Recommend (b) since C1's `is_active` clause is otherwise completely untested. |
| A2-S2-04 | **INCOMPLETE** | Right idea. `EXPIRED` has `min_order_amount=100000` (`database.js:110`); `total_amount=500000 > 100000` is true, so the handler proceeds past the C3 check and reaches the expiry check at `server.js:381-384`: `new Date("2020-01-01") < new Date()` → true → 400. | **Correction:** Body = `{"error":"Mã giảm giá đã hết hạn"}` (`server.js:383`). |
| A2-S2-05 | **INCOMPLETE** | Right idea, wrong branch identified. `server.js:366-367`: `if (!code)` fires **before** the DB lookup — `""` is falsy — so this is a *different* error than "not found" (A2-S2-02), with a different message. | **Correction:** Body = `{"error":"Vui lòng nhập mã giảm giá"}`. Distinguish explicitly from A2-S2-02's message in the Postman assertion so the two 400/404 paths aren't conflated. |
| A2-S2-06 | **INCOMPLETE** | `!12345` is `false`, so the `!code` guard is passed and the value reaches `db.get("...code = ?...", [12345], ...)`. SQLite's column-affinity coercion for a TEXT column against a bound INTEGER parameter is the correct oracle here, and it is not fully certain from static reading alone. | **Correction:** Predicted 404 (no coupon code is a string of literal digits matching `12345`), but flagged for **live verification during A2-X** rather than asserted with full confidence — this is a genuine "verify empirically" case, not a guess. |
| A2-S2-07 | **INCOMPLETE** | Same guard as A2-S2-05 — `!undefined` is `true`. | **Correction:** Body = `{"error":"Vui lòng nhập mã giảm giá"}`, same as A2-S2-05. |
| A2-S2-08 | **INCOMPLETE** | Right premise (spec says `>=`, boundary itself must pass) but missing the `EXPECTED-FAIL` tag. `server.js:379`: `if (total_amount > coupon.min_order_amount)` — **strict** `>`. `300000 > 300000` is `false`, so the handler falls to the `else` at `:434-438` → 400, not 200. This is the flagship BUG-10 case, now confirmed by source rather than predicted. | **Correction:** Keep expected = 200 (spec-correct). Tag `EXPECTED-FAIL` → BUG-10. Actual SUT response: 400 `{"error":"Đơn hàng chưa đủ giá trị tối thiểu 300.000 ₫ để áp dụng mã này"}` (exact thousands-separator depends on `toLocaleString()` locale — match on substring, not exact string). |
| A2-S2-09 | **INCOMPLETE** | Both oracles already agreed (400) — the case just needed a concrete body instead of `UNDETERMINED`. | **Correction:** Body = `{"error":"Đơn hàng chưa đủ giá trị tối thiểu 300.000 ₫ để áp dụng mã này"}` (same branch as A2-S2-08's actual result, `server.js:436`). |
| A2-S2-10 | **INCOMPLETE** | `300001 > 300000` is true, so this reaches the (also percent-buggy) formula: `Math.floor(300001 * (1-10)) = Math.floor(-2700009) = -2700009`; `final_amount = 300001 - (-2700009) = 3000010`. Same BUG-03 as A2-S2-01. | **Correction:** Spec-correct expected: `discount_amount = 30000.1` (FR-09 gives no rounding rule for a non-integer percent result — flag this sub-point as itself `UNDETERMINED` in the spec), `final_amount ≈ 270000.9`. Tag `EXPECTED-FAIL` → BUG-03. |
| A2-S2-11 | **INCOMPLETE** | `0 > 300000` is false regardless of the `>`/`>=` bug — both oracles agree this must reject. Needed a concrete body only. | **Correction:** Body = same "chưa đủ giá trị tối thiểu" message. Not `EXPECTED-FAIL` — outcome is correct either way. |
| A2-S2-12 | **INCOMPLETE** | Same reasoning as A2-S2-11 — negative total also fails C3 regardless of the operator bug. | **Correction:** Body = same message. Not `EXPECTED-FAIL`. |
| A2-S2-13 | **INCOMPLETE** | `"abc" > 300000` → JS coerces `"abc"` to `NaN`; `NaN > 300000` is `false` → same 400 "insufficient amount" branch, even though the *real* problem is an invalid type, not an insufficient total. The error message is misleading (blames the amount, not the type) but the status/branch is deterministic. | **Correction:** Status = 400, body = the same "chưa đủ giá trị tối thiểu" message. **Flag for A2-E:** the misleading error message on type-invalid input is a minor UX/diagnostics defect worth a human-added case — the AI could not have found this without tracing the `>` comparison's JS type-coercion behavior. |
| A2-S2-14 | **INCOMPLETE** | `undefined > 300000` → `false` → same branch as A2-S2-13. | **Correction:** Same as A2-S2-13. |
| A2-S2-15 | **INVALID (duplicate)** | The prediction ("omitted `user_id` shouldn't itself be an error") was directionally right but for the wrong reason, and it duplicates a case that belongs in S4. `server.js:386`: `if (user_id) { ...quota check... } else { ...quota check skipped entirely... }` — omitting `user_id` doesn't just avoid an error, it **bypasses C5 completely**, which is a security-significant finding, not a plain domain-partition observation. | **Correction:** Merge into A2-S4-04, which already targets exactly this code path under the security lens. Do not keep two cases asserting the same request. |
| A2-S2-16 | **INCOMPLETE** | `user_id: "2"` (string) reaches `db.get(..., [coupon.id, user_id], ...)` against an `INTEGER`-affinity column (`database.js`'s `coupon_usage` — not shown above but implied by `user_id` usage throughout). SQLite's NUMERIC/INTEGER affinity coercion should convert `"2"` → `2` for comparison, making this behave identically to the numeric case. Not 100% certain from static reading alone. | **Correction:** Predicted: identical behavior to `user_id: 2`. Flagged for live verification at A2-X, same caveat as A2-S2-06. |

---

## S3 — State Transitions

**Every case in this stage assumed `apply-coupon` itself increments the usage counter. It does not
— confirmed by re-reading the full handler (`server.js:362-441`): the only database write anywhere
in the function is none; it is entirely read-only (`SELECT` at :370 and :388). The counter only
moves via `POST /api/coupon-usage` (:443-451), a separate, authenticated endpoint. Every case below
is corrected to insert that call as an explicit step wherever the original assumed consumption.**

| ID | Label | Reasoning | Correction (if any) |
|---|---|---|---|
| A2-S3-01 | **INVALID** | As written, a single `apply-coupon` call cannot move `usage_count` from 0 to 1 — nothing is ever inserted by this handler. | **Correction — repurposed as a new finding:** "Preview-only calls never consume a use." Steps: 1. `POST /api/apply-coupon` (`SAVE10`, `user_id=2`, fresh) → 200. 2. Repeat the identical call immediately, **without** calling `/api/coupon-usage` in between → **still 200** (not rejected), because `usage_count` in the DB never changed. This shows C5 is only enforced against usage that the *client* separately chose to record — a single-use coupon can be "successfully applied" an unlimited number of times as long as the caller never calls `/api/coupon-usage`. Not tagged against a numbered SEC/FR requirement (the spec doesn't define "preview" vs. "commit" semantics), but flagged in the Audit Summary below as a candidate defect for the report, since it's the kind of thing that undermines C5's practical guarantee. |
| A2-S3-02 | **INVALID** | Same wrong assumption — "second use" requires an intervening record step. | **Correction:** Steps: 1. `POST /api/apply-coupon` (`SAVE10`, `user_id=2`) → 200. 2. `POST /api/coupon-usage {"coupon_id": <SAVE10's id>}` `Auth: Bearer {{userToken}}` → 200 (records the use; uses `req.user.id`, `server.js:445-448`). 3. `POST /api/apply-coupon` (`SAVE10`, `user_id=2`) again → **400** `{"error":"Bạn đã sử dụng mã này 1 lần (đã đạt giới hạn)"}` (`server.js:391-394`). This is a **passed negative result**: C5's `usage_count >= max_uses_per_user` comparison is correctly `>=`, unlike C3's incorrectly-`>` threshold check (BUG-10) — worth stating explicitly in the report as something tested and found correct. |
| A2-S3-03 | **INVALID** | Same wrong assumption for `VIP100` (`max_uses_per_user=2`). | **Correction:** Steps: 1. Apply `VIP100` (`user_id=2`, fresh) → 200, `discount_amount=100000` (fixed type — **not** affected by BUG-03, since only the `percent` branch (`:398-401`) is broken). 2. Record via `/api/coupon-usage`. 3. Apply `VIP100` again → 200 (`usage_count=1 < 2`), `discount_amount=100000` again. 4. Record again. |
| A2-S3-04 | **INVALID** | Depends on A2-S3-03's corrected setup to reach `usage_count=2`. | **Correction:** Continues from corrected A2-S3-03 (`usage_count(2, VIP100) = 2`). Step 5: apply `VIP100` a third time → **400** `{"error":"Bạn đã sử dụng mã này 2 lần (đã đạt giới hạn)"}`. Exact-limit boundary, confirmed correct (`>=` comparison, same passed-negative-result note as A2-S3-02). |
| A2-S3-05 | **INVALID** | "User A has exhausted `SAVE10`" precondition depended on the broken A2-S3-01/02 mechanism. | **Correction:** Precondition must be built via the corrected A2-S3-02 sequence (apply → record → apply-rejected) for user A (id=2), *then* as user B (id=3, never applied or recorded `SAVE10`): `POST /api/apply-coupon {"code":"SAVE10","total_amount":500000,"user_id":3}` → 200. Confirms C5's `WHERE coupon_id = ? AND user_id = ?` (`server.js:388`) is correctly scoped per-user — another passed negative result. |

---

## S4 — Security

| ID | Label | Reasoning | Correction (if any) |
|---|---|---|---|
| A2-S4-01 | **INCOMPLETE** | Right expectation (401 per spec), missing confirmation that this is a real, source-confirmed gap. `app.post("/api/apply-coupon", (req, res) => {...})` at `server.js:363` — **no `authenticateToken` middleware**, unlike the sibling `GET /api/coupons` (`:356`) or `POST /api/checkout` (`:297`) which both have it. A missing `Authorization` header is never even inspected. | **Correction:** Actual = 200, full success/preview response, regardless of any header. Tag `EXPECTED-FAIL` → BUG-06 — confirmed by the route declaration itself, not merely predicted. |
| A2-S4-02 | **INCOMPLETE** | Same root cause as A2-S4-01 — since no middleware reads the header at all, a malformed token is never parsed, let alone rejected. | **Correction:** Actual = 200. Tag `EXPECTED-FAIL` → BUG-06. |
| A2-S4-03 | **INCOMPLETE** | The original framing ("own token, but body names another user") overstates what's required — there is no token check *at all* here, so "own token" is irrelevant; **any** caller, authenticated or not, can name any `user_id`. `server.js:386-395`: the quota check is keyed purely on the body's `user_id`, with zero cross-check against any identity. | **Correction — retitled:** "Arbitrary `user_id` in body discloses another user's coupon-usage state with no authentication at all." Request: `{"code":"SAVE10","total_amount":500000,"user_id":3}`, no `Authorization` header needed. If user 3 has quota remaining → 200 (full discount preview for user 3's account); if exhausted → 400 with the exact "used N times" message, revealing user 3's usage count to an unrelated caller. Tag `EXPECTED-FAIL` → BUG-06. |
| A2-S4-04 | **INCOMPLETE** | Correctly identified the bypass, but left the outcome `UNDETERMINED`. `server.js:386`: `if (user_id) {...} else {...}` — the `else` branch (`:416-433`) skips the quota check block **entirely** and goes straight to computing the discount. This is the cleanest, most directly confirmable instance of BUG-06. | **Correction:** Expected(spec) = C5 must still be checked; actual = 200 unconditionally (subject only to C1–C3), regardless of any prior usage by anyone. Tag `EXPECTED-FAIL` → BUG-06. Cross-reference: combined with A2-S3-01's finding (preview calls never write usage), this means C5 can be defeated two independent ways — by never calling `/api/coupon-usage`, or by simply omitting `user_id`. |
| A2-S4-05 | **INVALID** | The premise — "repeatedly calling `apply-coupon` with the victim's `user_id` burns their quota" — is false. `apply-coupon` never writes to `coupon_usage` (see the note at the top of S3). The only write path, `/api/coupon-usage` (`server.js:443-451`), is authenticated and inserts under `req.user.id` from the token, **ignoring** any body field — an attacker cannot make it write against a `user_id` other than their own. So the described DoS/exhaustion attack is not achievable through any exposed endpoint; only the read-only disclosure in A2-S4-03 is. | **Correction — repurposed:** "`/api/coupon-usage` correctly scopes writes to the token's own identity (passed negative result)." As user A, `POST /api/coupon-usage {"coupon_id": <id>}` — assert the resulting row's `user_id` in the DB (or via a follow-up `apply-coupon` quota check as user A) reflects A's own id regardless of any extra `user_id` field added to the body (the handler destructures only `coupon_id`, `server.js:445`, so a spoofed `user_id` in the body is silently ignored). Not `EXPECTED-FAIL` — this is implemented correctly. |
| A2-S4-06 | **INCOMPLETE** | Right technique and premise, wrong status code (inherits A2-S2-02's fix). `server.js:370`: `code = ?` is parameterized — the injection string is bound as a literal, matches no real coupon code, and the same not-found path as A2-S2-02 fires. | **Correction:** Expected status = **404** (not 400), same body shape as A2-S2-02. Negative-result framing (SEC-05 satisfied) is otherwise correct and unchanged. |
| A2-S4-07 | **INCOMPLETE** | The mass-assignment check itself is correct (`server.js:364` destructures only `code, total_amount, user_id` — client-sent `discount_amount`/`final_amount` are never read), but using `SAVE10` (percent) entangles this assertion with the unrelated BUG-03 formula bug, since the server's *own* computed value is also wrong. | **Correction:** Switch to `VIP100` (fixed type, unaffected by BUG-03) so the case cleanly isolates the mass-assignment dimension: `{"code":"VIP100","total_amount":500000,"user_id":2,"discount_amount":999999,"final_amount":1}` → 200, `discount_amount=100000`, `final_amount=400000` (the server's own correct, formula-computed values — client's injected values fully ignored). |

---

## S5 — Schema Validation

*A2-S5-04 (error response shape) remains merged into A2-S2-02, as in `generated.md`.*

| ID | Label | Reasoning | Correction (if any) |
|---|---|---|---|
| A2-S5-01 | **INCOMPLETE** | Assertion was under-specified. `server.js:407-413`: the literal response is `{success, coupon_id, discount_amount, final_amount, message}` — two more fields than the spec mandates. | **Correction:** Add assertions for `success` (boolean, `true`) and `coupon_id` (number, matches the applied coupon's id) alongside the originally-planned `discount_amount`/`final_amount`. Not a violation to have extra fields — spec says "contains", not "contains only". |
| A2-S5-02 | **VALID** | Formula and bounds assertion is the right shape; exact values already resolved in the S2 audit (A2-S2-01) and carried the `EXPECTED-FAIL` tag correctly in `generated.md`. | — |
| A2-S5-03 | **VALID** | Same as A2-S5-02 for `final_amount`; correctly written as `>= 0` (a spec-implied sanity bound, not a stated rule) and already tagged. | — |
| A2-S5-05 | **VALID** | Correct. `res.json()` always sets `Content-Type: application/json; charset=utf-8`. Both oracles agree — not derived from a specific line, this is Express's own behavior. | — |
| A2-S5-06 | **VALID** | Correct and confirmed. The success-response literal at `server.js:407-413` is hand-built field-by-field from the fetched `coupon` row — it does **not** spread the row, so `is_active`, `max_uses_per_user`, `type`, `discount_value`, `expired_at` are genuinely absent despite the full row being fetched into memory at `:370`. Passed negative result. | — |

---

## Audit Summary

### Corrections Applied

| ID(s) | Original Issue | Fix Applied |
|---|---|---|
| A2-S2-01, A2-S2-10 | Abstract "per formula" expectation, no bug tag | Concrete spec-correct numbers + `EXPECTED-FAIL` → BUG-03 |
| A2-S2-02, A2-S4-06 | Guessed status 400 | Corrected to 404 (`server.js:373-376`) |
| A2-S2-03 | Non-executable precondition (no API can create `is_active=0`) | Flagged for A2-X: needs a direct-DB seed fixture, not an API-driven setup |
| A2-S2-04, A2-S2-05, A2-S2-07, A2-S2-09, A2-S2-11–14 | `UNDETERMINED` body left unresolved | Concrete error bodies filled in from the exact branch each request hits |
| A2-S2-06, A2-S2-16 | Type-coercion outcome asserted with false confidence | Downgraded to "predicted, verify live at A2-X" — a legitimate epistemic state, not a guess |
| A2-S2-08 | Missing `EXPECTED-FAIL` tag on the flagship boundary case | Tagged → BUG-10, confirmed by source (`server.js:379`, strict `>`) |
| A2-S2-15 | Duplicate of a security-relevant case | Merged into A2-S4-04 |
| A2-S3-01–05 | **All five** assumed `apply-coupon` writes usage records; it never does | Rewritten with an explicit `POST /api/coupon-usage` step wherever consumption was assumed; A2-S3-01 repurposed into a new finding (preview-only calls never consume a use) |
| A2-S4-01–04 | Correct instinct, `UNDETERMINED` outcomes, or overstated preconditions ("own token") | Confirmed via the route declaration (no `authenticateToken` at all) and the `if(user_id)` branch; all four now `EXPECTED-FAIL` → BUG-06 with concrete actual values |
| A2-S4-05 | False premise — apply-coupon can't write usage, so it can't be used to exhaust a victim's quota | Repurposed into a passed-negative-result case for `/api/coupon-usage`'s correct token-scoping |
| A2-S4-07 | Coupled an unrelated dimension (mass assignment) to the formula bug by using `SAVE10` | Switched to `VIP100` (fixed type) to isolate the assertion |
| A2-S5-01 | Missed two response fields that are actually present | Added `success`/`coupon_id` assertions |

### Bugs Surfaced by Audit

| Bug ID | Cases | Finding |
|---|---|---|
| BUG-03 | A2-S2-01, A2-S2-10, A2-S5-02, A2-S5-03 | Percent-type discount formula computes `total × (1 − discount_value)` instead of `total × discount_value / 100` — confirmed by source, exact numbers traced (`SAVE10` on 500,000 → `final_amount = 5,000,000` instead of `450,000`) |
| BUG-06 | A2-S4-01, A2-S4-02, A2-S4-03, A2-S4-04 | `POST /api/apply-coupon` has **no authentication middleware at all** (confirmed at the route declaration, `server.js:363`) — any caller, with or without a token, can query or apply against any `user_id`, and omitting `user_id` entirely skips the C5 quota check outright |
| BUG-10 | A2-S2-08 | Threshold check uses `>` (`server.js:379`) instead of the spec's stated `>=` — an order of exactly `min_order_amount` is wrongly rejected |
| **Candidate** (not in `PLAN.md`'s original list — surfaced by this audit) | A2-S3-01 | `apply-coupon` never records a use by itself; C5's guarantee only holds if the client separately calls `POST /api/coupon-usage`. A client that only ever calls `apply-coupon` can "successfully apply" a single-use coupon an unlimited number of times. Recommend adding to `PLAN.md`'s bug table at the report stage (e.g. `BUG-13`) — not asserted here as a numbered bug since that list is the plan's source of truth and this audit shouldn't silently renumber it. |

### AI Failure Patterns Observed

1. **Assumed a single endpoint call both previews and commits.** All five S3 cases (and the security
   framing of A2-S4-05) treated `apply-coupon`'s quota *check* as if it were also the quota
   *consumption* step. The spec's own API listing (§5.1 vs. a separate, unlisted-in-the-generation-
   prompt `/api/coupon-usage`) doesn't distinguish "preview" from "commit" in the text the generator
   was given — this is a structural blind spot from prompting one endpoint at a time (per the
   generator's own methodology), not a hallucination.
2. **`UNDETERMINED` overuse**, same pattern API 1's audit found — 16 of 33 cases left a concrete,
   derivable-from-code outcome as `UNDETERMINED` rather than committing to a value. Most were resolved
   without ambiguity by reading the single `if`/`else` branch the request falls into.
3. **Guessed status codes where the spec is silent.** A2-S2-02 and A2-S4-06 both assumed 400 for "not
   found"; the implementation's actual choice (404) is a legitimate but unpredictable design decision
   that can only be discovered by reading the code, not inferred from the spec text.
4. **Overstated preconditions from convention.** A2-S4-03 said "own token, but body names another
   user" — importing the mental model of a *normal* authenticated IDOR case onto an endpoint that, in
   this SUT, requires no token at all. The real case is strictly worse than what was generated.
5. **Coupled independent test dimensions.** A2-S4-07 (mass assignment) and A2-S2-01/10 (formula) both
   defaulted to the same "happy path" coupon (`SAVE10`), which is exactly the one coupon carrying the
   percent-formula bug — accidentally entangling two separate findings in one assertion instead of
   testing each dimension against a coupon that isolates it.
