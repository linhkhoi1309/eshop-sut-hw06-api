# Stage S3: State Transitions for API 2 (`POST /api/apply-coupon`)

**Spec quoted:** FR-09 C5 — "**Chưa dùng hết lượt**: Số lần đã dùng mã này của user `<
max_uses_per_user`." This is the only stateful condition among C1–C5 (C1–C3 are point-in-time
lookups; C4 is a per-request auth check). The state variable is the per-`(user, code)` usage
counter, and the transition table below is driven by repeated calls against it — the same
sequential-call pattern used for API 1's partial-update state (`A1-S3-01/02`).

**State model:** `usage_count` for a given `(user, code)` pair starts at 0 and increments by 1 on
every successful application. C5 passes while `usage_count < max_uses_per_user` and fails once
`usage_count == max_uses_per_user`. There is no documented way to decrement it (no "remove coupon"
endpoint in scope), so the only transition is monotonic increase toward the limit, then a final
rejecting state — structurally analogous to FR-10's terminal order states, but per-`(user, code)`
rather than global.

| ID | Title | Technique | Preconditions | Request Steps | Expected Status | Expected Body | Spec Justification |
|---|---|---|---|---|---|---|---|
| A2-S3-01 | First use of a single-use coupon (`usage_count` 0 → 1) | State Transition | User (id=2), `SAVE10` (`max_uses_per_user=1`), no prior usage | 1. `POST /api/apply-coupon` `{"code":"SAVE10","total_amount":500000,"user_id":2}` | 200 | `discount_amount`/`final_amount` per formula | FR-09 C5: `0 < 1` |
| A2-S3-02 | Second use of the same single-use coupon by the same user (`usage_count` 1 → reject) | State Transition | Continues from A2-S3-01 — `usage_count(2, SAVE10) = 1` | 1. `POST /api/apply-coupon` `{"code":"SAVE10","total_amount":500000,"user_id":2}` (repeat) | 400 | UNDETERMINED — spec gives no error text, but application must be rejected | FR-09 C5: `1 < 1` is false — quota exhausted |
| A2-S3-03 | Multi-use coupon within limit (`usage_count` 0 → 1 → 2 for `VIP100`, `max=2`) | State Transition | User (id=2), `VIP100` (`max_uses_per_user=2`), no prior usage | 1. `POST /api/apply-coupon` `{"code":"VIP100","total_amount":500000,"user_id":2}` 2. Same call again | 1. 200 2. 200 | Both succeed; `discount_amount = 100000` each time (fixed type) | FR-09 C5: `0 < 2`, then `1 < 2` |
| A2-S3-04 | Multi-use coupon at exactly the limit (`usage_count` 2 → reject) | State Transition (boundary) | Continues from A2-S3-03 — `usage_count(2, VIP100) = 2` | 1. `POST /api/apply-coupon` `{"code":"VIP100","total_amount":500000,"user_id":2}` (third call) | 400 | UNDETERMINED | FR-09 C5: `2 < 2` is false — this is the exact boundary the `<` comparison must reject |
| A2-S3-05 | Per-user quota isolation — a fresh user is unaffected by another user's exhausted quota | State Transition | User A (id=2) has exhausted `SAVE10` (from A2-S3-01/02); User B (id=3) has never used `SAVE10` | 1. As user B: `POST /api/apply-coupon` `{"code":"SAVE10","total_amount":500000,"user_id":3}` | 200 | Succeeds — B's own `usage_count` is 0 | FR-09 C5 is scoped "của user" (per-user), not global |

---

**Coverage note:** every seeded coupon's `max_uses_per_user` is exercised at least once (1 for
`SAVE10`/`BIGBUY`, 2 for `VIP100`); the transition *out of* the exhausted state (S3-02, S3-04) is
tested explicitly rather than only the forward happy path, per the generator's known failure mode
("final states are not tested").
