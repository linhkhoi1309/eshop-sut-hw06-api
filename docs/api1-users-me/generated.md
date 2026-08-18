# API 1 — `PUT /api/users/me` (FR-04) — AI-Generated Test Cases

**Student:** 23127396 · **Generated:** 2026-08-18 · **AI:** Claude Opus 4.6 (Thinking)
**Endpoint:** `PUT /api/users/me` · **Companion:** `GET /api/users/me`
**Spec refs:** FR-04, SEC-01, SEC-02, SEC-04, SEC-05, SEC-06

---

## S1 — Parameter Inventory

| Parameter | Source | Type | Required/Optional | Spec Constraints | Notes |
|:---|:---|:---|:---|:---|:---|
| `Authorization` | Header | String | Required | Must be a valid JWT token (SEC-02). | Used to authenticate and extract user identity. |
| `name` | Body | String | Undetermined | Basic profile information. | Spec does not state if required for update. |
| `shipping_address` | Body | String | Undetermined | Default shipping address. | Spec does not state if required for update. |
| `phone` | Body | String | Undetermined | Must start with '0', length 10–11 digits (FR-04). | Only body field with explicit format constraint. |
| `email` | Body | String | Not Allowed | Cannot be changed via interface (FR-04). | Must be ignored or rejected if present. |
| `role` | Body | String | Not Allowed | User cannot change their own role (FR-04, SEC-06). | Must be ignored or rejected if present. |
| JWT `id` claim | Implicit | Integer | Required | Extracted from token; determines which user row is updated. | — |
| User Record | DB State | Record | Required | User must exist in the database. | Target resource for the update. |

---

## S2 — Domain Partitions (19 cases)

