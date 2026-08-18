# Stage S5: Schema Validation for API 2 (`POST /api/apply-coupon`)

**Spec quoted:** API §5.1 — "Trả về cấu trúc JSON chứa `discount_amount` và `final_amount`."
FR-09 formula — `discount_amount = total × discount_value / 100` (percent) or `discount_value`
(fixed); `final_amount = total - discount_amount`.

| ID | Title | Technique | Preconditions | Request | Expected Status | Expected Body Assertions | Spec Justification |
|---|---|---|---|---|---|---|---|
| A2-S5-01 | Success response shape — required fields present | Schema | Logged in, valid coupon application | `POST /api/apply-coupon` `{"code":"SAVE10","total_amount":500000,"user_id":2}` | 200 | JSON object contains `discount_amount` (number) and `final_amount` (number). | API §5.1: "chứa `discount_amount` và `final_amount`" |
| A2-S5-02 | `discount_amount` — value and bounds | Schema / Formula | Same as S5-01 | Same request | 200 | `discount_amount === total_amount * 10 / 100` (i.e. `50000` for this input); `0 <= discount_amount <= total_amount`. | FR-09 formula (percent type) |
| A2-S5-03 | `final_amount` — value and non-negativity | Schema / Formula | Same as S5-01 | Same request | 200 | `final_amount === total_amount - discount_amount` (i.e. `450000`); `final_amount >= 0`. | FR-09: `final_amount = total - discount_amount` |
| A2-S5-04 | Error response shape when any of C1–C5 fails | Schema | Coupon code does not exist | `{"code":"NOTREAL","total_amount":500000,"user_id":2}` | 400 | Response is a JSON object with an error/message field (exact key UNDETERMINED — spec gives no error schema); MUST NOT contain `discount_amount`/`final_amount`. | Implicit — a rejected application has no discount to report |
| A2-S5-05 | Response `Content-Type` is `application/json` | Header | Same as S5-01 | Same request | 200 | `Content-Type` header contains `application/json`. | Implicit JSON API standard (`res.json`) |
| A2-S5-06 | Response does not leak internal coupon-record fields | Negative Schema | Same as S5-01 | Same request | 200 | Response MUST NOT include unrelated internal fields such as the coupon's own `id`, `is_active`, `max_uses_per_user`, or another user's usage data. | API §5.1 states the response contains only `discount_amount`/`final_amount` — anything else is over-exposure |
