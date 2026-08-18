# Stage S5: Schema Validation for API 3 (`PUT /api/admin/orders/:id/status`)

**Spec quoted:** API §6.2 gives no example response for the PUT (only the request body shape and the
enum). Every success/error shape below is therefore exploratory — asserting the *observed* SUT shape
is the finding, same convention API 1's and API 2's S5 stages used for their own unspecified shapes.

| ID | Title | Technique | Preconditions | Request | Expected Status | Expected Body Assertions | Spec Justification |
|---|---|---|---|---|---|---|---|
| A3-S5-01 | Success response shape | Schema (exploratory) | Order in `pending`, legal transition | `PUT /api/admin/orders/{{id}}/status` Body: `{"status":"confirmed"}` | 200 | JSON object; exact fields UNDETERMINED — spec gives no example | API §6.2 gives no response example |
| A3-S5-02 | Illegal-transition error shape | Schema (exploratory) | Order in `delivered` (final state) | Body: `{"status":"pending"}` | 400 | JSON object with an error/message field (exact key UNDETERMINED) | FR-10: "Mọi chuyển đổi không hợp lệ phải trả về lỗi với thông báo phù hợp" — an error is mandated, its shape is not |
| A3-S5-03 | Order-not-found error shape | Schema (exploratory) | None | `PUT /api/admin/orders/999999/status` Body: `{"status":"confirmed"}` | 404 | JSON object with an error/message field | Implicit — target resource must exist |
| A3-S5-04 | Forbidden error shape (non-admin token) | Schema (exploratory) | User token | `Auth: Bearer {{userToken}}` Body: `{"status":"confirmed"}` | 403 | JSON object with an error/message field | SEC-03 |
| A3-S5-05 | Response does not leak unrelated orders or other users' data | Negative Schema | Two orders exist, different owners | `PUT /api/admin/orders/{{id}}/status` on one order | 200 | Response body concerns only the targeted order/id — MUST NOT include an array or other users' rows | Implicit — a single-resource update's response should describe that resource, not the table |
| A3-S5-06 | `GET /api/admin/orders` response shape includes `shipping_address` unmodified | Schema | Order with a known `shipping_address` | `GET /api/admin/orders` `Auth: Bearer {{adminToken}}` | 200 | Array of orders; each element's `shipping_address` matches the stored value exactly (API-level fidelity, not HTML-escaped or stripped by the API itself) | FR-18 companion field; API-level responsibility ends at faithfully returning the stored string — escaping is a front-end concern per SEC-04 |