| ID | Title | Technique | Preconditions | Request | Expected Status | Expected Body | Spec Justification |
|---|---|---|---|---|---|---|---|
| A1-S2-01 | phone — valid lower boundary (10 digits, starts with 0) | BVA | Logged in as user (id=2) | `PUT /api/users/me` `Auth: Bearer {{userToken}}` Body: `{"name":"A","shipping_address":"B","phone":"0912345678"}` | 200 | `{"message":"Profile updated"}` | FR-04: "Số điện thoại hợp lệ: bắt đầu bằng số 0, từ 10–11 chữ số." |
| A1-S2-02 | phone — valid upper boundary (11 digits, starts with 0) | BVA | Logged in as user | `PUT /api/users/me` Body: `{"name":"A","shipping_address":"B","phone":"01234567890"}` | 200 | `{"message":"Profile updated"}` | FR-04: same |
| A1-S2-03 | phone — invalid below boundary (9 digits) | BVA | Logged in as user | Body: `{"name":"A","shipping_address":"B","phone":"012345678"}` | 400 | Error message (UNDETERMINED — spec gives no error text) | FR-04: "từ 10–11 chữ số" |
| A1-S2-04 | phone — invalid above boundary (12 digits) | BVA | Logged in as user | Body: `{"name":"A","shipping_address":"B","phone":"012345678901"}` | 400 | UNDETERMINED | FR-04: "từ 10–11 chữ số" |
| A1-S2-05 | phone — invalid prefix (not starting with 0) | EP | Logged in as user | Body: `{"name":"A","shipping_address":"B","phone":"1912345678"}` | 400 | UNDETERMINED | FR-04: "bắt đầu bằng số 0" |
| A1-S2-06 | phone — invalid format (+84 prefix) | EP | Logged in as user | Body: `{"name":"A","shipping_address":"B","phone":"+84912345678"}` | 400 | UNDETERMINED | FR-04: "bắt đầu bằng số 0, từ 10–11 chữ số" |
| A1-S2-07 | phone — invalid characters (contains letters) | EP | Logged in as user | Body: `{"name":"A","shipping_address":"B","phone":"091234567a"}` | 400 | UNDETERMINED | FR-04: "chữ số" = digits only |
| A1-S2-08 | phone — invalid type (number instead of string) | EP | Logged in as user | Body: `{"name":"A","shipping_address":"B","phone":912345678}` | 400 | UNDETERMINED | Body spec shows phone as string |
| A1-S2-09 | phone — omitted field | EP | Logged in as user, profile has existing phone | Body: `{"name":"A","shipping_address":"B"}` | UNDETERMINED | UNDETERMINED — spec silent on partial update. Existing phone should be preserved. | FR-04 does not specify partial-update semantics |
| A1-S2-10 | name — valid normal string | EP | Logged in as user | Body: `{"name":"John Doe","shipping_address":"B","phone":"0912345678"}` | 200 | `{"message":"Profile updated"}` | FR-04: "cập nhật: Họ Tên" |
| A1-S2-11 | name — valid 1 character | BVA | Logged in as user | Body: `{"name":"A","shipping_address":"B","phone":"0912345678"}` | 200 | `{"message":"Profile updated"}` | No min length specified |
| A1-S2-12 | name — valid unicode/emoji | EP | Logged in as user | Body: `{"name":"Nguyễn Văn A 🇻🇳","shipping_address":"B","phone":"0912345678"}` | 200 | `{"message":"Profile updated"}` | Vietnamese names require Unicode support |
| A1-S2-13 | name — invalid type (number) | EP | Logged in as user | Body: `{"name":12345,"shipping_address":"B","phone":"0912345678"}` | UNDETERMINED | UNDETERMINED | Spec does not define type validation |
| A1-S2-14 | name — omitted field | EP | Logged in as user, profile has existing name | Body: `{"shipping_address":"B","phone":"0912345678"}` | UNDETERMINED | UNDETERMINED — existing name should be preserved | FR-04 does not specify partial-update semantics |
| A1-S2-15 | shipping_address — valid normal string | EP | Logged in as user | Body: `{"name":"A","shipping_address":"123 Le Loi, Q1, TP.HCM","phone":"0912345678"}` | 200 | `{"message":"Profile updated"}` | FR-04: "cập nhật: ... Địa chỉ giao hàng mặc định" |
| A1-S2-16 | shipping_address — valid very long (1000 chars) | BVA | Logged in as user | Body: `{"name":"A","shipping_address":"<1000×'A'>","phone":"0912345678"}` | UNDETERMINED | UNDETERMINED | No max length specified |
| A1-S2-17 | shipping_address — invalid type (boolean) | EP | Logged in as user | Body: `{"name":"A","shipping_address":true,"phone":"0912345678"}` | UNDETERMINED | UNDETERMINED | Spec does not define type validation |
| A1-S2-18 | shipping_address — omitted field | EP | Logged in as user, profile has existing address | Body: `{"name":"A","phone":"0912345678"}` | UNDETERMINED | UNDETERMINED — existing address should be preserved | FR-04 does not specify partial-update semantics |
| A1-S2-19 | body — empty body `{}` | EP | Logged in as user | Body: `{}` | UNDETERMINED | UNDETERMINED | Spec doesn't clarify if all fields are optional |

---

## S3 — State Transitions (6 cases)

| ID | Title | Technique | Preconditions | Request Steps | Expected Status | Expected Body | Spec Justification |
|---|---|---|---|---|---|---|---|
| A1-S3-01 | Partial update destroys omitted fields | State Transition | User (id=2) has complete profile: name, shipping_address, phone all set | 1. `PUT /api/users/me` Body: `{"name":"Updated Name"}` 2. `GET /api/users/me` | 1. 200 2. 200 | `shipping_address` and `phone` remain unchanged (not NULL). | FR-04 allows updating fields; omitting a field should not delete it. |
| A1-S3-02 | Restore full profile from partial state | State Transition | User (id=2) profile is partially populated (address and phone are NULL from previous partial update) | 1. `PUT /api/users/me` Body: `{"name":"Full Name","shipping_address":"New Address","phone":"0987654321"}` 2. `GET /api/users/me` | 1. 200 2. 200 | All three fields restored to provided values. | FR-04: "cập nhật: Họ Tên, Số điện thoại, Địa chỉ giao hàng" |
| A1-S3-03 | Role escalation: user → admin via mass assignment | Privilege Transition | User (id=2, role='user') | 1. `PUT /api/users/me` Body: `{"name":"Hacker","shipping_address":"Addr","phone":"0912345678","role":"admin"}` 2. `GET /api/users/me` | 1. 200 OK (or 400/403 if rejected) 2. 200 | `role` MUST remain "user". | FR-04: "không thể tự thay đổi thuộc tính role"; SEC-06 |
| A1-S3-04 | Role de-escalation: admin → user via mass assignment | Privilege Transition | Admin (id=1, role='admin') | 1. `PUT /api/users/me` Body: `{"name":"Admin","shipping_address":"Addr","phone":"0912345678","role":"user"}` 2. `GET /api/users/me` | 1. 200 OK (or 400/403) 2. 200 | `role` MUST remain "admin". | FR-04: "không thể tự thay đổi thuộc tính role" |
| A1-S3-05 | Stale JWT after DB role change | Auth / Privilege | User has JWT issued when role='user'. DB role modified externally to 'admin'. | 1. Use original JWT to access admin endpoint (e.g. `GET /api/admin/users`) | 403 | Insufficient permissions — old JWT should not grant new privileges. | UNDETERMINED — spec does not specify if JWT claims are re-verified against DB. Implicit security principle. |
| A1-S3-06 | Idempotent PUT — same update twice | Idempotency | User (id=2), any profile state | 1. `PUT /api/users/me` Body: `{"name":"Stable","shipping_address":"Stable Addr","phone":"0911111111"}` 2. Same PUT again 3. `GET /api/users/me` | 1. 200 2. 200 3. 200 | Data matches payload after both calls. | PUT is idempotent by HTTP semantics. |

