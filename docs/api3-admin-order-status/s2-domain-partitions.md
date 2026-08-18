# Stage S2: Domain Partitions for API 3 (`PUT /api/admin/orders/:id/status`)

**Spec quoted:** API §6.2 enum list; FR-10's 5 states. Cases here isolate the *format/type* validity
of `status` and `:id` independent of the current-state transition legality — that dimension belongs
to S3. Each `status` value below is paired with a starting state where the transition itself is
spec-legal, so a rejection can only be attributed to the value's format, not to the state machine.

| ID | Title | Technique | Preconditions | Request | Expected Status | Expected Body | Spec Justification |
|---|---|---|---|---|---|---|---|
| A3-S2-01 | status="confirmed" (valid enum member, legal transition) | EP | Order in `pending` | `PUT /api/admin/orders/{{id}}/status` `Auth: Bearer {{adminToken}}` Body: `{"status":"confirmed"}` | 200 | UNDETERMINED — spec gives no example success body | API §6.2 enum list; FR-10 diagram |
| A3-S2-02 | status="shipping" (valid enum member, legal transition) | EP | Order in `confirmed` | Body: `{"status":"shipping"}` | 200 | UNDETERMINED | API §6.2; FR-10 |
| A3-S2-03 | status="delivered" (valid enum member, legal transition) | EP | Order in `shipping` | Body: `{"status":"delivered"}` | 200 | UNDETERMINED | API §6.2; FR-10 |
| A3-S2-04 | status="canceled" (valid enum member, legal transition) | EP | Order in `pending` | Body: `{"status":"canceled"}` | 200 | UNDETERMINED | API §6.2; FR-10 cancel arrow |
| A3-S2-05 | status="pending" (valid enum member, but no incoming arrow to it from any other state) | EP | Order in `confirmed` | Body: `{"status":"pending"}` | UNDETERMINED — value is a valid enum member, but FR-10's diagram has no backward arrow | UNDETERMINED | This case sits between S2 (format) and S3 (transition legality) — noted here, fully resolved in S3's matrix |
| A3-S2-06 | status="UNKNOWN" (not a member of the enum) | EP | Order in `pending` | Body: `{"status":"UNKNOWN"}` | 400 | UNDETERMINED — spec gives no error text | API §6.2: enum is closed to the 5 listed values |
| A3-S2-07 | status="" (empty string) | EP | Order in `pending` | Body: `{"status":""}` | 400 | UNDETERMINED | Empty string is not one of the 5 enum values |
| A3-S2-08 | status="Pending" (wrong case) | EP | Order in `pending` | Body: `{"status":"Pending"}` | UNDETERMINED | UNDETERMINED | Spec doesn't state case-sensitivity for the enum |
| A3-S2-09 | status wrong type (number) | EP | Order in `pending` | Body: `{"status":1}` | UNDETERMINED | UNDETERMINED | Spec shows `status` as a JSON string; no type-validation rule stated |
| A3-S2-10 | status omitted | EP | Order in `pending` | Body: `{}` | UNDETERMINED | UNDETERMINED | §6.2 body always shows `status` present |
| A3-S2-11 | :id references a non-existent order | EP | None (use an id known not to exist, e.g. `999999`) | `PUT /api/admin/orders/999999/status` Body: `{"status":"confirmed"}` | 404 | UNDETERMINED | Target resource must exist to be updated |
| A3-S2-12 | :id non-numeric | EP | None | `PUT /api/admin/orders/abc/status` Body: `{"status":"confirmed"}` | UNDETERMINED | UNDETERMINED | Spec gives no format rule for the id segment beyond it identifying an order |
| A3-S2-13 | :id negative | EP | None | `PUT /api/admin/orders/-1/status` Body: `{"status":"confirmed"}` | UNDETERMINED | UNDETERMINED | Order ids are auto-increment positive integers; a negative id cannot exist |
| A3-S2-14 | :id zero | BVA | None | `PUT /api/admin/orders/0/status` Body: `{"status":"confirmed"}` | UNDETERMINED | UNDETERMINED | Auto-increment ids start at 1; 0 is the boundary below the valid range |

---

**Coverage floor check:** `status` — every one of the 5 enum members appears in at least one
spec-legal-transition case (A3-S2-01–04 plus the pending→canceled reuse), plus not-a-member, empty,
wrong-case, wrong-type, and omitted classes. `:id` — not-found, non-numeric, negative, and the
zero boundary.
