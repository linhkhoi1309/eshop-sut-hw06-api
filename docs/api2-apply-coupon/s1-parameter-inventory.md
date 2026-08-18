# Stage S1: Parameter Inventory for API 2 (`POST /api/apply-coupon`)

**Spec quoted:**

> API spec §5.1: "Tính toán tổng tiền sau khi giảm. Trả về cấu trúc JSON chứa `discount_amount` và
> `final_amount`." Body: `{"code": "SAVE10", "total_amount": 500000, "user_id": 1}`
>
> FR-09: "Tại bước Checkout, người dùng có thể nhập mã giảm giá. Hệ thống áp dụng giảm giá dựa trên
> 5 điều kiện sau, tất cả phải thỏa mãn": C1 mã tồn tại + `is_active=1`, C2 chưa hết hạn
> (`expired_at`), C3 `total >= min_order_amount`, C4 đã đăng nhập (JWT hợp lệ), C5 số lần dùng của
> user `< max_uses_per_user`.

| Parameter | Source | Type | Required/Optional | Spec Constraints | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `code` | Body | String | Required (implied — primary action target) | Must exist in DB, `is_active = 1` (C1), not past `expired_at` (C2). | No stated case-sensitivity rule. |
| `total_amount` | Body | Number | Required (implied — no discount computable without it) | Must be `>= min_order_amount` of the coupon (C3, spec states `>=` explicitly). | No stated type-coercion rule for non-numeric input. |
| `user_id` | Body | Integer | **Conflicting** | API spec §5.1 shows `user_id` as a body field; FR-09 C4 says the user "phải có JWT Token hợp lệ" (must have a valid JWT). Spec does not reconcile whether identity should come from the token or the body. | Flagged for S4 — this is a body-supplied identity next to an auth-required condition, a classic IDOR shape. |
| `Authorization` | Header | String | **Undetermined** | Not listed in API spec §5.1's request shape, but FR-09 C4 requires a valid JWT to apply a coupon at all. | Spec is internally inconsistent: §5.1's example body needs no header, FR-09 C4 requires one. Test both readings. |
| Coupon DB record | DB State | Record | Required | `code`, `type` (percent/fixed), `discount_value`, `min_order_amount`, `expired_at`, `max_uses_per_user`, `is_active`. Seeded samples: `SAVE10` (percent 10%, min 300,000, max 1/user), `BIGBUY` (fixed 50,000, min 500,000, max 1/user), `VIP100` (fixed 100,000, min 300,000, max 2/user), `EXPIRED` (percent 20%, min 100,000, expired 2020-01-01, max 1/user). | Target resource for the C1–C3 lookup. |
| Coupon usage count | DB State (implicit) | Integer | Required for C5 | "Số lần đã dùng mã này của user" — a per-`(user, code)` counter compared against `max_uses_per_user`. | Not a request parameter, but its prior state fully determines C5 and is the basis for S3's state-transition cases. |
| Current date/time | Implicit (server clock) | Date | Required for C2 | Compared against `expired_at`. | Not client-controlled; relevant to precondition setup only. |