---

## S4 — Security (11 cases)

| ID | Title | Technique | Preconditions | Request | Expected Status | Expected Body | Spec Justification |
|---|---|---|---|---|---|---|---|
| A1-S4-01 | SEC-06: Mass assignment of `role` field (flagship) | Privilege Escalation | User (id=2, role='user') | `PUT /api/users/me` Body: `{"role":"admin"}` | 400 or 200 (role unchanged) | Role must NOT be updated. Subsequent GET must show role='user'. | FR-04: "không thể tự thay đổi thuộc tính role"; SEC-06 |
| A1-S4-02 | SEC-06: Mass assignment of `email` field | Mass Assignment | User (id=2) | `PUT /api/users/me` Body: `{"email":"hacked@evil.com"}` | 200 or 400 | Email must remain unchanged at `test@eshop.com`. | FR-04: "Email không được phép thay đổi qua giao diện." |
| A1-S4-03 | SEC-06: Mass assignment of `id` field | Mass Assignment | User (id=2) | `PUT /api/users/me` Body: `{"id":999}` | 200 or 400 | ID must remain 2. | FR-04 only allows: name, phone, shipping_address. |
| A1-S4-04 | SEC-06: Mass assignment of `password` field | Mass Assignment | User (id=2) | `PUT /api/users/me` Body: `{"password":"hacked"}` | 200 or 400 | Password must remain unchanged (verify by logging in with original password). | FR-04 specifies allowed fields. Password change must use separate flow. |
| A1-S4-05 | SEC-06: Mass assignment of `login_attempts` | Mass Assignment | User (id=2) | `PUT /api/users/me` Body: `{"login_attempts":0}` | 200 or 400 | `login_attempts` must remain unchanged. | FR-04 specifies allowed fields. |
| A1-S4-06 | SEC-02: No Authorization header | Missing Auth | None | `PUT /api/users/me` (no Auth header) Body: `{"name":"X"}` | 401 | `{"error":"Unauthorized"}` | SEC-02: "Các API có tính bảo mật phải yêu cầu JWT Token hợp lệ." |
| A1-S4-07 | SEC-02: Malformed JWT token | Invalid Auth | None | `PUT /api/users/me` `Auth: Bearer invalid_token` Body: `{"name":"X"}` | 403 | `{"error":"Forbidden"}` | SEC-02 |
| A1-S4-08 | SEC-02: Empty Bearer value | Missing Auth | None | `PUT /api/users/me` `Auth: Bearer ` (trailing space) Body: `{"name":"X"}` | 401 | `{"error":"Unauthorized"}` | SEC-02 |
| A1-S4-09 | SEC-04: XSS payload in name field | XSS | User (id=2) | `PUT /api/users/me` Body: `{"name":"<script>alert(1)</script>","shipping_address":"B","phone":"0912345678"}` | 200 | Profile updated. Stored value must be escaped on display. | SEC-04: "escape đúng cách, không dùng innerHTML" |
| A1-S4-10 | SEC-05: SQL injection in phone field (negative result) | SQL Injection | User (id=2) | `PUT /api/users/me` Body: `{"phone":"'; DROP TABLE users; --"}` | 200 | Profile updated normally. No DB error. | SEC-05: "Parameterized Query, không nối chuỗi trực tiếp." Implementation uses `?` params — expected PASS. |
| A1-S4-11 | SEC-01: Password exposure in GET response | Data Exposure | User (id=2) | `GET /api/users/me` `Auth: Bearer {{userToken}}` | 200 | Response MUST NOT contain `password` field. | SEC-01; FR-19: "không lộ mật khẩu" |

