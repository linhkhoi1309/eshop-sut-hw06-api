"""
AI-driven API test generator - pseudocode (HW06 Requirement §7, Create/G9.5).

Formalizes the six-stage pipeline actually run by hand for API 1, 2, and 3 in this
repo (see docs/generator-design.md and skills/api-testcase-generator). The
call_llm(...) calls below are stubs: in this submission each stage was run as an
interactive, human-reviewed prompt, not an unattended batch job. This file makes
the algorithm concrete for the §7 "pseudocode" deliverable - it is not a
deployable tool, and is not what evidence/generator-diagram.png depicts (that
diagram is hand-drawn, per §11; this pseudocode was AI-assisted, and that is
declared in the AI Audit Report).
"""

from dataclasses import dataclass, field
from enum import Enum


# ---------------------------------------------------------------------------
# Input: a minimal model of "the API specification" the generator consumes.
# In practice this is spec text pasted verbatim into each stage's prompt, not
# a parsed schema - the invariant rule "quote the spec back" depends on the
# LLM seeing the student's own spec wording, not a normalized IR of it.
# ---------------------------------------------------------------------------

@dataclass
class EndpointSpec:
    api_id: str                      # e.g. "A2"
    method: str                      # "POST"
    path: str                        # "/api/apply-coupon"
    fr_text: str                     # verbatim FR-xx section(s) this endpoint implements
    sec_text: str                    # verbatim SEC-xx sections that apply
    state_diagram_text: str | None   # verbatim FR-10-style diagram, if this endpoint has one
    response_examples_text: str      # verbatim example request/response bodies from the API doc


@dataclass
class TestCase:
    case_id: str                     # "<api_id>-<stage>-<nn>"
    stage: str                       # "S2" | "S3" | "S4" | "S5"
    title: str
    technique: str                   # "EP" | "BVA" | "State Transition" | "Vertical Escalation" | ...
    preconditions: str
    request: dict                    # {method, url, headers, body}
    expected_status: int | None      # None means UNDETERMINED
    expected_body: str               # assertion description, or "UNDETERMINED"
    spec_justification: str          # the exact spec line/phrase that determines the expectation
    undetermined_reason: str | None = None   # required if expected_status is None


class AuditLabel(Enum):
    VALID = "VALID"
    INVALID = "INVALID"
    INCOMPLETE = "INCOMPLETE"


@dataclass
class AuditedCase:
    case: TestCase
    label: AuditLabel
    reasoning: str                   # cites both oracles: spec line + impl line number
    correction: TestCase | None      # present if label != VALID
    expected_fail_bug_id: str | None # set if spec and impl disagree - never silently "fixed"


@dataclass
class ExtendedCase:
    case: TestCase
    gap_category: str                # one of E1..E5, see docs/*/extended.md
    why_ai_missed_it: str            # mechanism, not just "the AI didn't think of it"


# ---------------------------------------------------------------------------
# Stage prompts. Every one of these carries the same two invariant rules -
# encoded here as a shared string appended to each stage's prompt, not
# re-derived per stage, so the rule can't silently drift between stages.
# ---------------------------------------------------------------------------

INVARIANT_RULES = """
Two rules for every case you produce:
(1) If the spec does not determine the expected result, output UNDETERMINED and
    say what information is missing. Do not guess.
(2) Do not infer behaviour from how such APIs "usually" work. Assert only what
    the quoted spec text states.
"""


def call_llm(prompt: str) -> list[TestCase]:
    """Stub. In this submission, each call was one interactive, human-reviewed
    prompt turn - not an automated API call. Signature kept so the pipeline
    below reads as a real control-flow graph, matching the diagram."""
    raise NotImplementedError


def stage_s1_parameter_inventory(spec: EndpointSpec) -> str:
    """Not test cases yet - a parameter table (source, type, required/optional,
    spec constraints), quoting the spec text verbatim. Feeds every later stage."""
    prompt = f"""
    Endpoint: {spec.method} {spec.path}
    Spec (verbatim): {spec.fr_text}\n{spec.sec_text}

    Stage 1 only: list every input this endpoint reads - body fields, path
    params, query params, headers, and implicit inputs (JWT claims, DB state).
    For each: source, type, required/optional, and the exact spec constraint
    (or "not stated").
    {INVARIANT_RULES}
    """
    return prompt  # -> parameter table, not TestCase objects


