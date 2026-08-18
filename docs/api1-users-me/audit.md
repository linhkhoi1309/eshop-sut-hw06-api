# API 1 — `PUT /api/users/me` (FR-04) — Human Audit of AI-Generated Test Cases

**Student:** 23127396 · **Audited:** 2026-08-18
**Source:** [`generated.md`](file:///C:/Users/Khoi/Downloads/23127396_HW06_AI_API_090/docs/api1-users-me/generated.md)
**Oracles:** Spec = [`README.md` FR-04, SEC-01–06](file:///C:/Users/Khoi/Downloads/23127396_HW06_AI_API_090/sut/README.md) · Impl = [`server.js:118-135`](file:///C:/Users/Khoi/Downloads/23127396_HW06_AI_API_090/sut/backend/server.js#L118-L135)

---

## Audit Labels

| Label | Count |
|---|---|
| **VALID** | 24 |
| **INVALID** | 5 |
| **INCOMPLETE** | 11 |

---

## S2 — Domain Partitions

| ID | Label | Reasoning | Correction (if any) |
|---|---|---|---|
| A1-S2-01 | **VALID** | Correct. 10-digit phone starting with `0` is valid per FR-04. Spec: "bắt đầu bằng số 0, từ 10–11 chữ số." Impl `server.js:121` accepts anything → SUT will return 200, matching expectation. | — |
| A1-S2-02 | **VALID** | Correct. 11-digit phone starting with `0` is the upper valid boundary. Same spec line. SUT returns 200. | — |
| A1-S2-03 | **INCOMPLETE** | Right idea — 9 digits should be rejected per spec. But the case says "UNDETERMINED" for expected body. Per spec, the server should return an error; the exact message text is indeed unspecified, but we can still assert status 400 and the presence of an `error` key. Also: must be tagged `EXPECTED-FAIL` since impl `server.js:118-135` has **no validation** — it will return 200. | **Correction:** Expected status = 400. Expected body = `response has key "error"`. Tag: `EXPECTED-FAIL` → BUG-09. |
| A1-S2-04 | **INCOMPLETE** | Same as A1-S2-03. 12 digits is above boundary. Needs concrete assertion and EXPECTED-FAIL tag. | **Correction:** Same fix — assert 400 + error key. Tag: `EXPECTED-FAIL` → BUG-09. |
| A1-S2-05 | **INCOMPLETE** | Same pattern. "1912345678" doesn't start with `0`. Needs EXPECTED-FAIL. | **Correction:** Assert 400. Tag: `EXPECTED-FAIL` → BUG-09. |
| A1-S2-06 | **INCOMPLETE** | Same. "+84912345678" doesn't start with `0` and has non-digit chars. | **Correction:** Assert 400. Tag: `EXPECTED-FAIL` → BUG-09. |
| A1-S2-07 | **INCOMPLETE** | Same. Contains letter `a`. | **Correction:** Assert 400. Tag: `EXPECTED-FAIL` → BUG-09. |
| A1-S2-08 | **INVALID** | The case expects 400 for sending a number instead of string. But the spec does not define type validation — it only says "10–11 chữ số bắt đầu bằng 0". A JSON number `912345678` is 9 digits and doesn't start with `0`, so it's invalid for two spec reasons. However, the case title says "invalid type" which implies the type itself is the problem. The real problem is format, not type. In implementation, SQLite stores it as `"912345678"` (stringified), which is 9 digits — rejected for length/prefix, not type. | **Correction:** Retitle to "phone — numeric 912345678 (wrong prefix + 9 digits)". Expected: 400. This is a format violation, not a type violation. The AI confused type checking (which doesn't exist in the spec) with format checking (which does). Tag: `EXPECTED-FAIL` → BUG-09. |
| A1-S2-09 | **INCOMPLETE** | Right idea — tests omitted phone. But says "UNDETERMINED" for both status and body. We can resolve this: per FR-04, users "can update" fields — omitting a field should preserve existing data (standard PATCH/PUT behavior). The spec does not say all fields are required. Impl `server.js:121` always writes all three columns, so omitted phone → `undefined` → NULL in SQLite. This is a **bug** (BUG-08). Assert spec behavior: 200 + existing phone preserved. | **Correction:** Expected status = 200. Expected body = `{"message":"Profile updated"}`. Verify via GET that phone is NOT null. Tag: `EXPECTED-FAIL` → BUG-08 (data loss on partial update). |
| A1-S2-10 | **VALID** | Correct. Normal name string, complete body. SUT returns 200. | — |
| A1-S2-11 | **VALID** | Correct. 1-char name, no min length in spec. SUT returns 200. | — |
| A1-S2-12 | **VALID** | Correct. Unicode/emoji in name. SQLite TEXT handles UTF-8. SUT returns 200. | — |
| A1-S2-13 | **INVALID** | Says "UNDETERMINED" but we can resolve: the spec does not prohibit a numeric name, and the implementation (`server.js:119`) just destructures `name` from body and passes it to SQLite — a number is stored as-is. The case should expect 200 (implementation behavior = spec-silent → test what happens, report if it's wrong). Since there's no spec rule being violated, this is an exploratory case, not a partition-derived one. | **Correction:** Expected status = 200. Expected body = `{"message":"Profile updated"}`. Note: exploratory — spec silent on type. No EXPECTED-FAIL (not a bug, just unspecified). |
| A1-S2-14 | **INCOMPLETE** | Same as A1-S2-09. Omitted name. Impl writes NULL. Spec implies preservation. | **Correction:** Expected 200, verify via GET that name is NOT null. Tag: `EXPECTED-FAIL` → BUG-08. |
| A1-S2-15 | **VALID** | Correct. Normal address. SUT returns 200. | — |
| A1-S2-16 | **INVALID** | Says "UNDETERMINED" but should be 200 — neither spec nor implementation sets a max length. SQLite TEXT has no length limit. The case title says "valid very long" but then marks status as UNDETERMINED, which contradicts the title. | **Correction:** Expected status = 200. Expected body = `{"message":"Profile updated"}`. Exploratory — no spec rule on length. |
| A1-S2-17 | **INVALID** | Same as A1-S2-13. Boolean `true` for shipping_address — spec is silent on type, impl stores it, returns 200. Marking UNDETERMINED is wrong when both oracles agree on the outcome. | **Correction:** Expected status = 200. Expected body = `{"message":"Profile updated"}`. Exploratory. |
| A1-S2-18 | **INCOMPLETE** | Same as A1-S2-09/14. Omitted address → NULL in impl. | **Correction:** Expected 200, verify via GET that shipping_address is NOT null. Tag: `EXPECTED-FAIL` → BUG-08. |
| A1-S2-19 | **INCOMPLETE** | Empty body `{}` — all three fields become NULL. Impl `server.js:121` writes `undefined` for all. Should assert 200 (impl behavior) and verify via GET that all fields are NULL. This is a special case of BUG-08. | **Correction:** Expected 200. Verify via GET: name, shipping_address, phone all become NULL. Tag: `EXPECTED-FAIL` → BUG-08 (if spec intent is that empty body should be rejected or preserve data). |

---

## S3 — State Transitions

| ID | Label | Reasoning | Correction (if any) |
|---|---|---|---|
| A1-S3-01 | **VALID** | Correct and important. Tests the data-loss bug (BUG-08). Asserts spec behavior (fields preserved). Impl `server.js:121` always writes all columns → omitted fields become NULL. Tag: `EXPECTED-FAIL` → BUG-08. | — |
| A1-S3-02 | **VALID** | Correct. Restoration after data loss. Tests that a full PUT restores all three fields. Both oracles agree: 200 + fields updated. | — |
| A1-S3-03 | **VALID** | Correct. Tests SEC-06 / BUG-01. Spec says role must not change. Impl `server.js:124` accepts it. `EXPECTED-FAIL`. Note: overlaps with A1-S4-01 but tests the multi-step state transition (PUT + verify GET), whereas S4-01 tests the security policy in isolation. Both are needed. | — |
| A1-S3-04 | **VALID** | Correct. Mirror of S3-03 for de-escalation. Same SEC-06 violation applies in both directions. Uses admin token → updates admin's own profile. | — |
| A1-S3-05 | **INVALID** | The case says "DB role modified externally" but there's no mechanism to do this in the test suite without SQL injection or direct DB access, which Newman cannot do. The case is **not executable** as stated. Also, the JWT is stateless — `authenticateToken` at `server.js:105` only checks the signature, never re-reads the DB. So the old token's claims persist regardless of DB changes. The case tests a legitimate security concern but is impractical in this harness. | **Correction:** Rework as: (1) Login as user → get token with `role: user`. (2) Use A1-S3-03 to promote to admin via mass assignment. (3) Try to access `/api/admin/users` with the *original* token (which still has `role: user` in claims). (4) Expected: the admin endpoint should check DB role, but since `authenticateToken` only checks JWT claims, the original token still works as user-level. This tests that JWT claims are stale — a real finding, but the expected result is UNDETERMINED since neither oracle specifies re-verification. Mark as exploratory. |
| A1-S3-06 | **VALID** | Correct. PUT idempotency is a standard HTTP contract. Both oracles agree. | — |

---

## S4 — Security

| ID | Label | Reasoning | Correction (if any) |
|---|---|---|---|
| A1-S4-01 | **INCOMPLETE** | Right test, but the case says "400 or 200 (role unchanged)" — this ambiguity is a problem. The spec is clear: role must NOT change. The case should commit to asserting the spec behavior and include the verification step (GET to confirm role unchanged). Without the GET, the case only checks the PUT response, which will be 200 regardless. | **Correction:** Assert 200 for PUT (impl always returns 200). Add step 2: `GET /api/users/me` and assert `role === "user"`. Tag: `EXPECTED-FAIL` → BUG-01 (role will be "admin" in GET response). |
| A1-S4-02 | **VALID** | Correct. Email is not in the UPDATE column list (`server.js:121`), so it's correctly ignored. Verification via GET confirms email unchanged. Both oracles agree — this is a **passed** negative result. | — |
| A1-S4-03 | **VALID** | Correct. `id` is not destructured from body or used in UPDATE columns. The `WHERE id = ?` uses `req.user.id` from JWT (`server.js:129`). Both oracles agree — id cannot be changed. | — |
| A1-S4-04 | **VALID** | Correct. `password` is not in the UPDATE column list. Impl ignores it. Verify by re-logging with original password. Both oracles agree. | — |
| A1-S4-05 | **VALID** | Correct. `login_attempts` is not in the UPDATE column list. Both oracles agree. | — |
| A1-S4-06 | **VALID** | Correct. No Authorization header → `token == null` at `server.js:103` → 401 `{ error: "Unauthorized" }`. Both oracles agree. | — |
| A1-S4-07 | **VALID** | Correct. `"invalid_token"` fails `jwt.verify` → `server.js:106` → 403 `{ error: "Forbidden" }`. Both oracles agree. | — |
| A1-S4-08 | **INCOMPLETE** | Right idea, but the expected behavior needs verification. `Authorization: Bearer ` (space then empty) → `authHeader.split(" ")[1]` returns `""` which is falsy in JS (`"" == null` is false, but `"" == null` → false. Actually `token = "" ` and `"" == null` is false in JS). Let me re-check: `Bearer `.split(" ") = ["Bearer", ""] → token = `""`. Then `token == null` → `"" == null` is **false** in JS. So token = `""` proceeds to `jwt.verify("", SECRET_KEY, ...)` which will error → 403, not 401. The case expects 401 but the actual response is **403**. | **Correction:** Expected status = **403** (not 401). Expected body = `{"error":"Forbidden"}`. The empty string passes the null check but fails JWT verification. Impl: `server.js:102-106`. |
| A1-S4-09 | **VALID** | Correct. XSS payload is stored as-is (no server-side sanitization), but the API uses parameterized queries so no injection. SEC-04 is a frontend concern (escape on display). The test correctly expects 200 — the API accepts the input. | — |
| A1-S4-10 | **VALID** | Correct. Parameterized query (`server.js:131`, `?` placeholders). SQL injection string is stored as a literal phone value, no DB error. This is a **passed** negative result — important to report. | — |
| A1-S4-11 | **INCOMPLETE** | Correct assertion (password must not be present), but the case doesn't assert the other sensitive fields. Should also check `reset_token`, `login_attempts`, `locked_until` are absent. The full absence assertion is in A1-S5-03, but this case focuses on SEC-01 specifically. Add note that this is `EXPECTED-FAIL` → BUG-04 since `SELECT *` at `server.js:113` returns everything including plaintext password. | **Correction:** Add `EXPECTED-FAIL` → BUG-04 tag. Implementation `SELECT * FROM users` exposes all columns. |

---

## S5 — Schema Validation

| ID | Label | Reasoning | Correction (if any) |
|---|---|---|---|
| A1-S5-01 | **VALID** | Correct. `server.js:133`: `res.json({ message: "Profile updated" })`. Response has exactly one key. Both oracles agree. | — |
| A1-S5-02 | **VALID** | Correct. `server.js:113`: `SELECT * FROM users` returns all columns. The assertion checks that the expected fields are present with correct types. However, note that `SELECT *` also returns unwanted fields — that's covered by A1-S5-03. | — |
| A1-S5-03 | **INCOMPLETE** | Right assertions, but needs `EXPECTED-FAIL` tag. `server.js:113` does `SELECT *` which returns ALL columns including `password`, `reset_token`, `login_attempts`, `locked_until`. The spec (SEC-01, FR-19) says password must not be exposed. | **Correction:** Tag: `EXPECTED-FAIL` → BUG-04. All four fields WILL be present in the response. |
| A1-S5-04 | **VALID** | Correct. Express `res.json()` sets `Content-Type: application/json; charset=utf-8` automatically. Both oracles agree. | — |

---

## Audit Summary

### Corrections Applied

| ID | Original Issue | Fix Applied |
|---|---|---|
| A1-S2-03–07 | Marked UNDETERMINED, missing EXPECTED-FAIL | Set status=400, tag EXPECTED-FAIL → BUG-09 |
| A1-S2-08 | Misidentified as "type error" | Retitled as format violation, tag EXPECTED-FAIL |
| A1-S2-09, 14, 18 | Marked UNDETERMINED for omitted fields | Resolved: expect 200 + verify preservation via GET, tag EXPECTED-FAIL → BUG-08 |
| A1-S2-13, 16, 17 | Marked UNDETERMINED when outcome is deterministic | Resolved: expect 200 (both oracles agree) |
| A1-S2-19 | Marked UNDETERMINED | Resolved: expect 200, verify NULL via GET, tag EXPECTED-FAIL → BUG-08 |
| A1-S3-05 | Not executable (requires external DB modification) | Reworked to use mass-assignment chain instead |
| A1-S4-01 | Ambiguous "400 or 200" | Committed to spec expectation + added GET verification step |
| A1-S4-08 | Wrong expected status (401 vs 403) | Fixed to 403 — empty string passes null check but fails jwt.verify |
| A1-S4-11 | Missing EXPECTED-FAIL tag | Added tag → BUG-04 |
| A1-S5-03 | Missing EXPECTED-FAIL tag | Added tag → BUG-04 |

### Bugs Surfaced by Audit

| Bug ID | Cases | Finding |
|---|---|---|
| BUG-01 | A1-S3-03, A1-S3-04, A1-S4-01 | `role` mass assignment accepted — self-promotion to admin |
| BUG-04 | A1-S4-11, A1-S5-03 | `GET /api/users/me` returns plaintext password + internal fields |
| BUG-08 | A1-S2-09, A1-S2-14, A1-S2-18, A1-S2-19, A1-S3-01 | Partial update silently NULLs omitted fields |
| BUG-09 | A1-S2-03–08 | No phone format validation (accepts anything) |

### AI Failure Patterns Observed

1. **UNDETERMINED overuse.** The AI marked 11 cases as UNDETERMINED when both oracles (spec + impl) determine the outcome. This is the most common failure — the model hedges instead of committing to a verifiable assertion.
2. **Type-vs-format confusion (A1-S2-08).** The AI treated a JSON number as a "type error" rather than recognizing it as a format violation (wrong prefix + digit count). The spec has no concept of JSON type validation.
3. **Ambiguous expected status (A1-S4-01).** "400 or 200" is not a testable assertion. The audit had to commit to one expected value based on the spec.
4. **Non-executable preconditions (A1-S3-05).** "DB role modified externally" cannot be achieved in Newman. The case needed reworking to use an executable mechanism.
5. **Missing verification steps.** Multiple cases (S4-01, S2-09/14/18) assert the PUT response but don't verify the actual data change via GET. A 200 response from PUT doesn't prove the data was (or wasn't) changed.