---

## S5 — Schema Validation (4 cases, 2 de-duplicated)

*A1-S5-02/S5-03 (auth error shapes) merged into S4-06/S4-07. A1-S5-05 (password absence) merged into S4-11.*

| ID | Title | Technique | Preconditions | Request | Expected Status | Expected Body Assertions | Spec Justification |
|---|---|---|---|---|---|---|---|
| A1-S5-01 | PUT success response shape | Schema | User (id=2) | `PUT /api/users/me` Body: `{"name":"New Name"}` | 200 | JSON object with `message` (string) = "Profile updated". No other unexpected keys. | Observed SUT response shape. |
| A1-S5-02 | GET success response shape — required fields | Schema | User (id=2) | `GET /api/users/me` | 200 | Contains: `id` (number), `name` (string), `email` (string), `role` (string), `shipping_address` (string\|null), `phone` (string\|null) | API spec §2.1 returns user object. |
| A1-S5-03 | GET response — sensitive fields ABSENT | Negative Schema | User (id=2) | `GET /api/users/me` | 200 | `password`, `reset_token`, `login_attempts`, `locked_until` MUST NOT be present. | SEC-01; FR-19 |
| A1-S5-04 | Response Content-Type is application/json | Header | User (id=2) | `GET /api/users/me` | 200 | `Content-Type` header contains `application/json`. | Implicit JSON API standard (`res.json`). |

---

## S6 — Consolidation Summary

### Case Count

| Stage | Count | Notes |
|---|---|---|
| S2 Domain Partitions | 19 | 9 phone, 5 name, 4 shipping_address, 1 empty body |
| S3 State Transitions | 6 | 2 profile state, 2 privilege state, 1 stale JWT, 1 idempotency |
| S4 Security | 11 | 5 mass assignment, 3 auth, 1 XSS, 1 SQLi, 1 password exposure |
| S5 Schema | 4 | 1 PUT shape, 2 GET shape + absence, 1 Content-Type |
| **Total** | **40** | ≥35 ✅ |

### De-duplication Log

| Removed | Merged Into | Reason |
|---|---|---|
| A1-S5-02 (401 error shape) | A1-S4-06 | Same request, same assertion scope |
| A1-S5-03 (403 error shape) | A1-S4-07 | Same request, same assertion scope |
| A1-S5-05 (password absence) | A1-S4-11 + A1-S5-03 | Split: SEC-01 aspect to S4-11, broader absence to S5-03 |

### Expected Failures (assert spec, SUT violates)

| Case ID | Why it fails against SUT |
|---|---|
| A1-S2-03 to A1-S2-08 | SUT has **no phone validation** — accepts anything (BUG-09) |
| A1-S3-01 | Partial update **silently NULLs** omitted fields (BUG-08) |
| A1-S3-03, A1-S4-01 | SUT **accepts `role` in body** and updates it (BUG-01) |
| A1-S3-04 | Same — admin can de-escalate themselves |
| A1-S4-11, A1-S5-03 | GET returns **plaintext password** and internal fields (BUG-04) |

### Priority

| Priority | Cases |
|---|---|
| **Critical** | A1-S4-01, A1-S3-03 (role mass assignment), A1-S4-11 (password exposure) |
| **High** | A1-S3-01 (data loss), A1-S2-03–08 (phone validation), A1-S4-06–08 (auth) |
| **Medium** | A1-S4-02–05 (other mass assignment), A1-S4-09 (XSS), A1-S4-10 (SQLi) |
| **Low** | A1-S2-13/16/17 (type coercion edge cases), A1-S5-04 (Content-Type) |