def stage_s2_domain_partitions(spec: EndpointSpec, param_table: str) -> list[TestCase]:
    """One row per equivalence class / boundary value, not one row per parameter.
    Coverage floor: every parameter has >=1 valid class, >=1 invalid class, and
    every numeric/length constraint has both sides of its boundary plus the
    boundary itself."""
    prompt = f"""
    Endpoint: {spec.method} {spec.path}
    Parameters: {param_table}
    Spec (verbatim): {spec.fr_text}

    Stage 2 only: domain partitions (equivalence partitioning + boundary value
    analysis). One row per class.
    {INVARIANT_RULES}
    """
    return call_llm(prompt)


def stage_s3_state_transitions(spec: EndpointSpec) -> list[TestCase]:
    """Full N x N transition matrix if the endpoint participates in a state
    machine (skipped if spec.state_diagram_text is None). Must include illegal
    transitions and transitions out of final states - the complement of the
    drawn diagram, not just the drawn arrows."""
    if spec.state_diagram_text is None:
        return []
    prompt = f"""
    Endpoint: {spec.method} {spec.path}
    State diagram (verbatim): {spec.state_diagram_text}

    Stage 3 only: the full transition matrix - every (from-state, to-state)
    pair, including the illegal ones and the ones out of final states. An
    N-state machine has N*N rows; produce all of them.
    {INVARIANT_RULES}
    """
    return call_llm(prompt)


def stage_s4_security(spec: EndpointSpec) -> list[TestCase]:
    """One case per numbered SEC-xx requirement, per role. Authentication
    (token present/absent/malformed) and authorization (token's role claim)
    are always separate cases, never folded into one "requires a token" case."""
    prompt = f"""
    Endpoint: {spec.method} {spec.path}
    Security spec (verbatim): {spec.sec_text}

    Stage 4 only: one case per SEC-xx requirement, per role (no token,
    malformed token, wrong-role token, cross-user token). Injection payloads
    on every string field. Mass-assignment probes on any field not in the
    documented request body.
    {INVARIANT_RULES}
    """
    return call_llm(prompt)


def stage_s5_schema_validation(spec: EndpointSpec) -> list[TestCase]:
    """Success and error response shapes: field names, types, nullability, and
    - critically - fields that must be ABSENT. Models rarely generate absence
    assertions unless explicitly asked."""
    prompt = f"""
    Endpoint: {spec.method} {spec.path}
    Response examples (verbatim): {spec.response_examples_text}

    Stage 5 only: exact success/error response shape assertions, including at
    least one case asserting a field that must NOT be present.
    {INVARIANT_RULES}
    """
    return call_llm(prompt)


def stage_s6_consolidate(all_cases: list[TestCase]) -> list[TestCase]:
    """Merge duplicate requests across stages (kept as a de-duplication log,
    never silently dropped), assign final sequential IDs, and flag priority.
    This step is mechanical/scripted, not an LLM call - the fusion is a
    programmatic diff over already-generated cases, not new generation."""
    seen_requests: dict[tuple, TestCase] = {}
    deduplicated: list[TestCase] = []
    dedup_log: list[tuple[str, str, str]] = []  # (removed_id, kept_id, reason)

    for case in all_cases:
        key = (case.request["method"], case.request["url"], frozenset(case.request.get("body", {}).items()))
        if key in seen_requests:
            kept = seen_requests[key]
            dedup_log.append((case.case_id, kept.case_id, "identical request, same assertion scope"))
            continue
        seen_requests[key] = case
        deduplicated.append(case)

    return deduplicated  # + dedup_log, written into generated.md's S6 section


