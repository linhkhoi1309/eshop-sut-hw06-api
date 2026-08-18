# API 2 — `POST /api/apply-coupon` (FR-09) — AI-Generated Test Cases

**Student:** 23127396 · **Generated:** 2026-08-18 · **AI:** Claude Sonnet 5
**Endpoint:** `POST /api/apply-coupon`
**Spec refs:** FR-09 (C1–C5, discount formula), FR-08 (server owns monetary computation, by
analogy), SEC-02, SEC-05

---

## S1 — Parameter Inventory

| Parameter | Source | Type | Required/Optional | Spec Constraints | Notes |
|:---|:---|:---|:---|:---|:---|
| `code` | Body | String | Required (implied) | Must exist in DB, `is_active = 1` (C1), not past `expired_at` (C2). | No stated case-sensitivity rule. |
| `total_amount` | Body | Number | Required (implied) | Must be `>= min_order_amount` (C3, spec states `>=` explicitly). | No stated type-coercion rule. |
| `user_id` | Body | Integer | **Conflicting** | Shown in API §5.1's body, but FR-09 C4 requires a valid JWT for identity. | Body-supplied identity next to an auth-required condition — a classic IDOR shape. |
| `Authorization` | Header | String | **Undetermined** | Absent from §5.1's example; required by FR-09 C4. | Spec is internally inconsistent — test both readings. |
| Coupon DB record | DB State | Record | Required | `type`, `discount_value`, `min_order_amount`, `expired_at`, `max_uses_per_user`, `is_active`. | Seeded: `SAVE10` (percent 10%, min 300k, max 1), `BIGBUY` (fixed 50k, min 500k, max 1), `VIP100` (fixed 100k, min 300k, max 2), `EXPIRED` (percent 20%, expired). |
| Coupon usage count | DB State (implicit) | Integer | Required for C5 | Per-`(user, code)` counter vs. `max_uses_per_user`. | Drives S3. |
| Current date/time | Implicit | Date | Required for C2 | Compared against `expired_at`. | Not client-controlled. |

---

## S2 — Domain Partitions (18 cases)

