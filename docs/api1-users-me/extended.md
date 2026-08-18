# API 1 — `PUT /api/users/me` (FR-04) — Human-Added Test Cases

**Student:** 23127396 · **Extended:** 2026-08-18
**Source audit:** [`audit.md`](file:///C:/Users/Khoi/Downloads/23127396_HW06_AI_API_090/docs/api1-users-me/audit.md)

> Each case below was missed by the AI. For each, the *mechanism* of the miss is stated —
> not just "the AI didn't think of it" but which structural cause (prompt scope, model tendency,
> missing fixture, spec silence) made the case unreachable.

---

## Gap Categories (from audit skill)

| # | Category | Applies to API 1? |
|---|---|---|
| E1 | Vertical privilege escalation on admin routes | Indirectly — the SEC-06 chain leads to admin access |
| E2 | Transitions out of final states | No — not a state-machine endpoint |
| E3 | Mass assignment / privileged-field injection | Yes — edge cases around JS truthiness |
| E4 | Cross-user data access (IDOR) | Yes — forged JWT with another user's ID |
| E5 | Exact-threshold boundaries | Yes — zero-length strings, formatting chars |

---

## Extended Test Cases

### A1-EX-01 — Phone: empty string `""` (zero-length boundary)

| Field | Value |
|---|---|
| **ID** | A1-EX-01 |
| **Title** | phone — empty string `""` (zero-length boundary, not omitted) |
| **Technique** | BVA — exact boundary |
| **Preconditions** | Logged in as user (id=2). Profile has existing phone `0912345678`. |
| **Request** | `PUT /api/users/me` `Auth: Bearer {{userToken}}` Body: `{"name":"Test User","shipping_address":"123 Le Loi","phone":""}` |
| **Expected Status** | 400 (per spec: phone must be 10–11 digits starting with `0`; `""` has 0 digits) |
| **Expected Body** | Error message indicating invalid phone format |
| **Spec Justification** | FR-04: "Số điện thoại hợp lệ: bắt đầu bằng số 0, từ 10–11 chữ số." Zero digits fails both constraints. |
| **SUT Behavior** | 200 — `server.js:121` stores `""` without validation. Tag: `EXPECTED-FAIL` → BUG-09 |
| **Defect targeted** | BUG-09 (no phone validation) |

**Why the AI missed it:** **(E5) Exact-threshold boundary.** The AI generated boundary cases for 9/10/11/12 digits and tested "omitted" (undefined), but skipped the zero-length string `""`. The model treats "omitted" and "empty" as the same class, but they are semantically distinct: omitted → `undefined` → NULL in SQLite, while `""` → empty string stored as `""`. The spec constraint "10–11 chữ số" makes `""` an invalid value at the lower extreme, which is a different partition from "omitted/absent". The AI clusters around the spec-stated boundary (10) and misses the natural zero.

---

### A1-EX-02 — Phone with formatting characters (spaces/dashes)

| Field | Value |
|---|---|
| **ID** | A1-EX-02 |
| **Title** | phone — formatted with spaces `"091 234 5678"` |
| **Technique** | EP — real-world input class |
| **Preconditions** | Logged in as user (id=2) |
| **Request** | `PUT /api/users/me` `Auth: Bearer {{userToken}}` Body: `{"name":"Test User","shipping_address":"123 Le Loi","phone":"091 234 5678"}` |
| **Expected Status** | 400 (spec says "chữ số" = digits; spaces are not digits) |
| **Expected Body** | Error message indicating invalid phone format |
| **Spec Justification** | FR-04: "từ 10–11 chữ số" — "chữ số" means digits exclusively. Spaces/dashes are not digits. |
| **SUT Behavior** | 200 — no validation at all. Tag: `EXPECTED-FAIL` → BUG-09 |
| **Defect targeted** | BUG-09 |

**Why the AI missed it:** **(E5) Prompt scope / model tendency.** The AI generated "contains letters" (A1-S2-07) and "+84 format" (A1-S2-06) as invalid-character cases, but not spaces or dashes — the most common real-world phone formatting characters. The model's training distribution is dense in "obviously wrong" inputs (letters, symbols) and sparse in "plausibly formatted but technically non-conforming" inputs. A human tester thinks "how would a real user type their phone number?" and reaches `091 234 5678` immediately.

---

### A1-EX-03 — Cross-user profile write via forged JWT (IDOR)

| Field | Value |
|---|---|
| **ID** | A1-EX-03 |
| **Title** | IDOR — forge JWT with victim's ID to overwrite their profile |
| **Technique** | Security — IDOR (E4) |
| **Preconditions** | Know the SECRET_KEY (`super_secret_key_that_should_not_be_here` from `server.js:9`). Victim user (id=3) has known profile. |
| **Request Steps** | 1. Craft a JWT: `jwt.sign({ id: 3, role: "user" }, "super_secret_key_that_should_not_be_here")` 2. `PUT /api/users/me` using the forged token. Body: `{"name":"PWNED","shipping_address":"Hacked","phone":"0999999999"}` 3. Login as victim and `GET /api/users/me` to verify. |
| **Expected Status** | The endpoint should reject the request or the profile should remain unchanged. |
| **Expected Body** | Victim's profile must NOT be modified by a forged token. |
| **Spec Justification** | FR-04: "Người dùng chỉ có thể cập nhật hồ sơ của chính mình." SEC-02: JWT must be valid. |
| **SUT Behavior** | 200 — `authenticateToken` only verifies the JWT signature (`server.js:105`). Since the SECRET_KEY is hardcoded and known, the forged token passes verification. `req.user.id` becomes 3, and the victim's profile is overwritten. This is a **real vulnerability** — the hardcoded secret means any attacker who reads the source code can impersonate any user. |
| **Defect targeted** | Related to BUG-11 (hardcoded JWT secret). The IDOR is a consequence of the key being known. |

**Why the AI missed it:** **(E4) Missing fixture / prompt scope.** IDOR requires reasoning about a *second* user identity and the ability to *forge* a token — two things outside the standard prompt scope. The AI was given test@eshop.com's credentials and reasons about "the authenticated user." Forging a JWT requires knowing the secret key, which is an implementation detail the AI doesn't spontaneously weaponize from the spec. The case is unreachable from a spec-only prompt because the spec doesn't mention the secret key.

---

### A1-EX-04 — `role: ""` (empty string — falsy in JavaScript)

| Field | Value |
|---|---|
| **ID** | A1-EX-04 |
| **Title** | Mass assignment: `role: ""` (falsy string bypasses the role update) |
| **Technique** | Security — implementation-aware boundary (E3) |
| **Preconditions** | Logged in as user (id=2, role='user') |
| **Request** | `PUT /api/users/me` `Auth: Bearer {{userToken}}` Body: `{"name":"Test","shipping_address":"Addr","phone":"0912345678","role":""}` |
| **Expected Status** | 200 (per spec: role field should be ignored entirely) |
| **Expected Body** | `{"message":"Profile updated"}`. Role remains "user" via `GET /api/users/me`. |
| **Spec Justification** | FR-04 / SEC-06: role must not be changeable. Any value of `role` in the body should be ignored. |
| **SUT Behavior** | 200 — and role is NOT changed, because `if (role)` at `server.js:124` evaluates `""` as **falsy**, so the role column is not appended to the UPDATE query. This case **passes** — but for the wrong reason (JS truthiness, not spec enforcement). Compare with `role: "admin"` which is truthy → role IS updated (BUG-01). |
| **Defect targeted** | Boundary of BUG-01 — exposes that the `if (role)` guard is a truthiness check, not a security check. |

**Why the AI missed it:** **(E3) Model limitation — no JavaScript truthiness reasoning.** The AI tested `role: "admin"` (truthy → accepted) and `role: "user"` (truthy → accepted) but never tested the falsy edge. The model reasons about the *semantic meaning* of values ("admin" means escalation, "user" means de-escalation) rather than about how the JavaScript runtime evaluates them. The empty string is a meaningless value semantically, so the AI skips it — but it's the exact value that reveals the implementation's guard mechanism is truthiness-based rather than allowlist-based.

---

### A1-EX-05 — Wrong Content-Type causes silent data wipe

| Field | Value |
|---|---|
| **ID** | A1-EX-05 |
| **Title** | Non-JSON Content-Type (`text/plain`) causes all profile fields to become NULL |
| **Technique** | Robustness / Security — middleware bypass |
| **Preconditions** | Logged in as user (id=2). Profile fully populated. |
| **Request** | `PUT /api/users/me` `Auth: Bearer {{userToken}}` `Content-Type: text/plain` Body (raw text): `{"name":"Test","shipping_address":"Addr","phone":"0912345678"}` |
| **Expected Status** | 400 (should reject non-JSON body) or 200 with data preserved |
| **Expected Body** | If 200, profile fields must NOT be wiped. |
| **Spec Justification** | API spec §2.2 shows JSON body. The endpoint should either require JSON or handle non-JSON gracefully. |
| **SUT Behavior** | 200 — `bodyParser.json()` (`server.js:12`) silently skips non-JSON content types, leaving `req.body` as `undefined`. The handler destructures `{ name, shipping_address, phone, role }` from `undefined` — which doesn't throw in JS (all become `undefined`). The UPDATE sets all three columns to NULL. **Silent total data loss.** This is a severe variant of BUG-08. |
| **Defect targeted** | BUG-08 (data loss), compounded by missing Content-Type validation. |

**Why the AI missed it:** **(Prompt scope — infrastructure layer invisible.)** The AI reasons about the endpoint handler and the spec. It does not reason about the Express middleware pipeline (`bodyParser.json()`) or what happens when the middleware's precondition (correct Content-Type) is violated. The middleware is invisible in the spec and rarely visible in the handler code. A human tester who has debugged Express apps knows that `bodyParser.json()` is a silent filter — it doesn't error on wrong Content-Type, it just doesn't parse.

---

### A1-EX-06 — Name: empty string `""` with all other fields valid

| Field | Value |
|---|---|
| **ID** | A1-EX-06 |
| **Title** | name — empty string `""` (not omitted; semantically empty name) |
| **Technique** | BVA — exact boundary (E5) |
| **Preconditions** | Logged in as user (id=2). Profile has existing name "Test User". |
| **Request** | `PUT /api/users/me` `Auth: Bearer {{userToken}}` Body: `{"name":"","shipping_address":"123 Le Loi","phone":"0912345678"}` |
| **Expected Status** | 400 (a user should have a non-empty name; FR-04 says "Họ Tên" is an updatable field, implying it has a value) or 200 if spec allows empty |
| **Expected Body** | UNDETERMINED — spec does not explicitly require non-empty name, but FR-01 requires a name at registration. |
| **Spec Justification** | FR-01 requires "Họ Tên" at registration (implying it must have a value). FR-04 allows updating it — but does "update" include "delete by setting empty"? Spec is silent. |
| **SUT Behavior** | 200 — `server.js:121` stores `""` without validation. Name becomes empty string in DB. |
| **Defect targeted** | BUG-09 (broader: no input validation on any field, not just phone). |

**Why the AI missed it:** **(E5) Exact-threshold boundary + model tendency.** The AI tested `name: 1 character` (A1-S2-11) and `name: omitted` (A1-S2-14) but not `name: ""`. Same pattern as A1-EX-01 — the model jumps from "present with minimum content" to "absent" without testing the zero-length-but-present boundary. This is a consistent AI blind spot: the training distribution treats empty strings and absent values as interchangeable, but they produce different behavior in the implementation.

---

## Summary

| ID | Title | Category | Why AI missed | Bug |
|---|---|---|---|---|
| A1-EX-01 | phone = `""` (zero-length) | E5 | Conflates "omitted" with "empty" | BUG-09 |
| A1-EX-02 | phone with spaces `"091 234 5678"` | E5 | Trained on "obviously wrong" not "plausibly formatted" | BUG-09 |
| A1-EX-03 | IDOR via forged JWT | E4 | Single-actor prompt; can't weaponize hardcoded secret | BUG-11 |
| A1-EX-04 | `role: ""` (JS falsy bypass) | E3 | No JS truthiness reasoning | BUG-01 boundary |
| A1-EX-05 | Wrong Content-Type → data wipe | Prompt scope | Middleware layer invisible to spec-driven prompts | BUG-08 variant |
| A1-EX-06 | name = `""` (zero-length) | E5 | Same empty-vs-absent conflation as EX-01 | BUG-09 |
