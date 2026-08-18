# API 3 — `PUT /api/admin/orders/:id/status` (FR-18, FR-10) — AI-Generated Test Cases

**Student:** 23127396 · **Generated:** 2026-08-18 · **AI:** Claude Sonnet 5
**Endpoint:** `PUT /api/admin/orders/:id/status` · **Companion:** `GET /api/admin/orders`
**Spec refs:** FR-18, FR-10 (state machine), FR-12, SEC-02, SEC-03, SEC-05

---

## S1 — Parameter Inventory

| Parameter | Source | Type | Required/Optional | Spec Constraints | Notes |
|:---|:---|:---|:---|:---|:---|
| `Authorization` | Header | String | Required | Valid JWT (FR-12 #1) **and** `role='admin'` in claims (FR-12 #2, SEC-03) — two separate conditions. | Both must be tested independently (S4). |
| `:id` | Path | Integer | Required | Must identify an existing order. No format constraint stated beyond that. | Path segment, not body/query. |
| `status` | Body | String (enum) | Required (implied) | One of `pending`, `confirmed`, `shipping`, `delivered`, `canceled` (§6.2). Legality of a given value depends on the order's **current** status (FR-10) — a state-transition concern, not a plain partition one. | No case-sensitivity rule stated. |
| Order DB record (current `status`) | DB State | Enum | Required (implicit) | The "from" state in every FR-10 transition. | Drives S3 entirely. |
| JWT `role` claim | Implicit | String | Required = `'admin'` | FR-12 #2, SEC-03 | Attacker-influenced via API 1's SEC-06 defect — see A3-S4-04. |

---

## S2 — Domain Partitions (9 cases, 5 de-duplicated into S3)

*A3-S2-01/02/03/04/05 removed — each was an exact-duplicate request of an S3 matrix cell (same
`:id`/`status` pair). See the de-duplication log in S6.*

| ID | Title | Technique | Preconditions | Request | Expected Status | Expected Body | Spec Justification |
|---|---|---|---|---|---|---|---|
| A3-S2-06 | status="UNKNOWN" (not an enum member) | EP | Order in `pending` | `{"status":"UNKNOWN"}` | 400 | UNDETERMINED | API §6.2: enum closed to 5 values |
| A3-S2-07 | status="" (empty string) | EP | Order in `pending` | `{"status":""}` | 400 | UNDETERMINED | Not one of the 5 enum values |
| A3-S2-08 | status="Pending" (wrong case) | EP | Order in `pending` | `{"status":"Pending"}` | UNDETERMINED | UNDETERMINED | No stated case-sensitivity rule |
| A3-S2-09 | status wrong type (number) | EP | Order in `pending` | `{"status":1}` | UNDETERMINED | UNDETERMINED | No type-validation rule stated |
| A3-S2-10 | status omitted | EP | Order in `pending` | `{}` | UNDETERMINED | UNDETERMINED | §6.2 body always shows `status` |
| A3-S2-11 | :id references a non-existent order | EP | None | `PUT /api/admin/orders/999999/status` `{"status":"confirmed"}` | 404 | UNDETERMINED | Target resource must exist |
| A3-S2-12 | :id non-numeric | EP | None | `PUT /api/admin/orders/abc/status` `{"status":"confirmed"}` | UNDETERMINED | UNDETERMINED | No format rule stated for `:id` |
| A3-S2-13 | :id negative | EP | None | `PUT /api/admin/orders/-1/status` `{"status":"confirmed"}` | UNDETERMINED | UNDETERMINED | Order ids are positive auto-increment |
| A3-S2-14 | :id zero | BVA | None | `PUT /api/admin/orders/0/status` `{"status":"confirmed"}` | UNDETERMINED | UNDETERMINED | Boundary below the valid id range |

---

## S3 — State Transitions (25 cases — full 5×5 matrix)

| ID | From → To | Expected | Spec Justification |
|---|---|---|---|
| A3-S3-01 | `pending` → `pending` | UNDETERMINED | Spec silent on same-state re-submission |
| A3-S3-02 | `pending` → `confirmed` | 200 (legal) | FR-10: "[Admin xác nhận]" arrow |
| A3-S3-03 | `pending` → `shipping` | 400 (illegal) | No direct arrow; skips `confirmed` |
| A3-S3-04 | `pending` → `delivered` | 400 (illegal) | No direct arrow; skips two states |
| A3-S3-05 | `pending` → `canceled` | 200 (legal) | FR-10: cancel arrow from `pending` |
| A3-S3-06 | `confirmed` → `pending` | 400 (illegal) | No backward arrow |
| A3-S3-07 | `confirmed` → `confirmed` | UNDETERMINED | Spec silent |
| A3-S3-08 | `confirmed` → `shipping` | 200 (legal) | FR-10: "[Admin giao hàng]" arrow |
| A3-S3-09 | `confirmed` → `delivered` | 400 (illegal) | No direct arrow; skips `shipping` |
| A3-S3-10 | `confirmed` → `canceled` | 200 (legal) | FR-10: cancel arrow from `confirmed` |
| A3-S3-11 | `shipping` → `pending` | 400 (illegal) | No backward arrow |
| A3-S3-12 | `shipping` → `confirmed` | 400 (illegal) | No backward arrow |
| A3-S3-13 | `shipping` → `shipping` | UNDETERMINED | Spec silent |
| A3-S3-14 | `shipping` → `delivered` | 200 (legal) | FR-10: "[Admin hoàn tất]" arrow |
| A3-S3-15 | `shipping` → `canceled` | 200 (legal, admin-only) | FR-10's `shipping`-cancel restriction names *User*; this is the Admin endpoint |
| A3-S3-16 | `delivered` → `pending` | 400 (illegal — final) | FR-10 final-state rule |
| A3-S3-17 | `delivered` → `confirmed` | 400 (illegal — final) | Same |
| A3-S3-18 | `delivered` → `shipping` | 400 (illegal — final) | Same |
| A3-S3-19 | `delivered` → `delivered` | 400 (illegal — final, strict reading) | "không được phép chuyển sang bất kỳ trạng thái nào khác" |
| A3-S3-20 | `delivered` → `canceled` | 400 (illegal — final) | Same |
| A3-S3-21 | `canceled` → `pending` | 400 (illegal — final) | `canceled` equally final |
| A3-S3-22 | `canceled` → `confirmed` | 400 (illegal — final) | Same |
| A3-S3-23 | `canceled` → `shipping` | 400 (illegal — final) | Same |
| A3-S3-24 | `canceled` → `delivered` | 400 (illegal — final) | **Flagship case** — most spec-unambiguous illegal cell in the matrix |
| A3-S3-25 | `canceled` → `canceled` | 400 (illegal — final, strict reading) | Same reasoning as A3-S3-19 |

---

## S4 — Security (9 cases)

| ID | Title | Technique | Preconditions | Request | Expected Status | Expected Body | Spec Justification |
|---|---|---|---|---|---|---|---|
| A3-S4-01 | SEC-02: no `Authorization` header | Missing Auth | Order in `pending` | No header. `{"status":"confirmed"}` | 401 | UNDETERMINED | FR-12 #1, SEC-02 |
| A3-S4-02 | SEC-02: malformed/invalid JWT | Invalid Auth | None | `Auth: Bearer invalid_token` `{"status":"confirmed"}` | 401 or 403 | UNDETERMINED | SEC-02 |
| A3-S4-03 | SEC-03: valid token, role='user' | Vertical Escalation | User token, order in `pending` | `Auth: Bearer {{userToken}}` `{"status":"confirmed"}` | 403 | UNDETERMINED | FR-12 #2, SEC-03 |
| A3-S4-04 | SEC-03: escalation chain via API 1's SEC-06 defect | Vertical Escalation (composed) | Plain user, order in `pending` | 1. `PUT /api/users/me` `{"role":"admin"}` 2. `PUT /api/admin/orders/{{id}}/status` (same/refreshed token) `{"status":"confirmed"}` | 403 | UNDETERMINED | FR-12 #2, SEC-03, FR-04 role-immutability |
| A3-S4-05 | FR-18 positive: admin manages another user's order | Access Control (positive) | Admin token; order belongs to a different user | `Auth: Bearer {{adminToken}}` on victim's order `{"status":"confirmed"}` | 200 | UNDETERMINED | FR-18: admin reach is explicitly cross-user |
| A3-S4-06 | SEC-05: SQL injection in `status` (negative result) | SQL Injection | Order in `pending` | `{"status":"confirmed'; DROP TABLE orders; --"}` | 400 | No DB error | SEC-05 |
| A3-S4-07 | SEC-05: injection via `:id` (negative result) | SQL Injection | None | `PUT /api/admin/orders/1%20OR%201%3D1/status` `{"status":"confirmed"}` | UNDETERMINED | No DB error; must not mass-update | SEC-05 |
| A3-S4-08 | Mass-update guard: `:id` scoping | Data Integrity | Two orders in `pending` | PUT on target id, then GET to check the control order | 200; control unchanged | Control order stays `pending` | UPDATE must not leak into other rows |
| A3-S4-09 | FR-18: `shipping_address` safety on the companion list endpoint | XSS / Output Encoding | Order's `shipping_address` contains a script tag | `GET /api/admin/orders` | 200 | Raw string returned; escaping is front-end's job | FR-18 |

---

## S5 — Schema Validation (6 cases)

| ID | Title | Technique | Preconditions | Request | Expected Status | Expected Body Assertions | Spec Justification |
|---|---|---|---|---|---|---|---|
| A3-S5-01 | Success response shape | Schema (exploratory) | Legal transition | `{"status":"confirmed"}` | 200 | JSON object; exact fields UNDETERMINED | §6.2 gives no example |
| A3-S5-02 | Illegal-transition error shape | Schema (exploratory) | Order in `delivered` | `{"status":"pending"}` | 400 | Error/message field present | FR-10: error mandated, shape not |
| A3-S5-03 | Order-not-found error shape | Schema (exploratory) | None | `.../999999/status` | 404 | Error/message field present | Implicit |
| A3-S5-04 | Forbidden error shape | Schema (exploratory) | User token | `{"status":"confirmed"}` | 403 | Error/message field present | SEC-03 |
| A3-S5-05 | No cross-order/cross-user data leak in response | Negative Schema | Two orders, different owners | PUT on one order | 200 | Response concerns only the targeted order | Implicit |
| A3-S5-06 | `GET /api/admin/orders` returns `shipping_address` unmodified | Schema | Known address value | `GET /api/admin/orders` | 200 | Array; address matches stored value exactly | FR-18 |

---

## S6 — Consolidation Summary

### Case Count

| Stage | Count | Notes |
|---|---|---|
| S2 Domain Partitions | 9 | 5 status format classes (unknown/empty/case/type/omitted), 4 `:id` classes |
| S3 State Transitions | 25 | Full 5×5 matrix — 10 legal, 10 illegal-final-state, 5 illegal-non-final |
| S4 Security | 9 | 2 authentication, 2 authorization (incl. the cross-API escalation chain), 1 positive access check, 2 injection, 1 data-integrity, 1 output-encoding |
| S5 Schema | 6 | 4 response-shape classes, 1 absence, 1 companion-endpoint fidelity |
| **Total** | **49** | Comfortably clears the Requirement §6 floor of ≥35 per API (matches API 1's 40, API 2's 38) |

### De-duplication Log

| Removed | Merged Into | Reason |
|---|---|---|
| A3-S2-01 (`pending`→`confirmed`, format check) | A3-S3-02 | Identical request; S3's transition-legality framing subsumes the format question |
| A3-S2-02 (`confirmed`→`shipping`, format check) | A3-S3-08 | Same |
| A3-S2-03 (`shipping`→`delivered`, format check) | A3-S3-14 | Same |
| A3-S2-04 (`pending`→`canceled`, format check) | A3-S3-05 | Same |
| A3-S2-05 (`confirmed`→`pending`, format check) | A3-S3-06 | Same |

### Expected Failures (assert spec, SUT predicted to violate — from `PLAN.md` §1.13–§1.14, source-read but **not yet live-reproduced**; confirming/refuting these is the job of the audit stage, A3-A)

| Case ID | Why it is predicted to fail against the SUT |
|---|---|
| A3-S3-24 | `PLAN.md` §1.14: `server.js:550-551` is predicted to explicitly allow `canceled → delivered` — the single planted defect the forward-drawn FR-10 diagram is least likely to catch by construction. |
| A3-S4-01, A3-S4-02, A3-S4-03, A3-S4-04, A3-S4-05 (partially — the *positive* half is expected to pass, but only because the *negative* half is broken) | `PLAN.md` §1.13: no route under `/api/admin/*` is predicted to check `role`, only that `authenticateToken` succeeds. A plain user's token (S4-03) and even the composed escalation chain (S4-04) are predicted to succeed (200) rather than being rejected (403) — BUG-02. Combined with API 1's BUG-01, a brand-new account reaches full admin control of every order in two requests. |

### Not Predicted to Fail

A3-S3-\* cells other than the `canceled → delivered` row, A3-S4-06/07 (SQL injection —
`PLAN.md` §1.17 says the chosen endpoints are parameterised), and A3-S4-09 (the API layer returning
`shipping_address` faithfully is a *passed* precondition for SEC-04's front-end escaping to matter at
all) have no corresponding defect on record. If the audit stage reproduces these as passing, they
belong in the report as tested-and-passed negative results.

### Priority

| Priority | Cases |
|---|---|
| **Critical** | A3-S4-03/04/05 (no role check on admin routes — full state-machine control by any authenticated user), A3-S3-24 (`canceled` resurrected as `delivered`) |
| **High** | A3-S3-16–20 (`delivered` final-state rows), A3-S3-21–23/25 (`canceled` final-state rows other than -24) |
| **Medium** | A3-S3-03/04/06/09/11/12 (illegal non-final transitions), A3-S4-01/02 (authentication), A3-S4-08 (mass-update scoping) |
| **Low** | A3-S2-06–14 (format/type edge cases), A3-S3-01/07/13/19/25 (same-state re-submission), A3-S4-06/07/09, A3-S5-\* |
