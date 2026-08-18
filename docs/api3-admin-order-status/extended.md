# API 3 — `PUT /api/admin/orders/:id/status` (FR-18, FR-10) — Human-Added Test Cases

**Student:** 23127396 · **Extended:** 2026-08-18
**Source audit:** [`audit.md`](file:///C:/Users/Khoi/Downloads/23127396_HW06_AI_API_090/docs/api3-admin-order-status/audit.md)

> Each case below was missed by the generation stage. For each, the *mechanism* of the miss is
> stated — not just "the AI didn't think of it" but which structural cause (prompt scope, model
> tendency, missing fixture, spec silence, or single-request framing) made the case unreachable from
> six per-stage, per-endpoint prompts.

---

## Gap Categories (from the audit skill, plus one this API adds)

| # | Category | Applies to API 3? |
|---|---|---|
| E1 | Vertical privilege escalation on admin routes | Yes — and it composes across two endpoints (API 1 + API 3), not one |
| E2 | Transitions out of final states | Already the spine of the generated S3 matrix; the extensions here go one level up — *sequences* of transitions, not single hops |
| E3 | Mass assignment / privileged-field injection | Indirectly — a reflected-value hygiene issue found while auditing the injection case |
| E4 | Cross-user data access (IDOR) | Yes — chained with a *different* endpoint's IDOR (`GET /api/orders/:id`, `PLAN.md` §1.15) |
| E5 | Exact-threshold boundaries | Not applicable — no numeric threshold on this endpoint |
| **E6 (new)** | **Multi-request / temporal reasoning** | The six-stage method generates one request per case; it has no stage that asks "what happens if this exact request is sent twice" or "what does composing two individually-legal single hops produce" |

---

## Extended Test Cases

### A3-EX-01 — End-to-end takeover: brand-new account drives a stranger's order through the entire lifecycle

| Field | Value |
|---|---|
| **ID** | A3-EX-01 |
| **Title** | A freshly registered, never-escalated account can single-handedly run *any* order from `pending` to `delivered` |
| **Technique** | Security — composed vertical escalation (E1) |
| **Preconditions** | Register a brand-new account (`POST /api/register` accepts anything, `PLAN.md` §1.3). A victim's order exists in `pending`. |
| **Request Steps** | 1. `POST /api/register` + `POST /api/login` as the new account (role defaults to `user`). 2. `PUT /api/admin/orders/{{victimOrderId}}/status` `Auth: Bearer {{newAccountToken}}` `{"status":"confirmed"}`. 3. Repeat with `{"status":"shipping"}`. 4. Repeat with `{"status":"delivered"}`. |
| **Expected Status** | Every one of steps 2–4 should be 403 (FR-12 #2, SEC-03) | 
| **Expected Body** | N/A — the account should never reach step 2 successfully | 
| **SUT Behavior** | All three succeed (200 each), confirmed via `A3-S4-03`'s finding applied three times in sequence — no escalation via API 1 is even needed. A two-minute-old account with zero real privilege fully controls the fulfillment lifecycle of an order it has no relationship to. |
| **Defect targeted** | BUG-02, demonstrated end-to-end rather than as one isolated request |

**Why the generator missed it:** **(E1, composed across requests.)** `A3-S4-03` already found the
single-request version of this (one `status` change, one token). This case's value is entirely in
the *sequence* — three individually-generated-looking requests chained to show the practical blast
radius. The six-stage method generates cases, not sequences of cases; composing several into one
narrative is a step the methodology has no stage for.

---

### A3-EX-02 — Malicious cross-user cancellation (griefing, not just "the check is missing")

| Field | Value |
|---|---|
| **ID** | A3-EX-02 |
| **Title** | Any authenticated user can cancel a stranger's pending order out from under them |
| **Technique** | Security — IDOR / abuse (E1/E4) |
| **Preconditions** | Victim has a real order in `pending`, expecting to receive it |
| **Request** | `PUT /api/admin/orders/{{victimOrderId}}/status` `Auth: Bearer {{attackerUserToken}}` `{"status":"canceled"}` |
| **Expected Status** | 403 |
| **Expected Body** | N/A |
| **SUT Behavior** | 200 — `pending -> canceled` is whitelisted, and (per BUG-02) any token reaches it. The victim's legitimate order silently disappears with no order-ownership check anywhere in the handler. | 
| **Defect targeted** | BUG-02, specifically via the *cancel* arm rather than the forward-progress arm `A3-S4-03` already covers |

**Why the generator missed it:** **(E1) Same code path as `A3-S4-03`, different real-world framing.**
The generator produced one security case per SEC-xx requirement per role, which naturally converges
on a single representative request (it picked `status: "confirmed"`). Nothing in the stage-4 prompt
asks it to consider that the *same* vulnerability, exercised via the whitelist's cancel arm instead
of its forward arm, has a qualitatively different (destructive, not just unauthorized) real-world
consequence — that distinction requires reasoning about business impact, not just about which status
code should come back.

---

### A3-EX-03 — Repeating the identical legal PUT twice does not behave idempotently

| Field | Value |
|---|---|
| **ID** | A3-EX-03 |
| **Title** | The same `PUT` request, sent twice in a row, returns 200 then 400 |
| **Technique** | State Transition — multi-request/temporal (E6) |
| **Preconditions** | Order in `pending` |
| **Request Steps** | 1. `PUT /api/admin/orders/{{id}}/status` `{"status":"confirmed"}` 2. Immediately repeat the identical request |
| **Expected Status** | Per general HTTP semantics, `PUT` is meant to be idempotent — the same request repeated should produce the same *result state*, so a reasonable reading is that both calls should succeed (or both fail the same way) | 
| **Expected Body** | UNDETERMINED — FR-10 doesn't discuss repeated identical requests | 
| **SUT Behavior** | 1. 200 (order is now `confirmed`) 2. 400 `{"error":"Invalid state transition from confirmed to confirmed"}` — because the transition whitelist has no same-state entries (confirmed by the audit's `A3-S3-07`), the *second* call to an operation that looks identical to the first fails purely because server-side state moved between the two calls. | 
| **Defect targeted** | Not a numbered `BUG-xx` — a design-level observation about the endpoint's non-idempotent behavior, worth reporting alongside the whitelist findings | 

**Why the generator missed it:** **(E6) The method has no stage that repeats a request.** Every one
of the 25 generated S3 cases is a single fire-and-check request against a fixed starting state. The
question "what happens if I send this twice" requires holding two requests and their *relationship*
in mind at once — a temporal/sequential reasoning step the six stages (parameter, partition,
transition, security, schema, consolidation) never ask for, because each stage's prompt template
asks for one request per case, not a request pair.

---

### A3-EX-04 — Raw injection payload reflected verbatim into the error message

| Field | Value |
|---|---|
| **ID** | A3-EX-04 |
| **Title** | The SQL-injection-shaped `status` value from `A3-S4-06` comes back unescaped in the JSON error body |
| **Technique** | Security — reflected-input hygiene (E3-adjacent) |
| **Preconditions** | Order in `pending` |
| **Request** | `PUT /api/admin/orders/{{id}}/status` `{"status":"<script>alert(document.cookie)</script>"}` |
| **Expected Status** | 400 |
| **Expected Body** | If an admin UI ever renders this error message without escaping, the payload executes — SEC-04 ("mọi dữ liệu từ user nhập vào khi hiển thị trên UI phải được escape đúng cách") applies to *any* user-supplied string reaching a UI, not only to fields explicitly named in FR-xx | 
| **SUT Behavior** | `server.js:554-556`: `` `Invalid state transition from ${currentStatus} to ${status}` `` — `status` is interpolated directly into the message with no encoding. The API layer returns it as-is; whether it becomes exploitable depends entirely on whether any consumer renders it unescaped, which is outside this endpoint's control but is exactly the kind of surface SEC-04 is written to cover. | 
| **Defect targeted** | Candidate finding — a reflected-value hygiene gap, distinct from the (correctly negative) SEC-05 SQL-injection result `A3-S4-06` already confirmed | 

**Why the generator missed it:** **(E3-adjacent — the finding lives one layer under the case that
found it.)** `A3-S4-06` was generated specifically to test SQL injection (SEC-05) and correctly
predicted a negative result there. But *reading the response body* of that same request for a
*different* class of issue (output encoding, SEC-04) requires re-examining an already-generated
case's response through a second lens — the six-stage method treats each case as answering one
question, not as a artifact to be re-inspected for unrelated properties once the response is in hand.

---

### A3-EX-05 — Cross-endpoint reconnaissance: unauthenticated order lookup feeds the admin attack

| Field | Value |
|---|---|
| **ID** | A3-EX-05 |
| **Title** | `GET /api/orders/:id` (no auth at all) lets an attacker discover real order ids and current status before attacking this endpoint |
| **Technique** | Security — IDOR chained across endpoints (E4) |
| **Preconditions** | None — `GET /api/orders/:id` has no `authenticateToken` middleware (`PLAN.md` §1.15) |
| **Request Steps** | 1. `GET /api/orders/1`, `/2`, `/3`, ... (no `Authorization` header at all) to enumerate real orders, their owners, current `status`, and `total_amount`. 2. Pick a `pending` order belonging to a victim. 3. `PUT /api/admin/orders/{{discoveredId}}/status` `Auth: Bearer {{attackerUserToken}}` `{"status":"canceled"}` (as in `A3-EX-02`, now with a *specifically chosen* high-value target instead of a known-in-advance id) |
| **Expected Status** | Step 1 should require authentication (SEC-02); step 3 should be 403 (SEC-03) |
| **Expected Body** | N/A |
| **SUT Behavior** | Step 1 succeeds fully unauthenticated (a *different* endpoint's bug, not in this API's scope to fix or report as this API's finding, but directly enabling this one). Step 3 succeeds per BUG-02. Together: zero credentials are needed to both find a target and then act on it. |
| **Defect targeted** | Composes an out-of-scope endpoint's IDOR with this endpoint's BUG-02 — reportable as an attack chain, same treatment as the BUG-01→BUG-02 chain already in `PLAN.md` |

**Why the generator missed it:** **(E4) Second endpoint outside this API's S1 parameter inventory.**
`GET /api/orders/:id` was never quoted into any of API 3's six stage prompts — it belongs to nobody's
"three chosen APIs" pipeline directly, so no generation stage for *any* of the three APIs was ever
shown its spec text. A human auditor who has read `PLAN.md`'s cross-cutting facts (§1.15) can connect
it to this endpoint; a prompt scoped to `PUT /api/admin/orders/:id/status` alone cannot.

---

### A3-EX-06 — A two-hop shortcut reaches `delivered` while skipping `confirmed` and `shipping` entirely

| Field | Value |
|---|---|
| **ID** | A3-EX-06 |
| **Title** | `pending -> canceled -> delivered` marks an order "delivered" without it ever being confirmed or shipped |
| **Technique** | State Transition — composed sequence (E6) |
| **Preconditions** | Order in `pending` |
| **Request Steps** | 1. `PUT .../status` `{"status":"canceled"}` (legal — `pending -> canceled` is whitelisted) 2. `PUT .../status` `{"status":"delivered"}` (this is exactly `A3-S3-24`'s confirmed `BUG-05`) |
| **Expected Status** | Step 2 should be 400 — `canceled` is a final state (FR-10) | 
| **Expected Body** | N/A |
| **SUT Behavior** | Both steps return 200. An order reaches `delivered` in **two** illegitimate hops instead of the **three** legitimate ones (`pending -> confirmed -> shipping -> delivered`), never passing through `confirmed` or `shipping` at all. | 
| **Defect targeted** | Composes `A3-S3-05` (legal, correct) with `A3-S3-24`/BUG-05 (illegal, buggy) into a concrete exploit path. **Business impact, not just a state-machine curiosity:** FR-13 defines dashboard revenue as the sum of `total_amount` over orders with `status = 'delivered'` — this sequence lets anyone (per BUG-02, without even being an admin) inflate reported revenue for an order that was actually canceled and never fulfilled. |

**Why the generator missed it:** **(E6) The S3 stage tests hops, not paths.** Every one of the 25
generated S3 cases is a single `(from, to)` pair evaluated against a fixed starting state. Recognizing
that two *individually* generated legal/buggy cells (`A3-S3-05` and `A3-S3-24`) can be *concatenated*
into a shorter illegitimate route to `delivered` — and that this specific route has a business
consequence via FR-13 that neither cell states on its own — requires holding the whole diagram and a
different requirement (FR-13, from a different section of the spec entirely) in mind simultaneously.
No single stage's prompt asks for that synthesis.

---

## Summary

| ID | Title | Category | Why the generator missed it | Defect |
|---|---|---|---|---|
| A3-EX-01 | Brand-new account drives an order end-to-end | E1 (composed) | Sequence of already-found single-request findings; no stage composes cases | BUG-02, end-to-end |
| A3-EX-02 | Malicious cross-user cancellation | E1/E4 | Same code path as a generated case, different business-impact framing | BUG-02, cancel arm |
| A3-EX-03 | Identical PUT twice: 200 then 400 | E6 (new) | No stage repeats a request; non-idempotence only visible across two calls | Design observation, no BUG-id |
| A3-EX-04 | Injection payload reflected in error message | E3-adjacent | Requires re-reading a generated case's response for an unrelated (SEC-04) property | Candidate finding |
| A3-EX-05 | Unauthenticated `GET /api/orders/:id` feeds this endpoint's attack | E4 | Second endpoint, outside this API's S1 parameter inventory entirely | Composed with BUG-02 |
| A3-EX-06 | 2-hop shortcut to `delivered` skips `confirmed`/`shipping` | E6 (new) | Requires composing two S3 cells plus a different FR (FR-13) neither states alone | Composed BUG-05 + FR-13 impact |
