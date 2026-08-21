# HW06 — AI-Assisted API Testing of the EShop SUT

**Student:** Luong Linh Khoi · **ID:** 23127396 · **Repo:**
[linhkhoi1309/eshop-sut-hw06-api](https://github.com/linhkhoi1309/eshop-sut-hw06-api)

This repository is the test harness, generated test cases, Postman/Newman collections, and audit
trail around a vendored, unmodified copy of the EShop backend (`sut/`). See `CLAUDE.md` for the
architecture and `PLAN.md` for the execution plan this submission followed step by step.

## Test Summary Report

| Metric | API 1 (`PUT /api/users/me`) | API 2 (`POST /api/apply-coupon`) | API 3 (`PUT /api/admin/orders/:id/status`) | **Total** |
|---|---:|---:|---:|---:|
| Number of APIs | 1 | 1 | 1 | **3** |
| Test cases generated (AI, incl. data-driven) | 48 | 58 | 75 | **181** |
| Test cases added (human extension) | 6 | 12 | 13 | **31** |
| Test cases executed (Newman) | 54 | 70 | 88 | **212** |
| Passed | 29 | 56 | 76 | **161** |
| Failed *(all `EXPECTED-FAIL`/tagged, quarantined — see below)* | 25 | 14 | 12 | **51** |

**Number of bugs:** **16 confirmed findings** filed as GitHub Issues
([#1–#16](https://github.com/linhkhoi1309/eshop-sut-hw06-api/issues)) — 10 numbered `BUG-01`
through `BUG-10` from the original hypothesis list (`PLAN.md` §5), plus **6 additional candidate
defects surfaced during the audit stage** that weren't in the original list (the `BUG-01`+`BUG-02`
escalation chain is filed as its own issue on top of the 10, so 11 of the 16 map to the original
severity table and 5 are audit-surfaced candidates not counted twice). Full detail in
`bug-report.md`.

Every one of the 51 "failed" Newman assertions above is a **deliberate** failure: a test case
asserting spec-correct behaviour against a confirmed SUT defect (tagged `[EXPECTED-FAIL: BUG-xx]` or
`[FINDING: ...]`), not an accident. `postman/known-defects.json` lists exactly which case IDs are
allowed to fail per collection; `scripts/run-newman.js` fails the CI build on any *other* failure.
See `docs/cicd-report.md` for the mechanism and real green/red GitHub Actions run evidence.

## Self-Assessment

Self-assessed total: **90 / 100** (this repo's own naming convention, `_090`, was fixed at project
start against this target).

| No. | Criteria | Grade | Self-Assessed Grade |
|---|---|---:|---:|
| 1 | API 1 — full pipeline (generate + audit + extend + execute + bugs) | 30 | 27 |
| 2 | API 2 — full pipeline (same criteria) | 30 | 27 |
| 3 | API 3 — full pipeline (same criteria) | 30 | 27 |
| 4 | Agent Skills (AI-driven test generator) | 10 | 9 |
| | **Total** | **100** | **90** |

**Why not full marks, per row:**

- **API 1–3 (27/30 each):** the full generate→audit→extend→execute pipeline is complete for all
  three, with genuine audit findings (not rubber-stamped `VALID` labels), data-driven Collection
  Runner sweeps, and every generated/extended case executed with evidence. Points held back for the
  same reason logged in `ai-audit-report.md`'s pattern-of-corrections section: the same
  actual-vs-spec assertion mistake recurred across collections before being caught each time, which
  is a process gap even though every instance was corrected before commit.
- **Agent Skills (9/10):** the pseudocode (`generator.py`) and design write-up
  (`docs/generator-design.md`) are complete and reflect the pipeline actually used three times over.
  The one point held back is `evidence/generator-diagram.png` — **not yet drawn**. Per Requirement
  §7/§11 it must be hand-drawn by the student, not AI-generated, so it's intentionally outstanding
  rather than produced by the AI assisting with everything else in this repo.

## Repository Layout

- `docs/api{1,2,3}-*/` — the six-stage generation (`s1`–`s5`, `generated.md`), audit (`audit.md`),
  and extension (`extended.md`) artefacts per API.
- `postman/collections/` — hand-built and data-driven-sweep Postman collections per API.
- `postman/data/` — CSV data files for the Collection Runner sweeps.
- `postman/known-defects.json` — the CI quarantine manifest (see `docs/cicd-report.md`).
- `reports/` — Newman HTML reports (JSON reports are regenerated per run, gitignored).
- `bug-report.md` + `evidence/bug-*.jpg` — all 16 confirmed findings, mirrored to GitHub Issues.
- `docs/generator-design.md`, `generator.py` — the AI test-generator design (§7).
- `docs/cicd-report.md` — pipeline configuration and the C1 (green) / C2 (red) / C3 (revert) evidence.
- `ai-audit-report.md`, `ai-critique.md` — the mandatory AI-use appendix (§9, §10).
- `submission/` — the packaged deliverables (Excel test-case summary, PDFs, this bundle's zip).
- `git-commit-log.txt` — full commit history in text form (§12).

## Reproduce Locally

```powershell
npm ci
npm run sut:install
npm run sut:start      # start -> wait -> seed
npm run test:smoke     # harness self-check
npm test                # all graded collections, quarantine-aware (see docs/cicd-report.md)
npm run sut:stop
```