| ID | Title | Technique | Preconditions | Request | Expected Status | Expected Body | Spec Justification |
|---|---|---|---|---|---|---|---|
| A2-S2-01 | code — valid, active, all conditions met (happy path) | EP | Logged in, quota unused | `{"code":"SAVE10","total_amount":500000,"user_id":2}` | 200 | `discount_amount`/`final_amount` per formula | API §5.1 + FR-09 formula |
| A2-S2-02 | code — does not exist in DB | EP | None | `{"code":"NOTREAL","total_amount":500000,"user_id":2}` | 400 | Rejected; MUST NOT contain `discount_amount`/`final_amount` (error shape — merged from A2-S5-04) | FR-09 C1 |
| A2-S2-03 | code — exists but `is_active = 0` | EP | Needs a deactivated coupon row (not seeded by default) | `{"code":"<inactive-code>","total_amount":500000,"user_id":2}` | 400 | UNDETERMINED | FR-09 C1: "đang hoạt động" |
| A2-S2-04 | code — exists, active, but expired (`EXPIRED`) | BVA | Logged in | `{"code":"EXPIRED","total_amount":500000,"user_id":2}` | 400 | UNDETERMINED | FR-09 C2 |
| A2-S2-05 | code — empty string | EP | None | `{"code":"","total_amount":500000,"user_id":2}` | 400 | UNDETERMINED | Cannot satisfy C1 |
| A2-S2-06 | code — wrong type (number) | EP | None | `{"code":12345,"total_amount":500000,"user_id":2}` | UNDETERMINED | UNDETERMINED | No type-validation rule stated |
| A2-S2-07 | code — omitted field | EP | None | `{"total_amount":500000,"user_id":2}` | UNDETERMINED | UNDETERMINED | §5.1 body always shows `code` |
| A2-S2-08 | total_amount — exactly at threshold (300,000) | BVA | Logged in, quota unused | `{"code":"SAVE10","total_amount":300000,"user_id":2}` | 200 | `discount_amount=30000`, `final_amount=270000` | FR-09 C3: "**>=**" — the boundary itself must pass |
| A2-S2-09 | total_amount — just below threshold (299,999) | BVA | Logged in | `{"code":"SAVE10","total_amount":299999,"user_id":2}` | 400 | UNDETERMINED | FR-09 C3 |
| A2-S2-10 | total_amount — just above threshold (300,001) | BVA | Logged in, quota unused | `{"code":"SAVE10","total_amount":300001,"user_id":2}` | 200 | `discount_amount=30000.1`, `final_amount=270000.9` | FR-09 C3 |
| A2-S2-11 | total_amount — zero | EP | None | `{"code":"SAVE10","total_amount":0,"user_id":2}` | 400 | UNDETERMINED | `0 < min_order_amount` for every seeded coupon |
| A2-S2-12 | total_amount — negative | EP | None | `{"code":"SAVE10","total_amount":-500000,"user_id":2}` | 400 | UNDETERMINED | Not a valid order total |
| A2-S2-13 | total_amount — non-numeric (string) | EP | None | `{"code":"SAVE10","total_amount":"abc","user_id":2}` | UNDETERMINED | UNDETERMINED | No type-validation rule stated |
| A2-S2-14 | total_amount — omitted field | EP | None | `{"code":"SAVE10","user_id":2}` | UNDETERMINED | UNDETERMINED | §5.1 body always shows `total_amount` |
| A2-S2-15 | user_id — omitted field | EP | Logged in via valid JWT | `{"code":"SAVE10","total_amount":500000}` | UNDETERMINED | UNDETERMINED | FR-09 C4 implies token, not body, carries identity |
| A2-S2-16 | user_id — wrong type (string) | EP | None | `{"code":"SAVE10","total_amount":500000,"user_id":"2"}` | UNDETERMINED | UNDETERMINED | No type-validation rule stated |
| A2-S2-17 | code — case-sensitivity (lowercase vs. seeded uppercase) | EP | None | `{"code":"save10","total_amount":500000,"user_id":2}` | UNDETERMINED | UNDETERMINED | Spec states no case-folding rule for `code` |
| A2-S2-18 | total_amount — fractional value crossing a different coupon's threshold (`BIGBUY`, min 500,000) | BVA | Logged in, quota unused | `{"code":"BIGBUY","total_amount":500000.5,"user_id":2}` | 200 | `discount_amount=50000`, `final_amount=450000.5` | FR-09 C3 — a non-integer boundary crossing on a **fixed**-type coupon, independent of the `SAVE10`-based boundary cases above |

---

## S3 — State Transitions (5 cases)

State model: per-`(user, code)` `usage_count` starts at 0, increments on each success, and C5 must
reject once `usage_count == max_uses_per_user`. See `s3-state-transitions.md` for the full rationale.

| ID | Title | Technique | Preconditions | Request Steps | Expected Status | Expected Body | Spec Justification |
|---|---|---|---|---|---|---|---|
| A2-S3-01 | First use of a single-use coupon (0 → 1) | State Transition | User (id=2), `SAVE10` (max 1), unused | 1. `POST /api/apply-coupon` `{"code":"SAVE10","total_amount":500000,"user_id":2}` | 200 | Discount applied | FR-09 C5: `0 < 1` |
| A2-S3-02 | Second use of same single-use coupon, same user (1 → reject) | State Transition | Continues A2-S3-01 | 1. Repeat the same call | 400 | UNDETERMINED, but rejected | FR-09 C5: `1 < 1` is false |
| A2-S3-03 | Multi-use coupon within limit (0 → 1 → 2, `VIP100` max=2) | State Transition | User (id=2), `VIP100`, unused | 1. Apply 2. Apply again | 1. 200 2. 200 | Both succeed, `discount_amount=100000` each | FR-09 C5: `0<2`, `1<2` |
| A2-S3-04 | Multi-use coupon exactly at limit (2 → reject) | State Transition (boundary) | Continues A2-S3-03 | 1. Third apply | 400 | UNDETERMINED | FR-09 C5: `2 < 2` is false |
| A2-S3-05 | Per-user quota isolation | State Transition | User A (id=2) exhausted `SAVE10`; User B (id=3) unused | 1. As B, apply `SAVE10` | 200 | Succeeds — B's own count is 0 | FR-09 C5 is scoped per user |

---

## S4 — Security (9 cases)

