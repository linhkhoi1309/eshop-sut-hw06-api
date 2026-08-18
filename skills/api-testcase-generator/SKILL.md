---
name: api-testcase-generator
description: >-
  Generate API test cases from an API specification by driving the technique one stage at a time -
  parameter inventory, domain partitions, boundaries, state transitions, security (auth/authz/injection),
  and response-schema validation - instead of asking for "all the test cases" in one prompt. Use when
  someone says "generate API test cases from this spec", "I need test cases for POST /api/login",
  "build me a Postman collection from the API doc", or is working through an API-testing assignment.
  Emits a numbered test-case table plus a Postman v2.1 collection.
---

# API test-case generator (stage-driven)

Produces, per endpoint: `docs/<api>/generated.md` (the test-case table) and
`postman/collections/<API>.postman_collection.json`.

## The rule that makes this work

**One stage per prompt, and the spec is quoted back each time.** A single "generate all test cases
for this API" prompt returns 20–30 plausible cases that cluster on the happy path and on missing
required fields, because that is what the training distribution is dense in. It will not
systematically walk a state machine, and it will not test authorization separately from
authentication. Six narrow prompts, each with its own oracle, produce cases that are *derivable* —
which is also what makes the audit step possible, since an undirected case has no stated basis to
audit against.

## The six stages

Run them in order. Each stage's output is input to the next; do not merge stages.

| # | Stage | Prompt asks for | Oracle |
|---|---|---|---|
| S1 | **Parameter inventory** | Every input the endpoint reads: body fields, path params, query params, headers, and *implicit* inputs (JWT claims, DB state). Types, required/optional, stated constraints. | The spec text, verbatim |
| S2 | **Domain partitions** | For each parameter from S1: valid classes, invalid classes, and the boundary values between them. One row per class, not one row per parameter. | Equivalence partitioning + BVA |
| S3 | **State transitions** | The state model the endpoint participates in; then the full transition table including the **illegal** transitions and the transitions out of final states. | The state diagram in the spec (FR-10 for EShop) |
| S4 | **Security** | One case per numbered security requirement, per role: no token, malformed token, expired token, another user's token (IDOR), a non-admin token on an admin route (vertical escalation), injection payloads on every string field, and mass-assignment of privileged fields. | SEC-01…SEC-07 |
| S5 | **Schema validation** | The exact success and error response shapes: field names, types, nullability, and fields that must **not** be present. | The response examples in the spec |
| S6 | **Consolidation** | Merge, de-duplicate, assign IDs, mark priority, and flag any case whose expected result the spec does not determine. | — |

## Stage prompt template

Reuse this shape for every stage. The two constraints in the last paragraph are what keep the
output auditable.

```
Here is the specification for <ENDPOINT>:
<paste the spec section verbatim, plus the FR and SEC sections it references>

Stage <n> only: <the "asks for" cell from the table above>.
Do not produce cases for any other stage yet.

For each case output: ID | title | technique | preconditions | request (method, URL, headers, body)
| expected status | expected body assertions | the spec line that justifies the expectation.

Two rules: (1) if the spec does not determine the expected result, write UNDETERMINED and say what
is missing - do not guess; (2) do not infer behaviour from how such APIs "usually" work.
```

Rule (2) matters more than it looks. Without it the model reports the *conventional* behaviour of a
login or coupon endpoint, which is exactly the behaviour a deliberately-defective SUT does not have —
and the resulting cases pass against a broken implementation.

## Numbering

`<API-id>-<stage>-<nn>`, e.g. `A1-S2-07` = API 1, domain partitions, case 7. The stage stays in the
ID through the audit and the Postman collection, so a reviewer can see at a glance whether a stage
was thin — six S2 cases and thirty S4 cases means S2 was under-driven.

## Coverage floor before moving on

Do not accept a stage until:

- **S2** — every parameter from S1 appears in at least one valid and one invalid class, and every
  numeric or length constraint has both sides of its boundary plus the boundary itself.
- **S3** — the transition table has a row for every (state × target state) pair, including the ones
  that must be rejected. An N-state machine has N×N rows; anything less is a gap, not a shortcut.
- **S4** — every SEC-xx requirement maps to at least one case, and every string field has an
  injection case. Authorization is tested *separately* from authentication.
- **S5** — at least one case asserts a field that must be **absent** (e.g. a password never appearing
  in a response). Models rarely generate absence assertions unprompted.

## Emitting the Postman collection

Only after S6. Structure:

- **Collection-level pre-request script** sets `X-Student-Id` via `pm.request.headers.upsert` and
  `console.log`s it. Collection level, not request level — a per-request script is one copy-paste
  away from being forgotten.
- **Folders per stage** (`S2 Domain partitions`, `S3 State transitions`, …) so the Newman report
  reads as the technique, not as a flat list.
- **One `pm.test` per assertion**, named with the case ID. Newman counts assertions, so a case
  bundled into one `pm.test` under-reports coverage.
- **Fixture-dependent cases read IDs from the environment**, never hard-coded literals, so a re-seed
  cannot silently point a case at the wrong row.

## Known failure modes of the AI at this task

Watch for these in every run — they are the material for the audit and the critique:

1. **Convention over specification.** Asserts `400` where the SUT returns `500`, or assumes a
   locked-out account after 3 failures when the code increments by 2 and locks at 3.
2. **Authorization folded into authentication.** "Requires a token" is generated; "requires an
   *admin* token" is not, unless S4 forces the split per role.
3. **Final states are not tested.** State-transition cases walk the happy path forward; transitions
   *out of* `delivered` / `canceled` get skipped, which is precisely where planted defects live.
4. **Absence assertions are missing.** A response schema is checked for the fields that should be
   there, never for the fields that should not.
5. **Boundary drift on money.** Coupon and price boundaries get "just below / just above" cases but
   not the exact threshold, which is where a `>` vs `>=` defect hides.
