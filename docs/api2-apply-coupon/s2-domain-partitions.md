# Stage S2: Domain Partitions for API 2 (`POST /api/apply-coupon`)

**Spec quoted:** FR-09 C1–C3 (mã tồn tại + active, còn hạn, `total >= min_order_amount`); seeded
coupon table (§S1). One row per equivalence class / boundary, not one row per parameter.

| ID | Title | Technique | Preconditions | Request | Expected Status | Expected Body | Spec Justification |
|---|---|---|---|---|---|---|---|
| A2-S2-01 | code — valid, active, all conditions met (happy path) | EP | Logged in, `total_amount` above `SAVE10`'s threshold, quota unused | `POST /api/apply-coupon` Body: `{"code":"SAVE10","total_amount":500000,"user_id":2}` | 200 | `discount_amount` and `final_amount` present per formula | API §5.1 + FR-09 formula |
| A2-S2-02 | code — does not exist in DB | EP | None | Body: `{"code":"NOTREAL","total_amount":500000,"user_id":2}` | 400 | UNDETERMINED — spec gives no error text | FR-09 C1: "Mã phải có trong CSDL" |
| A2-S2-03 | code — exists but `is_active = 0` | EP | Precondition needs a deactivated coupon row (none seeded by default — set up via direct DB write or admin path if available); UNDETERMINED if reachable via API alone | Body: `{"code":"<inactive-code>","total_amount":500000,"user_id":2}` | 400 | UNDETERMINED | FR-09 C1: "đang hoạt động (`is_active = 1`)" |
| A2-S2-04 | code — exists, active, but past `expired_at` (`EXPIRED`) | BVA | Logged in | Body: `{"code":"EXPIRED","total_amount":500000,"user_id":2}` | 400 | UNDETERMINED | FR-09 C2: "Ngày hiện tại phải trước `expired_at`" — 2020-01-01 is in the past relative to 2026 |
| A2-S2-05 | code — empty string | EP | None | Body: `{"code":"","total_amount":500000,"user_id":2}` | 400 | UNDETERMINED | Empty code cannot satisfy C1 (no such row) |
| A2-S2-06 | code — wrong type (number instead of string) | EP | None | Body: `{"code":12345,"total_amount":500000,"user_id":2}` | UNDETERMINED | UNDETERMINED | Spec shows `code` as string; no type-validation rule stated |
| A2-S2-07 | code — omitted field | EP | None | Body: `{"total_amount":500000,"user_id":2}` | UNDETERMINED | UNDETERMINED — spec doesn't state whether `code` is mandatory, though the endpoint's purpose implies it is | API §5.1 body always shows `code` present |
| A2-S2-08 | total_amount — exactly at threshold (SAVE10, 300,000) | BVA | Logged in, quota unused | Body: `{"code":"SAVE10","total_amount":300000,"user_id":2}` | 200 | `discount_amount = 30000`, `final_amount = 270000` | FR-09 C3: "**>=** (lớn hơn hoặc bằng)" — the boundary itself must pass |
| A2-S2-09 | total_amount — just below threshold (299,999) | BVA | Logged in | Body: `{"code":"SAVE10","total_amount":299999,"user_id":2}` | 400 | UNDETERMINED | FR-09 C3 — one unit below the `>=` boundary must fail |
| A2-S2-10 | total_amount — just above threshold (300,001) | BVA | Logged in, quota unused | Body: `{"code":"SAVE10","total_amount":300001,"user_id":2}` | 200 | `discount_amount = 30000.1`, `final_amount = 270000.9` | FR-09 C3 |
| A2-S2-11 | total_amount — zero | EP | None | Body: `{"code":"SAVE10","total_amount":0,"user_id":2}` | 400 | UNDETERMINED | `0 < min_order_amount` for every seeded coupon, so C3 fails regardless of code |
| A2-S2-12 | total_amount — negative | EP | None | Body: `{"code":"SAVE10","total_amount":-500000,"user_id":2}` | 400 | UNDETERMINED | Not a valid order total; spec has no explicit rule but a negative amount cannot be a real cart total |
| A2-S2-13 | total_amount — non-numeric (string) | EP | None | Body: `{"code":"SAVE10","total_amount":"abc","user_id":2}` | UNDETERMINED | UNDETERMINED | Spec shows `total_amount` as a JSON number; no type-validation rule stated |
| A2-S2-14 | total_amount — omitted field | EP | None | Body: `{"code":"SAVE10","user_id":2}` | UNDETERMINED | UNDETERMINED | API §5.1 body always shows `total_amount` present |
| A2-S2-15 | user_id — omitted field | EP | Logged in via valid JWT | Body: `{"code":"SAVE10","total_amount":500000}` | UNDETERMINED | UNDETERMINED — if identity should come from the JWT (FR-09 C4), an omitted body `user_id` should not by itself be an error | FR-09 C4 implies the token, not the body, should carry identity |
| A2-S2-16 | user_id — wrong type (string instead of number) | EP | None | Body: `{"code":"SAVE10","total_amount":500000,"user_id":"2"}` | UNDETERMINED | UNDETERMINED | API §5.1 shows `user_id` as a JSON number; no type-validation rule stated |

---

**Coverage floor check:** `code` — 7 classes (valid, not-found, inactive, expired, empty, wrong-type,
omitted). `total_amount` — both sides of the C3 boundary plus the boundary itself (S2-08/09/10),
plus zero/negative/non-numeric/omitted. `user_id` — omitted and wrong-type (IDOR/mass-identity cases
deferred to S4, where authorization technique applies).
