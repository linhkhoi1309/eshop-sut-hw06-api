# AI Critique

**Student:** 23127396

The clearest AI failure across this project was not a single wrong fact but a recurring judgment
error: three separate times (API 2's collection, API 3's collection, and again while extending
API 3), I wrote Postman assertions against the SUT's *actual* buggy response instead of the
spec-correct one, for cases whose entire purpose was to demonstrate a defect. For example,
`A3-S4-04` initially asserted status 200 — what the broken handler returns — instead of 403, what
FR-12 requires. A case built that way passes silently and deletes the finding it was meant to
prove, which is precisely the failure mode this assignment's methodology is designed to prevent.

The AI failed to catch this reliably because the underlying heuristic — "assert what the request
demonstrates" — is correct for *most* of the suite (passed negative results, schema shapes) and
only wrong for the specific subset of cases proving a bug, where "demonstrates" and "should happen"
diverge. There was no single check separating the two classes; each collection re-derived the
distinction from scratch, so getting it right once did not transfer to the next collection.

The operational principle I am taking from this: whenever a generated test case exists specifically
to prove a defect, force a literal side-by-side of expected-per-spec vs. observed-actual *before*
writing the assertion, and grep every finished collection for cases where those two values match —
a match on a defect-tagged case is itself the bug. That check is mechanical, transfers across
collections, and would have caught all three recurrences on the first pass rather than three
separate times after the fact.
