# Stage S1: Parameter Inventory for API 3 (`PUT /api/admin/orders/:id/status`)

**Spec quoted:**

> API spec §6.2: "**Cập nhật trạng thái đơn hàng:** `PUT /api/admin/orders/:id/status`. Body (JSON):
> `{"status": "confirmed"}` (Các trạng thái: `pending`, `confirmed`, `shipping`, `delivered`,
> `canceled`)." §6: "Tất cả API dưới đây yêu cầu `Authorization: Bearer <token>` và tài khoản phải
> có quyền Admin."
>
> FR-18: "Admin xem toàn bộ đơn hàng của tất cả người dùng. Admin có thể chuyển đổi trạng thái đơn
> hàng theo đúng State Machine đã định nghĩa ở FR-10. Địa chỉ giao hàng phải được hiển thị an toàn
> (không render HTML)."
>
> FR-12: "Phân hệ Admin chỉ dành cho tài khoản có `role = 'admin'`. Tất cả các API Admin
> (`/api/admin/*`)... đều phải yêu cầu: 1. Token JWT hợp lệ. 2. `role = 'admin'` trong Token."
>
> SEC-03: "API Admin phải kiểm tra `role = 'admin'` trong Token, không chỉ kiểm tra sự tồn tại của
> Token."
>
> FR-10: full 5-state machine (`pending`, `confirmed`, `shipping`, `delivered`, `canceled`) with a
> drawn forward diagram, cancel arrows from `pending`/`confirmed`, and: "Trạng thái `delivered` và
> `canceled` là trạng thái kết thúc — không được phép chuyển sang bất kỳ trạng thái nào khác. Khi
> đơn hàng đã ở trạng thái `shipping`, User không được phép tự hủy — chỉ Admin mới có thể thao tác."

| Parameter | Source | Type | Required/Optional | Spec Constraints | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `Authorization` | Header | String | Required | Valid JWT (FR-12 #1) **and** `role = 'admin'` in the token's claims (FR-12 #2, SEC-03) — two separate, stated conditions. | The endpoint under `/api/admin/*`, so both FR-12 clauses apply, not just token presence. |
| `:id` | Path | Integer | Required | Must identify an existing order. Spec gives no format constraint beyond being the order's identifier. | Not shown as a query/body field anywhere in §6.2 — purely a path segment. |
| `status` | Body | String (enum) | Required (implied — the only documented body field, and the endpoint's whole purpose) | One of `pending`, `confirmed`, `shipping`, `delivered`, `canceled` (§6.2). The *legality* of setting a given value depends on the order's **current** status per the FR-10 state machine — this is a state-transition concern (S3), not a plain domain-partition one. | No stated case-sensitivity rule; no stated behavior for an unrecognized string. |
| Order DB record (current `status`) | DB State | Enum | Required (implicit) | The "from" state in every FR-10 transition. | Not a request parameter, but it is what determines whether a given `status` value in the body is a legal transition — the entire subject of S3. |
| JWT `role` claim | Implicit | String | Required = `'admin'` | FR-12 #2, SEC-03 | The security-critical field the S4 stage targets — API 1's SEC-06 defect (client can set its own `role`) makes this claim attacker-influenced, not just attacker-observed. |