def generate_cases_for_endpoint(spec: EndpointSpec) -> list[TestCase]:
    """The orchestration loop the diagram's top row depicts. Each stage's
    output is exposed to the next stage's prompt where relevant (S1's
    parameter table feeds S2); stages do not run in parallel or get merged
    into one prompt."""
    param_table = stage_s1_parameter_inventory(spec)
    cases: list[TestCase] = []
    cases += stage_s2_domain_partitions(spec, param_table)
    cases += stage_s3_state_transitions(spec)
    cases += stage_s4_security(spec)
    cases += stage_s5_schema_validation(spec)
    return stage_s6_consolidate(cases)


# ---------------------------------------------------------------------------
# Below the human boundary. Not automatable by design: the audit step's whole
# point is a human (or a human-supervised second pass) checking generated
# output against source code the generator was never shown, and the
# extension step's whole point is cases the generator is structurally
# incapable of producing (see docs/*/extended.md's gap-category table, E1-E5).
# ---------------------------------------------------------------------------

def audit_case(case: TestCase, spec_text: str, impl_source_line: str) -> AuditedCase:
    """Human judgment against two oracles. Pseudocode signature only - the
    actual audit in this submission was a human reading server.js line by
    line, not a function call."""
    raise NotImplementedError("audit is a human step, not a generator step")


def extend_with_human_cases(audited: list[AuditedCase]) -> list[ExtendedCase]:
    """>=5 cases added by a human, each with a named gap-category mechanism
    (E1 vertical escalation on a sibling route, E2 transitions out of a final
    state, E3 mass assignment / JS-truthiness edge, E4 IDOR needing a second
    identity, E5 exact-threshold boundary a model treats as context not
    input). Never re-run the generator to "fill gaps" - regenerated cases are
    generated cases, not human-added ones."""
    raise NotImplementedError("extension is a human step, not a generator step")


# ---------------------------------------------------------------------------
# Emission: consolidated + audited + extended cases become a runnable
# Postman collection. Scripted, not an LLM call.
# ---------------------------------------------------------------------------

def emit_postman_collection(
    api_id: str,
    audited_cases: list[AuditedCase],
    extended_cases: list[ExtendedCase],
) -> dict:
    """One folder per stage; one pm.test per assertion, named with the case
    ID; collection-level pre-request script sets X-Student-Id; any case whose
    audited correction disagrees with the SUT (expected_fail_bug_id is set)
    asserts the SPEC value and is tagged [EXPECTED-FAIL: BUG-xx] in its
    item name - never rewritten to match the bug."""
    folders: dict[str, list[dict]] = {}

    for audited in audited_cases:
        final = audited.correction or audited.case
        item = {
            "name": f"{final.case_id}: {final.title}"
            + (f" [EXPECTED-FAIL: {audited.expected_fail_bug_id}]" if audited.expected_fail_bug_id else ""),
            "request": final.request,
            "tests": [f"pm.test('{final.case_id} status', () => pm.response.to.have.status({final.expected_status}))"],
        }
        folders.setdefault(final.stage, []).append(item)

    for ext in extended_cases:
        item = {"name": f"{ext.case.case_id}: {ext.case.title}", "request": ext.case.request}
        folders.setdefault("EX Human Extensions", []).append(item)

    return {
        "info": {"name": f"{api_id}-Collection"},
        "event": [{"listen": "prerequest", "script": "pm.request.headers.upsert({key:'X-Student-Id', value: pm.environment.get('studentId')})"}],
        "item": [{"name": stage, "item": items} for stage, items in folders.items()],
    }


# ---------------------------------------------------------------------------
# CI feedback loop: a confirmed EXPECTED-FAIL case's bug ID is what populates
# postman/known-defects.json, which is what lets scripts/run-newman.js keep
# the build green without ever weakening an assertion. This is the arrow that
# closes the loop back into the diagram's CI Gate box.
# ---------------------------------------------------------------------------

def update_known_defects_manifest(collection_name: str, audited_cases: list[AuditedCase]) -> dict[str, str]:
    return {
        audited.correction.case_id if audited.correction else audited.case.case_id: audited.expected_fail_bug_id
        for audited in audited_cases
        if audited.expected_fail_bug_id
    }