| ID | Title | Technique | Preconditions | Request | Expected Status | Expected Body | Spec Justification |
|---|---|---|---|---|---|---|---|
| A2-S4-01 | C4/SEC-02: no `Authorization` header | Missing Auth | None | No header. `{"code":"SAVE10","total_amount":500000,"user_id":2}` | 401 | Rejected | FR-09 C4 + SEC-02 |
| A2-S4-02 | SEC-02: malformed/invalid JWT | Invalid Auth | None | `Auth: Bearer invalid_token` + same body | 401 or 403 | UNDETERMINED | SEC-02 |
| A2-S4-03 | IDOR: own token, `user_id` names another user | IDOR | User A (id=2); victim B (id=3) | `Auth: Bearer {{userAToken}}` `{"code":"SAVE10","total_amount":500000,"user_id":3}` | UNDETERMINED | Discount/usage MUST key on whichever identity the server actually trusts | FR-09 C4/C5 assume one trustworthy identity |
| A2-S4-04 | Quota bypass: `user_id` omitted | Missing Identity | None | `{"code":"SAVE10","total_amount":500000}` | UNDETERMINED | Must not silently grant unlimited use | FR-09 C5 |
| A2-S4-05 | Cross-user quota exhaustion (DoS on victim's allowance) | IDOR / Abuse | Attacker knows victim `user_id=3`; victim unused | Repeat `{"code":"SAVE10","total_amount":500000,"user_id":3}` until `max_uses_per_user` reached | UNDETERMINED | Victim's own later legitimate call must then be rejected by C5 | FR-09 C4 requires the *logged-in* user's own JWT |
| A2-S4-06 | SEC-05: SQL injection in `code` (negative result) | SQL Injection | None | `{"code":"' OR '1'='1","total_amount":500000,"user_id":2}` | 400 | No DB error; coupon simply not found | SEC-05 — expected PASS if parameterised |
| A2-S4-07 | Mass assignment: client supplies `discount_amount`/`final_amount` | Mass Assignment | Logged in | `{"code":"SAVE10","total_amount":500000,"user_id":2,"discount_amount":999999,"final_amount":1}` | 200 | Server-computed values MUST match the formula, ignoring client input | FR-08 (server owns monetary computation), FR-09 formula |
| A2-S4-08 | Malformed request body (wrong `Content-Type`, not JSON) | Malformed Input | None | `POST /api/apply-coupon` with `Content-Type: text/plain` and a raw string body `"code=SAVE10"` (not parsed as JSON) | UNDETERMINED | UNDETERMINED — likely falls into the `!code` 400 branch since an unparsed body leaves `req.body` empty | Robustness — spec doesn't define non-JSON handling |
| A2-S4-09 | Numeric overflow: `total_amount` far beyond safe integer range | Robustness / BVA | None | `{"code":"SAVE10","total_amount":999999999999999999999,"user_id":2}` | UNDETERMINED | UNDETERMINED — precision loss on a value beyond `Number.MAX_SAFE_INTEGER` could corrupt the discount computation silently rather than erroring | Spec gives no upper bound on `total_amount`; a real cart total cannot be unbounded |

---

## S5 — Schema Validation (6 cases, 1 de-duplicated)

*A2-S5-04 (error response shape) merged into A2-S2-02 — same request, same assertion scope.*

| ID | Title | Technique | Preconditions | Request | Expected Status | Expected Body Assertions | Spec Justification |
|---|---|---|---|---|---|---|---|
| A2-S5-01 | Success response shape — required fields present | Schema | Logged in, valid application | `{"code":"SAVE10","total_amount":500000,"user_id":2}` | 200 | Contains `discount_amount` (number), `final_amount` (number) | API §5.1 |
| A2-S5-02 | `discount_amount` — value and bounds | Schema/Formula | Same as S5-01 | Same request | 200 | `=== 50000`; `0 <= discount_amount <= total_amount` | FR-09 formula (percent) |
| A2-S5-03 | `final_amount` — value and non-negativity | Schema/Formula | Same as S5-01 | Same request | 200 | `=== 450000`; `>= 0` | FR-09: `final = total - discount` |
| A2-S5-05 | Response `Content-Type` is `application/json` | Header | Same as S5-01 | Same request | 200 | Header contains `application/json` | Implicit (`res.json`) |
| A2-S5-06 | Response does not leak internal coupon-record fields | Negative Schema | Same as S5-01 | Same request | 200 | MUST NOT include coupon's own `id`, `is_active`, `max_uses_per_user`, or another user's usage data | §5.1 states response = `discount_amount` + `final_amount` only |
| A2-S5-07 | `message` field content varies correctly by coupon type | Schema (exploratory) | Logged in | Two requests: `BIGBUY` (fixed) and `SAVE10` (percent), otherwise valid | 200 | `message` is a non-empty string; for a `fixed` coupon it should reference the currency-formatted `discount_value`, for a `percent` coupon the `%` value — exact wording UNDETERMINED, spec doesn't define message text | API §5.1 doesn't specify `message`; exploratory assertion of the observed response shape, same convention as API 1's S5 stage |

---

## S6 — Consolidation Summary

### Case Count

| Stage | Count | Notes |
|---|---|---|
| S2 Domain Partitions | 18 | 7 code, 7 total_amount, 2 user_id, 1 case-sensitivity, 1 fractional-boundary-on-a-second-coupon |
| S3 State Transitions | 5 | 2 single-use lifecycle, 2 multi-use lifecycle (incl. exact-limit boundary), 1 per-user isolation |
| S4 Security | 9 | 2 authentication, 3 IDOR/identity, 1 injection, 1 mass assignment, 2 malformed/robustness |
| S5 Schema | 6 | 3 success-shape/formula, 1 Content-Type, 1 absence, 1 message-content |
| **Total** | **38** | Exceeds the **≥35-per-API generation floor** (Requirement §6: "Provide the SUT's API specification to an AI tool... target ≥35 per API"). `PLAN.md` §4's own ~32 estimate was written before this floor was re-confirmed against the assignment text; the human-extension stage (A2-E) still adds ≥5 cases the AI structurally could not produce, on top of this |

### De-duplication Log

| Removed | Merged Into | Reason |
|---|---|---|
| A2-S5-04 (error response shape on rejected application) | A2-S2-02 | Same request (`code` not found), same response — one case now asserts both the business-rule outcome and the shape of the rejection |

### Expected Failures (assert spec, SUT predicted to violate — from `PLAN.md` §1.10–§1.12, source-read but **not yet live-reproduced**; confirming/refuting these is the job of the audit stage, A2-A)

| Case ID | Why it is predicted to fail against the SUT |
|---|---|
| A2-S5-02, A2-S5-03 | `PLAN.md` §1.10: the percent branch computes `total_amount * (1 - discount_value)` instead of `total × discount_value / 100`. For `SAVE10` (10%) on 500,000, spec gives discount 50,000/final 450,000; the implementation is predicted to give a wildly different (and much larger) `final_amount` — BUG-03. |
| A2-S2-08 | `PLAN.md` §1.11: the threshold check is predicted to use `>` instead of `>=` (`server.js:379`). An order of exactly `min_order_amount` (300,000) should pass per FR-09 C3's stated `>=`, but is predicted to be rejected — BUG-10. |
| A2-S4-01 | `PLAN.md` §1.12: the endpoint is predicted to have no `authenticateToken` call at all, so a request with no `Authorization` header is predicted to succeed rather than return 401 — part of BUG-06. |
| A2-S4-03, A2-S4-04, A2-S4-05 | Same fact — `user_id` is predicted to be trusted straight from the body with no cross-check against a token, making the IDOR and quota-bypass paths predicted to succeed rather than being rejected — BUG-06. |

### Not Predicted to Fail (untouched by the facts in `PLAN.md` §1)

A2-S3-\* (usage-count lifecycle) and A2-S4-06 (SQL injection — `PLAN.md` §1.17 says this endpoint is
parameterised) have no corresponding defect on record. If the audit stage reproduces these as passing,
they belong in the report as tested-and-passed negative results, the same treatment API 1 gave
`email` immutability and SQL injection.

### Priority

| Priority | Cases |
|---|---|
| **Critical** | A2-S5-02/03 (inverted discount formula — money bug), A2-S4-01/03/04/05 (no authentication + IDOR on a monetary endpoint) |
| **High** | A2-S2-08 (`>=` threshold boundary), A2-S3-02/04 (quota-exhaustion rejection) |
| **Medium** | A2-S2-01–07 (code partitions), A2-S3-01/03/05 (usage lifecycle happy paths) |
| **Low** | A2-S2-11–18 (zero/negative/type-coercion/case-sensitivity/fractional edge cases), A2-S5-05/06/07 (Content-Type, absence, message content), A2-S4-06/07/08/09 (injection negative result, mass assignment, malformed body, numeric overflow) |
