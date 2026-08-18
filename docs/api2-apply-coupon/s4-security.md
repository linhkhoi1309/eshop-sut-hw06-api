# Stage S4: Security for API 2 (`POST /api/apply-coupon`)

**Spec quoted:** FR-09 C4 ("Đã đăng nhập — Người dùng phải có JWT Token hợp lệ"); SEC-02 ("Các API
có tính bảo mật phải yêu cầu JWT Token hợp lệ"); SEC-05 ("Truy vấn CSDL phải dùng Parameterized
Query"). This endpoint's defining security shape is the S1-flagged conflict: `user_id` travels in
the body next to a condition (C4) that says identity must come from a JWT — that is authentication
folded into a body parameter, tested here as authorization, per the generator's stage-4 mandate to
split the two.

| ID | Title | Technique | Preconditions | Request | Expected Status | Expected Body | Spec Justification |
|---|---|---|---|---|---|---|---|
| A2-S4-01 | C4/SEC-02: no `Authorization` header at all | Missing Auth | None | `POST /api/apply-coupon` (no `Authorization` header) Body: `{"code":"SAVE10","total_amount":500000,"user_id":2}` | 401 | UNDETERMINED body, but request must be rejected | FR-09 C4 + SEC-02 both require a valid JWT to apply a coupon |
| A2-S4-02 | SEC-02: malformed/invalid JWT token | Invalid Auth | None | `Auth: Bearer invalid_token` Body: `{"code":"SAVE10","total_amount":500000,"user_id":2}` | 401 or 403 | UNDETERMINED | SEC-02 |
| A2-S4-03 | IDOR: caller's own token, but `user_id` in body names another user | IDOR | User A (id=2) logged in; victim B is id=3 | `Auth: Bearer {{userAToken}}` Body: `{"code":"SAVE10","total_amount":500000,"user_id":3}` | UNDETERMINED — spec does not say whether identity is taken from the token or the body | If C5's quota is per-user, the discount and the usage-count increment MUST apply to whichever identity the server actually uses — this case exposes which one it is | FR-09 C4/C5 assume a single, trustworthy identity; the spec doesn't reconcile body vs. token |
| A2-S4-04 | Quota bypass: `user_id` omitted entirely | Missing Identity | Coupon has 0 prior uses tracked without a `user_id` | Body: `{"code":"SAVE10","total_amount":500000}` (no `user_id`, with or without a valid `Authorization` header) | UNDETERMINED | If usage tracking requires `user_id` to key on, omitting it must not silently grant an unlimited-use coupon | FR-09 C5 — the counter must be tied to *some* identity, or the endpoint is exploitable |
| A2-S4-05 | Cross-user quota exhaustion (DoS on another user's allowance) | IDOR / Abuse | Attacker knows victim's numeric `user_id` (e.g., 3); victim has not yet used `SAVE10` | Attacker calls `POST /api/apply-coupon` repeatedly with `{"code":"SAVE10","total_amount":500000,"user_id":3}` until `max_uses_per_user` is reached for id=3 | UNDETERMINED | Victim's own subsequent legitimate call with their real token must then be rejected by C5 — the attacker consumed their quota without ever authenticating as them | FR-09 C4 requires *the* logged-in user's own JWT to establish identity, not an arbitrary body value |
| A2-S4-06 | SEC-05: SQL injection payload in `code` | SQL Injection (negative result) | None | Body: `{"code":"' OR '1'='1","total_amount":500000,"user_id":2}` | 400 | Coupon simply not found; no DB error, no 500 | SEC-05: "Parameterized Query, không nối chuỗi trực tiếp" — expected PASS if the query is parameterised |
| A2-S4-07 | Mass assignment: client supplies `discount_amount`/`final_amount` directly | Mass Assignment | Logged in | Body: `{"code":"SAVE10","total_amount":500000,"user_id":2,"discount_amount":999999,"final_amount":1}` | 200 | Server-computed `discount_amount`/`final_amount` MUST match the formula, ignoring the client-supplied values | Client input must never dictate a monetary computation the server is responsible for (FR-08 states the analogous rule for checkout's `total_amount`; FR-09 gives the discount formula as the server's sole authority) |

---

**Coverage note:** every SEC-xx requirement referenced by FR-09 (SEC-02, SEC-05) has at least one
case; C4 (authentication) and the body-vs-token identity question (authorization/IDOR) are tested as
separate cases (S4-01/02 vs. S4-03/04/05) rather than folded together, per the generator's stage-4
mandate.
