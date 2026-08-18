---
name: newman-execution-evidence
description: >-
  Execute Postman collections with Newman against a locally-run SUT and capture the execution evidence
  a grader can verify - HTML reports, the X-Student-Id console proof, deterministic fixtures, and a
  CI/CD run in GitHub Actions with a deliberate failing-commit pair. Use when someone says "run the
  Postman collection", "produce the Newman report", "set up the CI pipeline for these API tests", or
  needs reproducible evidence that an API test suite really ran.
---

# Newman execution and evidence capture

Produces: `reports/*.html`, `reports/*.json`, `evidence/*.png`, and two GitHub Actions runs
(one green, one red).

## The rule that makes this work

**Reseed before every collection, never between assertions.** Two properties of this SUT make an
unseeded run non-reproducible:

- `sut/backend/database.js` DROPs and re-seeds every table at *module load*, i.e. when the server
  starts. Seeding before the server is listening is silently discarded.
- `server.js:54` adds **2** to `login_attempts` per failed login and locks at `>= 3` for 180 s
  (`:56-57`). The account is therefore locked after the **second** wrong password. Any negative-path
  login case poisons every later case that needs to authenticate.

So: **start → wait for ready → seed → run one collection → reseed → run the next.**
`scripts/run-newman.js` enforces this; do not invoke `newman run` across all collections in one go.

Order fixtures are mutated by the state-transition cases, which is the other half of the same
problem — a second run against un-reseeded orders tests transitions from the wrong starting state
and passes for the wrong reason.

## Run sequence

```
powershell -ExecutionPolicy Bypass -File scripts/start-sut.ps1   # start + wait + seed
npm run test:smoke                                               # harness self-check
node scripts/run-newman.js                                       # graded collections, reseeded between
powershell -ExecutionPolicy Bypass -File scripts/stop-sut.ps1
```

A failing `test:smoke` means the environment is wrong, not that the tests are wrong. Fix it before
reading any graded result.

## Evidence that must be real

Three artefacts are checked for authenticity and cannot be reconstructed afterwards. Capture them
during the run, not after.

| Evidence | How | Trap |
|---|---|---|
| `X-Student-Id` header | Postman console (Ctrl+Alt+C) screenshot showing the pre-request `console.log` **and** the request's outgoing headers panel | A screenshot of the script source proves nothing was sent. Show the *sent* header. |
| Newman run output | Terminal screenshot with the hostname visible — `localhost` / `127.0.0.1` is accepted | Crop that hides the URL makes the run unattributable. |
| Report timestamps | The htmlextra report header | Regenerating the report later changes them; capture screenshots and report in one session. |

Assert the header inside the suite as well as logging it — a collection-level `pm.test` comparing
`pm.request.headers.get('X-Student-Id')` to the environment value turns the requirement into a
result in the report rather than a claim in the prose.

## The CI/CD failing-commit pair

The requirement is two runs on two commits: all-passing, then exactly one failing case.

1. **Green commit.** Every case that targets a real defect is tagged `EXPECTED-FAIL` and asserted
   against the *spec* behaviour, so it fails legitimately. Move those into a `Known defects` folder
   that the CI run excludes with `--folder`, and say so in the CI report — a pipeline that is green
   because the failing assertions were deleted is dishonest; one that is green because known-defect
   cases are quarantined and documented is normal practice.
2. **Red commit.** Introduce the failure in the **test**, not in the SUT — flip one expected status
   code in one case, in its own commit, with a message that says it is deliberate. Patching the SUT
   to break it changes the system under test and invalidates every other result in the run.
3. Record both run URLs, both commit SHAs, and a screenshot of each Actions run.

## Report notes

- Use `newman-reporter-htmlextra`; the default HTML reporter omits the request/response bodies that
  make a failure diagnosable.
- Keep `-r cli,htmlextra,json`. The JSON is what the CI job summary parses for the per-collection
  assertion counts.
- Commit `reports/*.html`, gitignore `reports/*.json` — the HTML is the deliverable, the JSON is
  regenerated build output.
