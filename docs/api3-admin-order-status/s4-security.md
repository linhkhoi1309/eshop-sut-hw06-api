# Stage S4: Security for API 3 (`PUT /api/admin/orders/:id/status`)

**Spec quoted:** FR-12 ("Tất cả các API Admin... đều phải yêu cầu: 1. Token JWT hợp lệ. 2.
`role = 'admin'` trong Token"); SEC-03 ("API Admin phải kiểm tra `role = 'admin'` trong Token, không
chỉ kiểm tra sự tồn tại của Token"); SEC-02 (valid JWT required); SEC-05 (parameterized queries);
FR-04 (a user "không thể tự thay đổi thuộc tính `role`" — the API 1 rule this endpoint's security
depends on staying true). Per the generator's stage-4 mandate, authentication (a token exists) and
authorization (the token's `role` claim) are tested as separate cases, not folded together — FR-12
itself states them as two numbered, independent conditions.

| ID | Title | Technique | Preconditions | Request | Expected Status | Expected Body | Spec Justification |
|---|---|---|---|---|---|---|---|
| A3-S4-01 | SEC-02: no `Authorization` header | Missing Auth | Order in `pending` | `PUT /api/admin/orders/{{id}}/status` (no header) Body: `{"status":"confirmed"}` | 401 | UNDETERMINED | FR-12 #1, SEC-02 |
| A3-S4-02 | SEC-02: malformed/invalid JWT | Invalid Auth | None | `Auth: Bearer invalid_token` Body: `{"status":"confirmed"}` | 401 or 403 | UNDETERMINED | SEC-02 |
| A3-S4-03 | SEC-03: valid token, `role='user'` (vertical privilege escalation) | Vertical Escalation | Logged in as a plain user (role='user'), order in `pending` | `Auth: Bearer {{userToken}}` Body: `{"status":"confirmed"}` | 403 | UNDETERMINED | FR-12 #2, SEC-03: "không chỉ kiểm tra sự tồn tại của Token" — token validity alone must not be sufficient |
| A3-S4-04 | SEC-03: escalation chain via API 1's SEC-06 defect | Vertical Escalation (composed) | Plain user (id=2). Order in `pending`. | 1. `PUT /api/users/me` Body: `{"role":"admin"}` (API 1's own mass-assignment surface) 2. `PUT /api/admin/orders/{{id}}/status` `Auth: Bearer {{userToken}}` (same, now-stale-claim token, or a freshly re-logged-in token reflecting the escalated DB role) Body: `{"status":"confirmed"}` | 403 (the token must not carry the escalated privilege, or if the DB truly changed, the *system design* must not allow that promotion to have happened in the first place) | UNDETERMINED | FR-12 #2, SEC-03, and FR-04's own role-immutability rule — a defect in one endpoint should not silently grant privilege on another |
| A3-S4-05 | FR-18 positive check: admin manages another user's order (not a violation — admin's cross-user reach is spec-required) | Access Control (positive) | Admin token. Order belongs to a *different* user (the victim), state `pending` | `Auth: Bearer {{adminToken}}` on the victim's order Body: `{"status":"confirmed"}` | 200 | UNDETERMINED | FR-18: "Admin xem toàn bộ đơn hàng của tất cả người dùng" — admin authority is explicitly cross-user, this must succeed, not be flagged as IDOR |
| A3-S4-06 | SEC-05: SQL injection in `status` (negative result expected) | SQL Injection | Order in `pending` | Body: `{"status":"confirmed'; DROP TABLE orders; --"}` | 400 | No DB error; treated as an invalid enum value | SEC-05: "Parameterized Query, không nối chuỗi trực tiếp" — expected PASS if parameterised |
| A3-S4-07 | SEC-05: SQL injection / path traversal via `:id` (negative result expected) | SQL Injection | None | `PUT /api/admin/orders/1%20OR%201%3D1/status` Body: `{"status":"confirmed"}` | UNDETERMINED (400 or 404, not a DB error / mass update) | No DB error; must not affect more than one row | SEC-05 |
| A3-S4-08 | Mass update guard: `:id` targeting an order does not affect any other order's row | Data Integrity | Two orders exist in `pending` (target + a control order) | `PUT /api/admin/orders/{{targetId}}/status` Body: `{"status":"confirmed"}`, then `GET /api/admin/orders` to check the control order | 200 for the PUT; control order's status unchanged | Control order remains `pending` | FR-15's "chỉ sản phẩm đó bị thay đổi" principle applied to orders — an `UPDATE` scoped only by `id` must not leak into other rows |
| A3-S4-09 | FR-18: `shipping_address` rendered safely in the admin order list (companion endpoint) | XSS / Output Encoding | An order's `shipping_address` contains `<script>alert(1)</script>` | `GET /api/admin/orders` `Auth: Bearer {{adminToken}}` | 200 | Response contains the raw string (API-level); safety is a front-end escaping concern, but the case documents the field is exercised | FR-18: "Địa chỉ giao hàng phải được hiển thị an toàn (không render HTML)" |

---

**Coverage note:** SEC-02 (A3-S4-01/02), SEC-03 (A3-S4-03/04), SEC-05 (A3-S4-06/07) and FR-18's two
explicit clauses (A3-S4-05 cross-user access, A3-S4-09 safe rendering) are each covered by at least
one case. A3-S4-03 tests authorization in isolation from authentication (a *valid* non-admin token);
A3-S4-01/02 test authentication in isolation from authorization (no token at all reaches the
role check).
