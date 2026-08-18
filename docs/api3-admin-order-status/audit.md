# API 3 — `PUT /api/admin/orders/:id/status` (FR-18, FR-10) — Human Audit of AI-Generated Test Cases

**Student:** 23127396 · **Audited:** 2026-08-18
**Source:** [`generated.md`](file:///C:/Users/Khoi/Downloads/23127396_HW06_AI_API_090/docs/api3-admin-order-status/generated.md)
**Oracles:** Spec = FR-10 (state machine), FR-18, FR-12, SEC-03/SEC-05 · Impl =
[`server.js:525-568`](file:///C:/Users/Khoi/Downloads/23127396_HW06_AI_API_090/sut/backend/server.js#L525-L568)
(the handler), [`:100-110`](file:///C:/Users/Khoi/Downloads/23127396_HW06_AI_API_090/sut/backend/server.js#L100-L110)
(`authenticateToken`), [`:494-523`](file:///C:/Users/Khoi/Downloads/23127396_HW06_AI_API_090/sut/backend/server.js#L494-L523)
(sibling admin routes)

**The transition whitelist, read exactly (`server.js:537-551`) — this single block determines every
S3 row's real answer:**

```
pending   -> confirmed | canceled
confirmed -> shipping  | canceled
shipping  -> delivered
canceled  -> delivered
```

Six entries, full stop. Everything not on this list — every same-state case, every backward case,
and (critically) **`shipping -> canceled`, which is not on the list despite FR-10 saying admin may
cancel a shipping order** — falls through to `isValidTransition = false` and a 400. This single fact
resolves 24 of the 25 S3 predictions to a concrete, confirmed value and overturns one of them
outright (`A3-S3-15`, below).

---

## Audit Labels

| Label | Count |
|---|---|
| **VALID** | 30 |
| **INVALID** | 2 |
| **INCOMPLETE** | 17 |

---

## S2 — Domain Partitions

| ID | Label | Reasoning | Correction (if any) |
|---|---|---|---|
| A3-S2-06 | **VALID** | `"UNKNOWN"` matches none of the five `status === "..."` checks in the whitelist → `isValidTransition` stays `false` → 400. Confirmed, no bug. | — |
| A3-S2-07 | **VALID** | Same reasoning — `""` matches nothing. 400. | — |
| A3-S2-08 | **INCOMPLETE** | The case as designed can't test what it claims to. Current state is `pending`, target is `"Pending"` (same state, differently cased) — but `pending -> pending` **isn't in the whitelist at all**, cased or not, so this rejects for a reason unrelated to case-folding. It never actually probes whether `"Confirmed"` (capital C) is accepted as `"confirmed"`. | **Correction:** Retarget to `status: "Confirmed"` (capital) from `pending` — a target that *would* be legal if case-folded. Expected: UNDETERMINED (spec silent) but now genuinely tests the question; actual: 400 (`"Confirmed" !== "confirmed"`, JS strict equality, no case-folding anywhere in the handler). |
| A3-S2-09 | **INCOMPLETE** | `1 === "confirmed"` is `false` (JS strict equality across types) → 400. Resolved from `UNDETERMINED`. | **Correction:** Body = `{"error":"Invalid state transition from pending to 1"}` (template literal coerces the number to string in the message). |
| A3-S2-10 | **INCOMPLETE** | `status` destructures to `undefined`; `undefined === "confirmed"` is `false` → 400. | **Correction:** Body = `{"error":"Invalid state transition from pending to undefined"}` — the template literal renders JS's `undefined` as the literal word "undefined" in the message text. |
| A3-S2-11 | **VALID** | `db.get(...WHERE id = ?, [999999])` finds no row → `!order` → 404 `{"error":"Order not found"}` (`server.js:532`). | — |
| A3-S2-12 | **INCOMPLETE** | `:id="abc"` bound as a TEXT parameter against the `orders.id` INTEGER column. SQLite's affinity conversion cannot losslessly convert `"abc"` to a number, so the comparison fails for every row → no match → 404, not a crash and not 400. | **Correction:** Expected status = 404, same body as A3-S2-11. |
| A3-S2-13 | **INCOMPLETE** | `:id=-1` — no such row (ids are positive) → 404. | **Correction:** Expected 404. |
| A3-S2-14 | **INCOMPLETE** | `:id=0` — `AUTOINCREMENT` starts at 1, no row 0 → 404. | **Correction:** Expected 404. |

---

## S3 — State Transitions (full 5×5 matrix)

*Every row's "actual" column below is read directly off the six-entry whitelist quoted above — not
re-derived per row.*

| ID | Label | Reasoning | Correction (if any) |
|---|---|---|---|
| A3-S3-01 | **INCOMPLETE** | `pending -> pending` not whitelisted → 400. Resolves the `UNDETERMINED` prediction; not a bug (consistent, deliberate-looking omission). | **Correction:** Expected 400, body `{"error":"Invalid state transition from pending to pending"}`. |
| A3-S3-02 | **VALID** | `pending -> confirmed` is whitelisted (`server.js:538-539`) → 200. | — |
| A3-S3-03 | **VALID** | `pending -> shipping` not whitelisted → 400. | — |
| A3-S3-04 | **VALID** | `pending -> delivered` not whitelisted → 400. | — |
| A3-S3-05 | **VALID** | `pending -> canceled` is whitelisted (`:538-539`) → 200. | — |
| A3-S3-06 | **VALID** | `confirmed -> pending` not whitelisted → 400. | — |
| A3-S3-07 | **INCOMPLETE** | `confirmed -> confirmed` not whitelisted → 400. Resolved. | **Correction:** Expected 400. |
| A3-S3-08 | **VALID** | `confirmed -> shipping` whitelisted (`:542-543`) → 200. | — |
| A3-S3-09 | **VALID** | `confirmed -> delivered` not whitelisted → 400. | — |
| A3-S3-10 | **VALID** | `confirmed -> canceled` whitelisted (`:542-543`) → 200. | — |
| A3-S3-11 | **VALID** | `shipping -> pending` not whitelisted → 400. | — |
| A3-S3-12 | **VALID** | `shipping -> confirmed` not whitelisted → 400. | — |
| A3-S3-13 | **INCOMPLETE** | `shipping -> shipping` not whitelisted → 400. Resolved. | **Correction:** Expected 400. |
| A3-S3-14 | **VALID** | `shipping -> delivered` whitelisted (`:547-548`) → 200. | — |
| A3-S3-15 | **INVALID** | **Wrong prediction — a real defect, not an audit typo.** The case predicted 200 ("admin-only, so legal here") reasoning correctly from FR-10's text. But `shipping -> canceled` is **not one of the six whitelist entries** (`:537-551` — only `shipping -> delivered` exists for a `shipping` "from" state). The SUT returns 400 for every admin attempt to cancel a shipping order, contradicting FR-10's stated admin exception. | **Correction:** Expected status = 200 (spec-correct — FR-10 grants exactly this to Admin). Tag `EXPECTED-FAIL` → new candidate defect (not in `PLAN.md`'s original bug list; see Audit Summary). Actual: 400 `{"error":"Invalid state transition from shipping to canceled"}`. |
| A3-S3-16 | **VALID** | No whitelist entry has `delivered` as a "from" state at all → every `delivered -> *` is 400, including this one. | — |
| A3-S3-17 | **VALID** | Same reasoning. | — |
| A3-S3-18 | **VALID** | Same reasoning. | — |
| A3-S3-19 | **VALID** | Same reasoning — `delivered` never appears as a "from" state, so even `delivered -> delivered` is 400. The "strict reading" guess happened to match. | — |
| A3-S3-20 | **VALID** | Same reasoning. | — |
| A3-S3-21 | **VALID** | `canceled` only appears as "from" in one entry (`canceled -> delivered`, `:550-551`); every other `canceled -> *` is 400. | — |
| A3-S3-22 | **VALID** | Same reasoning. | — |
| A3-S3-23 | **VALID** | Same reasoning. | — |
| A3-S3-24 | **INCOMPLETE** | **Confirmed, not merely predicted.** `server.js:550-551`: `if (currentStatus === "canceled" && status === "delivered") isValidTransition = true;` — a standalone `if`, not part of the other four's shared block, reading like a late addition. This is the flagship planted defect. | **Correction:** Expected 400 (spec-correct) stays; formalize the tag `[EXPECTED-FAIL: BUG-05]` directly on the case now that source confirms it (`generated.md`'s S6 only "predicted" it). Actual: 200 `{"message":"Order status updated"}`. |
| A3-S3-25 | **VALID** | `canceled -> canceled` not the one whitelisted `canceled` entry → 400. | — |

---

## S4 — Security

| ID | Label | Reasoning | Correction (if any) |
|---|---|---|---|
| A3-S4-01 | **VALID** | No `Authorization` header → `token == null` (`server.js:103`) → 401 `{"error":"Unauthorized"}`. | — |
| A3-S4-02 | **INCOMPLETE** | `"invalid_token"` fails `jwt.verify` → `server.js:106` → specifically **403**, not "401 or 403". | **Correction:** Narrow to 403 `{"error":"Forbidden"}` — same resolution API 1's audit applied to the analogous ambiguity (`A1-S4-08`). |
| A3-S4-03 | **INCOMPLETE** | **Confirmed BUG-02.** `server.js:525`: `app.put("/api/admin/orders/:id/status", authenticateToken, (req, res) => {...})` — `authenticateToken` only verifies the JWT signature and sets `req.user`; nothing anywhere in the handler inspects `req.user.role`. A `role='user'` token succeeds identically to an admin token. | **Correction:** Keep expected = 403 (spec-correct, FR-12 #2/SEC-03). Tag `EXPECTED-FAIL` → BUG-02, confirmed. Actual: 200. |
| A3-S4-04 | **INCOMPLETE** | Same root cause as A3-S4-03, and the finding here is **narrower than the case's own framing implies**: because this route never reads `req.user.role` *at all*, the role-escalation step (`PUT /api/users/me {"role":"admin"}`) changes nothing about the outcome — a plain, never-escalated `role='user'` token already succeeds (that's exactly A3-S4-03). The "escalation chain" is a true and reportable *narrative* (BUG-01 composes with BUG-02 to let a brand-new account reach full admin control), but technically this endpoint's own vulnerability doesn't require BUG-01 as a precondition. | **Correction:** Retitle to make this explicit: "escalation chain is real but not required — BUG-02 alone is sufficient; BUG-01 only makes the compromised token *also* falsely claim `role=admin`, which this route never checks anyway." Tag `EXPECTED-FAIL` → BUG-02 (same as A3-S4-03, kept as a separate case for the narrative, not for a distinct code path). |
| A3-S4-05 | **VALID**, with a caveat | Confirmed: `db.get("SELECT status FROM orders WHERE id = ?", [req.params.id], ...)` has no `user_id`/ownership filter at all — any valid token can update any order, which is what FR-18 wants for Admin. But precisely *because* there is no role check (BUG-02), this "positive" result doesn't actually distinguish "Admin's cross-user reach works as designed" from "there is no authorization here at all" — A3-S4-03 is what isolates the difference. | Note added to the case: passing here is necessary but not sufficient evidence of correct FR-18 behavior; A3-S4-03's failure is the real signal. |
| A3-S4-06 | **VALID**, with an observation | `status` is never used in a SQL string — only in three `===` comparisons and then as a **bound** parameter in the final `UPDATE ... SET status = ?` (`server.js:559-561`). The injection payload can't match any whitelist entry → 400. SEC-05 passed as predicted. **Observation:** the raw payload is echoed verbatim into the JSON error message (`Invalid state transition from pending to confirmed'; DROP TABLE orders; --`) — not a SQL risk, but a reflected-input surface worth a human-added case if this project were also grading SEC-04 on API responses (see `extended.md`). | — |
| A3-S4-07 | **INCOMPLETE** | `:id` is bound as a parameter; `"1 OR 1=1"` cannot be converted to the `orders.id` column's INTEGER affinity, so it matches no row → 404 `{"error":"Order not found"}`, not a 400 and not a DB error. Negative result confirmed. | **Correction:** Expected status = 404. |
| A3-S4-08 | **VALID** | `UPDATE orders SET status = ? WHERE id = ?` (`server.js:560-561`) is scoped by the bound `:id` alone — no way for one call to touch a second row. Confirmed via the control-order check. | — |
| A3-S4-09 | **VALID** | `GET /api/admin/orders` (`server.js:510-523`): `SELECT orders.*, users.name as user_name ...` — no escaping, no sanitization, `shipping_address` returned exactly as stored. Confirmed passed negative result (API-level fidelity; SEC-04 escaping is the front-end's job). | — |

---

## S5 — Schema Validation

| ID | Label | Reasoning | Correction (if any) |
|---|---|---|---|
| A3-S5-01 | **INCOMPLETE** | `server.js:562-564`: `res.json({ message: "Order status updated" })` — exactly one key. | **Correction:** Assert `{"message":"Order status updated"}` exactly, no other keys. |
| A3-S5-02 | **INCOMPLETE** | `server.js:554-556`: `{"error": "Invalid state transition from ${currentStatus} to ${status}"}`. | **Correction:** For `delivered -> pending`, assert `{"error":"Invalid state transition from delivered to pending"}`. |
| A3-S5-03 | **INCOMPLETE** | `server.js:532`: `{"error":"Order not found"}`. | **Correction:** Assert exact body. |
| A3-S5-04 | **INVALID** | **The case cannot observe what it was designed to inspect.** It assumes a `role='user'` token produces a 403 whose shape can then be checked. Given confirmed BUG-02, that request actually returns **200** — there is no 403 response to inspect the shape of via this path at all. | **Correction:** The 403 `{"error":"Forbidden"}` shape *is* observable, just not from a valid-but-non-admin token — it comes from `authenticateToken`'s own rejection of a malformed/invalid token (`server.js:106`), already covered by `A3-S4-02`. Merge this case's shape assertion into `A3-S4-02`; note explicitly in the report that "valid non-admin token -> 403" is a shape FR-12/SEC-03 require but the SUT never produces. |
| A3-S5-05 | **VALID** | The success response is only `{"message":"..."}"` — no order data of any kind is echoed back, so this dimension is satisfied automatically (trivially, but genuinely) rather than by any deliberate scoping logic. | — |
| A3-S5-06 | **VALID**, extended | Confirmed exact `shipping_address` fidelity. Bonus, not previously noted: the response also includes a joined `user_name` field (`LEFT JOIN users`, `server.js:513-515`) not documented anywhere in API §6.2. | Note added: `user_name` is an undocumented extra field — not a violation (spec says nothing forbidding it) but worth listing in the schema assertion as "present, unspecified" rather than silently ignored. |

---

## Audit Summary

### Corrections Applied

| ID(s) | Original Issue | Fix Applied |
|---|---|---|
| A3-S2-08 | Case couldn't test what it claimed (target state not whitelisted regardless of case) | Retargeted to a differently-cased *legal* target (`"Confirmed"`) so case-folding is actually exercised |
| A3-S2-09, A3-S2-10 | `UNDETERMINED` left unresolved | Concrete bodies, including how the template literal renders a number/`undefined` |
| A3-S2-12–14 | `UNDETERMINED` for `:id` edge values | Resolved to 404 via SQLite affinity-conversion reasoning, not left as a guess |
| A3-S3-01/07/13 | `UNDETERMINED` same-state predictions | Resolved to 400 from the whitelist |
| A3-S3-15 | **Wrong prediction, not just under-specified** — spec-plausible 200 asserted; SUT lacks the whitelist entry entirely | Flipped to `EXPECTED-FAIL`, new candidate defect filed (not `BUG-02`/`BUG-05` — a third, distinct FR-10 gap) |
| A3-S3-24 | Predicted `EXPECTED-FAIL` at the S6-summary level only | Promoted to a confirmed, per-case tag, citing the isolated `if` at `server.js:550-551` |
| A3-S4-02 | Ambiguous "401 or 403" | Narrowed to 403, same fix pattern as API 1's `A1-S4-08` |
| A3-S4-03, A3-S4-04 | Predicted `EXPECTED-FAIL`, `A3-S4-04`'s escalation-chain premise overstated | Confirmed via the route declaration (no role check at all); `A3-S4-04` corrected to state the chain is narratively real but not technically required |
| A3-S4-07 | `UNDETERMINED` (400 or 404) | Resolved to 404 |
| A3-S5-01–03 | `UNDETERMINED` bodies | Exact bodies from source |
| A3-S5-04 | **Unobservable as designed** — assumed a 403 response exists to inspect for a scenario that actually returns 200 | Merged into `A3-S4-02`, with an explicit note that the FR-12/SEC-03-required shape never occurs in the SUT |

### Bugs Surfaced by Audit

| Bug ID | Cases | Finding |
|---|---|---|
| BUG-02 | A3-S4-03, A3-S4-04 | No route under `/api/admin/*` checks `role` — `authenticateToken` only verifies the JWT signature. Confirmed at the route declaration (`server.js:525`), not merely predicted. |
| BUG-05 | A3-S3-24 | `canceled -> delivered` is explicitly whitelisted (`server.js:550-551`), violating FR-10's final-state rule for `canceled`. |
| **Candidate** (not in `PLAN.md`'s original list — surfaced by this audit) | A3-S3-15 | `shipping -> canceled` is **absent** from the transition whitelist, so Admin cannot cancel a shipping order at all — contradicting FR-10's explicit statement that Admin (unlike User) may. Recommend adding to `PLAN.md`'s bug table at the report stage (e.g. `BUG-14`). |

### AI Failure Patterns Observed

1. **A wrong prediction, not just an unresolved one (`A3-S3-15`).** Every other `UNDETERMINED`
   case in this audit turned out to be a legitimate hedge that source-reading resolves cleanly. This
   one is different: the generator reasoned *correctly* from the spec text (admin's stated exception
   to the `shipping`-cancel restriction) and produced a *confident, wrong* answer, because it had no
   way to know the implementation's whitelist simply omits that arrow. This is the sharpest reminder
   in the whole three-API audit that spec-plausible reasoning and SUT-correct reasoning are different
   things — the generator cannot be blamed for missing an omission it was never shown.
2. **Same-state transitions were consistently hedged, never guessed.** Five separate `UNDETERMINED`
   calls (`A3-S3-01/07/13/19/25`) for a question the spec genuinely doesn't answer (is `X -> X` a
   no-op success or a rejection?) — appropriately cautious, and all five resolved to the same answer
   (400) once the whitelist was read, which is itself a mildly interesting implementation fact: the
   SUT treats "not explicitly listed" uniformly as illegal, with no special-casing for identity
   transitions.
3. **A case's own precondition can be spec-plausible and still unobservable (`A3-S5-04`).** The case
   assumed a 403 exists to describe the shape of. Once BUG-02 is confirmed, that assumption is false
   for this specific request — the lesson isn't "write a better assertion", it's that a schema case
   built on top of a security case's *assumed* correct behavior inherits that assumption's risk.
4. **Escalation-chain cases can overstate their own precondition (`A3-S4-04`).** Chaining BUG-01 into
   BUG-02 is a genuinely good narrative for the report, but the generator didn't check whether the
   chain's first step (role escalation) was even *load-bearing* for the second step's outcome. It
   wasn't — this route ignores the `role` claim entirely, escalated or not.
