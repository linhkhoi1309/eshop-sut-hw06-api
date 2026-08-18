# API 2 — `POST /api/apply-coupon` (FR-09) — Human-Added Test Cases

**Student:** 23127396 · **Extended:** 2026-08-18
**Source audit:** [`audit.md`](file:///C:/Users/Khoi/Downloads/23127396_HW06_AI_API_090/docs/api2-apply-coupon/audit.md)

> Each case below was missed by the generation stage. For each, the *mechanism* of the miss is
> stated — not just "the AI didn't think of it" but which structural cause (prompt scope, model
> tendency, missing fixture, spec silence) made the case unreachable from a spec-only, one-endpoint-
> at-a-time prompt.

---

## Gap Categories (from the audit skill)

| # | Category | Applies to API 2? |
|---|---|---|
| E1 | Vertical privilege escalation on admin routes | Yes — the sibling `/api/admin/coupons` route, never in scope of an `apply-coupon`-only prompt |
| E2 | Transitions out of final states | Yes — a hidden state reset via coupon identity, not visible in the FR-09 state model at all |
| E3 | Mass assignment / privileged-field injection | Yes — JS truthiness edge on `user_id`, same class as API 1's `role: ""` |
| E4 | Cross-user data access (IDOR) | Yes — amplifying the single-target IDOR already generated into an enumeration attack |
| E5 | Exact-threshold boundaries | Yes — a `Date` granularity boundary the generation stage never considered |

---

## Extended Test Cases

### A2-EX-01 — Single-use coupon reusable indefinitely if the client never "commits" it

| Field | Value |
|---|---|
| **ID** | A2-EX-01 |
| **Title** | Repeated `apply-coupon` calls alone never exhaust a single-use coupon |
| **Technique** | State Transition — endpoint-pair interaction |
| **Preconditions** | User (id=2), `SAVE10` (`max_uses_per_user=1`), never recorded via `/api/coupon-usage` |
| **Request Steps** | 1. `POST /api/apply-coupon {"code":"SAVE10","total_amount":500000,"user_id":2}` → 200 2. Repeat the identical call immediately, with **no** `/api/coupon-usage` call in between → **still 200** |
| **Expected Status** | Second call should be rejected once — a single-use coupon's "one use" should not be indefinitely repeatable |
| **Expected Body** | UNDETERMINED — the spec never defines "preview" vs. "commit" semantics for this endpoint, which is itself the finding |
| **SUT Behavior** | Both calls return 200. `apply-coupon` (`server.js:362-441`) never writes to `coupon_usage` — it only `SELECT COUNT`s it (`:388`). The only insert happens in the separate, authenticated `POST /api/coupon-usage` (`:443-451`), which nothing forces the caller to invoke. |
| **Defect targeted** | Candidate new finding (not in `PLAN.md`'s original bug list — surfaced during the A2-A audit; recommend filing as `BUG-13` at report time) |

**Why the generator missed it:** **(Prompt scope — a second endpoint invisible to a one-endpoint
prompt.)** The six-stage generator was driven one endpoint at a time, and `POST /api/coupon-usage`
was never the subject of a prompt while working on `apply-coupon`. The spec text for §5.1 doesn't
mention it either — a reader of just that section has no way to know a second, separate "commit" call
exists. This is structurally identical to how the generator can't reason about admin-route checks
it was never shown (E1) — the missing information isn't a subtlety, it's an endpoint the prompt
never included.

---

### A2-EX-02 — `user_id: 0` bypasses the quota check (JS falsy edge)

| Field | Value |
|---|---|
| **ID** | A2-EX-02 |
| **Title** | `user_id: 0` silently skips C5, identical to omitting `user_id` entirely |
| **Technique** | Security — implementation-aware boundary (E3) |
| **Preconditions** | None — `user_id: 0` is not a real seeded user id, so this is a pure boundary probe |
| **Request** | `POST /api/apply-coupon` `{"code":"SAVE10","total_amount":500000,"user_id":0}` |
| **Expected Status** | Per spec intent, a quota check keyed on an explicit (if invalid) `user_id` should still run, or the request should be rejected as an invalid identity — either way, `0` should not be treated the same as "no identity provided" |
| **Expected Body** | UNDETERMINED |
| **SUT Behavior** | `server.js:386`: `if (user_id) { ...quota check... } else { ...skipped... }` — `0` is falsy in JavaScript, so `user_id: 0` takes the **same skip-the-quota-check path** as omitting the field entirely (the already-generated `A2-S4-04`). The coupon applies unconditionally. |
| **Defect targeted** | BUG-06 — a second, distinct way to trigger the same bypass |

**Why the generator missed it:** **(E3) No JavaScript-runtime-truthiness reasoning.** The generator's
S2 stage tested `user_id` omitted (`A2-S2-15`, later merged into `A2-S4-04`) and `user_id` as a wrong
type (`A2-S2-16`), but never a *falsy-but-present, syntactically valid* number. The model reasons
about `user_id` at the level of "is an id supplied," a semantic question, not "does `if (user_id)`
evaluate to `false` in JS for this specific value" — the exact question that determines the SUT's
actual behavior. This mirrors API 1's `A1-EX-04` (`role: ""`) precisely: a value that is
semantically present but runtime-falsy exposes a truthiness-based guard rather than a real check.

---

### A2-EX-03 — Unauthenticated enumeration of a victim's usage across all four coupons

| Field | Value |
|---|---|
| **ID** | A2-EX-03 |
| **Title** | Build a full coupon-usage profile for an arbitrary `user_id` with zero credentials |
| **Technique** | Security — IDOR amplification (E4) |
| **Preconditions** | Know a target `user_id` (e.g., `3`) — no token, no login, nothing else |
| **Request Steps** | Four calls, no `Authorization` header on any of them: `{"code":"SAVE10","total_amount":500000,"user_id":3}`, then `BIGBUY`, `VIP100`, `EXPIRED`, each with `user_id:3` |
| **Expected Status** | All four should be rejected for lack of authentication (FR-09 C4) |
| **Expected Body** | N/A — request should never reach the point of revealing anything about user 3 |
| **SUT Behavior** | Each call independently discloses, for that coupon, whether user 3 has remaining uses (200 + discount preview) or is exhausted (400 with the exact "used N times" count). Four unauthenticated requests fully profile a stranger's coupon history. | 
| **Defect targeted** | BUG-06, composed — the already-generated `A2-S4-03` shows the leak on one coupon; this shows the leak **scales for free** across every coupon in the system with no rate limit or auth barrier anywhere in the path |

**Why the generator missed it:** **(E4) Single-request framing, not attack-composition framing.**
The generation stage produces one request per case by design (each row in `generated.md` is a single
HTTP call). Recognizing that four *individually* generated IDOR cases (one per coupon) compose into a
qualitatively worse "profile the victim" attack requires reasoning across cases, not within one — a
step the stage-by-stage methodology doesn't include anywhere in its six stages. A human auditor
connects dots the generation prompts never asked to be connected.

---

### A2-EX-04 — Any authenticated user (not just admin) can create or delete coupons

| Field | Value |
|---|---|
| **ID** | A2-EX-04 |
| **Title** | `POST /api/admin/coupons` and `DELETE /api/admin/coupons/:id` accept any valid token, not just an admin's |
| **Technique** | Security — vertical privilege escalation (E1) |
| **Preconditions** | Any regular user token (id=2, role=`user`) |
| **Request Steps** | 1. `POST /api/admin/coupons` `Auth: Bearer {{userToken}}` Body: `{"code":"HACKED50","type":"fixed","discount_value":999999,"min_order_amount":0,"expired_at":"2099-12-31","max_uses_per_user":9999}` 2. `POST /api/apply-coupon {"code":"HACKED50","total_amount":1,"user_id":2}` to confirm the forged coupon is live |
| **Expected Status** | Step 1 should be 403 (SEC-03: admin routes must check `role`, not merely token validity) |
| **Expected Body** | `{"error":"Forbidden"}` or similar |
| **SUT Behavior** | `server.js:457`: `app.post("/api/admin/coupons", authenticateToken, ...)` — `authenticateToken` (`:100-110`) only verifies the JWT signature and sets `req.user`; nothing in the handler checks `req.user.role`. A plain user can create an arbitrary coupon (e.g., 100% off with no minimum) and immediately apply it. `DELETE /api/admin/coupons/:id` (`:483-486`) has the identical gap. |
| **Defect targeted** | SEC-03 — the same class of defect as BUG-02 (API 3's admin-route bypass), now confirmed on the coupon domain's own admin routes too, which were never in `apply-coupon`'s S4 prompt scope |

**Why the generator missed it:** **(E1) Prompt scope — sibling admin routes are invisible to an
endpoint-scoped prompt.** The S4 security stage was run against `POST /api/apply-coupon`'s own
spec text (FR-09, SEC-02, SEC-05); `/api/admin/coupons` belongs to a different API-spec section
(§6.4) that was never quoted into any of the six stage prompts for this endpoint. A generation
methodology that processes one endpoint per pass structurally cannot notice that a *different*
endpoint governing the same resource (coupons) has the identical vertical-escalation defect API 3's
plan already names as BUG-02 — the connection has to be made by a human who has read both.

---

### A2-EX-05 — Deleting and recreating a coupon with the same `code` resets everyone's quota

| Field | Value |
|---|---|
| **ID** | A2-EX-05 |
| **Title** | `coupon_usage` is keyed on the coupon's internal `id`, not its `code` — recreating a code gives every user a fresh limit |
| **Technique** | State Transition — hidden identity model (E2) |
| **Preconditions** | Admin token (or any token, per `A2-EX-04`). User (id=2) has exhausted `SAVE10` (applied + recorded once, `usage_count=1`, `max=1`) |
| **Request Steps** | 1. `DELETE /api/admin/coupons/:id` for `SAVE10`'s current row 2. `POST /api/admin/coupons` recreating `{"code":"SAVE10","type":"percent","discount_value":10,"min_order_amount":300000,"expired_at":"2099-12-31","max_uses_per_user":1}` (a *new* row, new autoincrement `id`) 3. As user 2: `POST /api/apply-coupon {"code":"SAVE10","total_amount":500000,"user_id":2}` |
| **Expected Status** | Per FR-09 C5's intent (a per-user, per-coupon *code* limit), step 3 should still be rejected for user 2 |
| **Expected Body** | UNDETERMINED — spec never states whether "the coupon" is identified by `code` or by an opaque internal id, which is exactly the ambiguity this case exposes |
| **SUT Behavior** | Step 3 returns **200**, not 400. `coupon_usage.coupon_id` (`server.js:388`, `:447`) references the coupon table's `id INTEGER PRIMARY KEY AUTOINCREMENT` (`database.js:30`), not `code`. The recreated row gets a brand-new `id`, so the old usage rows (tied to the deleted `id`) no longer match — user 2's quota is silently reset. There is no `PUT`/update-coupon endpoint (`api_specification.md` §6.4 only lists add/delete), so an admin wanting to fix a typo in, say, `min_order_amount` has no choice but delete-and-recreate — and doing so is an unintended quota-reset lever for every user of that code. |
| **Defect targeted** | Candidate new finding (not in `PLAN.md`'s original bug list — recommend filing alongside `A2-EX-01`'s candidate at report time) |

**Why the generator missed it:** **(E2) The state model isn't visible in the spec at all.** FR-09's
C5 talks about "mã này" (this code) as if `code` were the coupon's identity. The fact that the
*actual* identity the database enforces is the internal autoincrement `id` is a schema detail
(`database.js:30-38`) with no counterpart anywhere in the spec text the generator was given. The
six-stage method's S3 (state transitions) prompt is scoped to the *documented* state model (usage
count vs. limit); it has no way to generate a transition the spec doesn't know exists.

---

### A2-EX-06 — Expiry check treats a coupon as expired for the entirety of its expiry date

| Field | Value |
|---|---|
| **ID** | A2-EX-06 |
| **Title** | A coupon expiring "today" is rejected all day, not just after midnight the *next* day |
| **Technique** | BVA — `Date` granularity boundary (E5) |
| **Preconditions** | Requires a new fixture coupon with `expired_at` set to **today's date** (e.g. `EXPIRETODAY`, `expired_at: "2026-08-18"`) — not producible from the four seeded coupons, so must be added to `scripts/seed-api-data.js` for A2-X |
| **Request** | Any time after `00:00` local on the expiry date: `POST /api/apply-coupon {"code":"EXPIRETODAY","total_amount":<above its min>,"user_id":2}` |
| **Expected Status** | UNDETERMINED per the literal spec text ("Ngày hiện tại phải trước `expired_at`" — current date must be *before* the expiry date), but the common e-commerce reading is that a coupon remains valid *through* its expiry date, i.e. until the following midnight |
| **Expected Body** | N/A |
| **SUT Behavior** | `server.js:381`: `new Date(coupon.expired_at)` parses `"2026-08-18"` as `2026-08-18T00:00:00Z` (midnight). `server.js:382`: `expiry < now` is `true` for any `now` later that same day — the coupon reads as expired from the very first moment of its own expiry date, effectively expiring one full day earlier than the "valid through this date" reading most users would assume. |
| **Defect targeted** | Candidate new finding — an off-by-one-day boundary on `expired_at`, distinct from BUG-03/06/10 |

**Why the generator missed it:** **(E5) `Date`-parsing defaults are invisible without running the
code.** The generator correctly produced an "exactly expired" case (`A2-S2-04`, using the already-
long-expired `EXPIRED` fixture), but that fixture's `expired_at` (`2020-01-01`) is so far in the past
that it can never distinguish "expires at the start of the date" from "expires at the end of the
date" — both readings agree the coupon is expired. Only a fixture whose expiry is *today* forces the
distinction, and choosing that exact value requires knowing `new Date(dateString)` defaults to
midnight — a JavaScript runtime detail with no counterpart in the spec's plain-language date wording.

---

## Summary

| ID | Title | Category | Why the generator missed it | Defect |
|---|---|---|---|---|
| A2-EX-01 | Preview-only calls never consume a single use | Prompt scope (2nd endpoint) | `/api/coupon-usage` was never in an `apply-coupon`-scoped prompt | Candidate `BUG-13` |
| A2-EX-02 | `user_id: 0` bypasses C5 (JS falsy) | E3 | No JS-truthiness reasoning, same class as API 1's `role:""` | BUG-06 |
| A2-EX-03 | Unauthenticated victim usage-profile enumeration | E4 | Single-request framing can't compose an attack across cases | BUG-06, composed |
| A2-EX-04 | Any user can create/delete coupons via `/api/admin/coupons` | E1 | Sibling admin route outside the endpoint-scoped prompt | SEC-03 (~BUG-02 class) |
| A2-EX-05 | Delete+recreate a `code` resets everyone's quota | E2 | Coupon identity (`id` vs `code`) is a schema fact, not a spec fact | Candidate new finding |
| A2-EX-06 | Coupon expires from the start, not the end, of its expiry date | E5 | `Date` parsing default (midnight) invisible without running the code | Candidate new finding |
