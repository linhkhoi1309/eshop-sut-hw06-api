---
name: api-testcase-audit
description: >-
  Audit AI-generated API test cases against the specification and the implementation - labelling each
  VALID / INVALID / INCOMPLETE with a reason, correcting the bad ones, and then extending the set with
  the cases the AI structurally could not produce. Use when someone says "review these generated test
  cases", "which of these test cases are wrong", "audit the AI output", or has an assignment requiring
  a human review of AI-generated tests. The correction and the gap analysis are the graded artefacts,
  not the label.
---

# API test-case audit and extension

Produces: `docs/<api>/audit.md` (labelled table + corrections) and `docs/<api>/extended.md`
(the human-added cases with a stated reason each one was missed).

## The rule that makes this work

**Audit against the code, not against plausibility.** A test case that "looks right" is exactly what
an LLM produces; deciding whether it *is* right requires the oracle. For a specification-defect SUT
there are two oracles and they disagree, so every case must be judged against both:

- **Spec oracle** — what `README.md` (FR-xx) and `api_specification.md` say must happen.
- **Implementation oracle** — what the code at `sut/backend/server.js:<line>` actually does.

Where they agree, the expected result is settled. **Where they disagree, that is a bug**, and the
test case must assert the *spec* behaviour and be tagged `EXPECTED-FAIL` with a bug ID. A case
rewritten to match the buggy implementation is the single most damaging mistake in this workflow:
it turns the suite green and deletes the finding.

## Labels

| Label | Means | Required follow-up |
|---|---|---|
| **VALID** | Correct expectation, correct preconditions, actually executable, and derivable from a stated requirement. | Cite the spec line. |
| **INVALID** | Wrong expected result, an impossible precondition, a duplicate, or a case testing something the endpoint does not do. | Rewrite it, and record the original next to the correction. |
| **INCOMPLETE** | Right idea, insufficient assertions — usually status-code-only, or missing the boundary, or missing the absence check. | Strengthen it; say which assertion was added. |

Never delete an INVALID case. The before/after pair is the evidence of review; a clean final table
with no history is indistinguishable from unreviewed AI output.

## Audit procedure, per case

1. **Locate the handler.** `grep -n "<route>" sut/backend/server.js`, then read the whole handler.
2. **Read the guard order.** Which check fires first decides the status code. Most INVALID labels
   come from a case that assumes validation happens before the DB lookup when it happens after.
3. **Check the arithmetic and the comparisons.** `>` vs `>=`, `+1` vs `+2`, and any formula.
   Compare each against the formula in the spec, character by character.
4. **Check what the response contains** that it should not — a full user row, an internal error
   message, a stack trace.
5. **Label, and cite both oracles**: `spec README.md:<line>` and `impl server.js:<line>`.

## Extension: the five categories the AI structurally misses

The extension step is not "add more cases". It is "add the cases whose *absence has a cause*", and
the cause is what gets written down. In this SUT, look here first:

| # | Category | Why the AI misses it |
|---|---|---|
| E1 | **Vertical privilege escalation on admin routes** | The route is named `/api/admin/...` and takes a token, so the model treats "token present" as sufficient. Nothing in the spec text distinguishes the token's `role` claim, so a spec-only prompt cannot derive the case. |
| E2 | **Transitions out of final states** | The state diagram is drawn forward. A model reading a diagram generates the arrows it sees; it does not generate the arrows that must *not* exist unless asked for the complement. |
| E3 | **Mass assignment / privileged-field injection** | Requires reasoning about fields the client sends that the spec's request example does not list. The example is the prompt's anchor, so unlisted fields are invisible. |
| E4 | **Cross-user data access (IDOR)** | Needs a second seeded identity. A single-actor prompt has no second user to reason about, so the case is unreachable rather than overlooked. |
| E5 | **Exact-threshold boundaries on business rules** | Models generate "below" and "above" reliably and "exactly at" rarely, because the interesting value is the one the spec states as the constraint and the model treats it as context, not as an input. |

For each added case, `docs/<api>/extended.md` records: the case, the defect it targets, and one
sentence naming the cause from the table above — prompt scope, spec silence, model tendency, or
missing fixture. "The AI missed it" without a mechanism is not an answer.

## Do not

- Do not re-run the generator to "fill gaps". Regenerated cases are generated cases; they belong to
  the generate step and cannot count as the human extension.
- Do not adjust an expected result to make a run green. Tag `EXPECTED-FAIL` and file the bug.
- Do not label in bulk. A table where every row says VALID means the audit did not happen.
