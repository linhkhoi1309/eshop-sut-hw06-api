/**
 * Runs every graded Postman collection, re-seeding between them.
 *
 * Re-seeding is not optional - the collections corrupt each other's starting state:
 *   - API1 (PUT /api/users/me) escalates the tester's `role` to admin (SEC-06) and
 *     NULLs their profile fields via the partial-update cases. Leaving `role=admin`
 *     behind would make API3's authorization cases pass for the wrong reason.
 *   - API3 (admin order status) mutates the order rows its own state-machine cases
 *     start from.
 * A single Newman invocation over all three would therefore be order-dependent and flaky.
 *
 * Usage:  node scripts/run-newman.js [--bail] [--only=API1]
 *
 * Quarantine (HW06 §6 / PLAN.md C1): most collections deliberately assert spec-correct
 * behaviour against a confirmed SUT defect, so Newman's own exit code is nonzero on
 * every normal run - that alone can't drive the CI gate. Instead: after each collection
 * runs, its JSON report is parsed for which case IDs actually failed, and compared
 * against postman/known-defects.json. A collection PASSES the gate iff every failing
 * case ID is listed there for that collection; any *unlisted* failure still fails the
 * build. This is the quarantine mechanism - it never edits or skips a test case (that
 * would delete the finding), it only decides whether an already-documented failure is
 * allowed to keep the build green.
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const collectionsDir = path.join(root, "postman", "collections");
const envFile = path.join(root, "postman", "environments", "local.postman_environment.json");
const reportsDir = path.join(root, "reports");

const args = process.argv.slice(2);
const only = (args.find((a) => a.startsWith("--only=")) || "").split("=")[1];
const bail = args.includes("--bail");

// Optional data file per collection, for the data-driven (Collection Runner) requirement.
// Keyed by the full collection name, not the API prefix: an API can have more than one
// collection (API2-ApplyCoupon plus the dedicated API2-CouponBoundaries sweep), and -d
// applies to the *whole* collection for every iteration - attaching it by prefix would
// silently replay API2-ApplyCoupon's logins, coupon-usage writes and admin mutations once
// per CSV row too, which is wrong for a collection that isn't built to be re-entrant.
const DATA_FILES = {
  "API1-PhoneBoundaries": path.join(root, "postman", "data", "phone-cases.csv"),
  "API2-CouponBoundaries": path.join(root, "postman", "data", "coupon-cases.csv"),
  "API3-OrderStatusMatrix": path.join(root, "postman", "data", "order-status-cases.csv"),
};

fs.mkdirSync(reportsDir, { recursive: true });

const knownDefectsPath = path.join(root, "postman", "known-defects.json");
const KNOWN_DEFECTS = fs.existsSync(knownDefectsPath) ? JSON.parse(fs.readFileSync(knownDefectsPath, "utf8")) : {};

// Pulls the leading case ID (e.g. "A2-S4-03" out of "A2-S4-03 status 400 (...)")
// off each failing assertion's name, so it can be matched against known-defects.json.
function extractFailedCaseIds(reportJsonPath) {
  if (!fs.existsSync(reportJsonPath)) return new Set();
  const report = JSON.parse(fs.readFileSync(reportJsonPath, "utf8"));
  const failed = new Set();
  for (const exec of report.run.executions || []) {
    for (const a of exec.assertions || []) {
      if (!a.error) continue;
      const m = /^([A-Za-z0-9]+-[A-Za-z0-9]+-[A-Za-z0-9]+)/.exec(a.assertion || "");
      failed.add(m ? m[1] : a.assertion);
    }
  }
  return failed;
}

const collections = fs
  .readdirSync(collectionsDir)
  .filter((f) => f.endsWith(".postman_collection.json"))
  .filter((f) => !f.startsWith("_")) // _harness-smoke is not graded
  .filter((f) => !only || f.startsWith(only))
  .sort();

if (collections.length === 0) {
  console.error("No graded collections found in postman/collections/.");
  console.error("Run `npm run test:smoke` to verify the harness while they are being built.");
  process.exit(1);
}

const seed = () =>
  execFileSync("node", [path.join(root, "scripts", "seed-api-data.js")], { stdio: "inherit" });

let failed = 0;
const summary = [];

for (const file of collections) {
  const name = file.replace(".postman_collection.json", "");
  const slug = name.toLowerCase();

  console.log(`\n${"=".repeat(70)}\n  ${name}\n${"=".repeat(70)}`);
  seed();

  const argv = [
    "run",
    path.join(collectionsDir, file),
    "-e",
    envFile,
    "-r",
    "cli,htmlextra,json",
    "--reporter-htmlextra-export",
    path.join(reportsDir, `${slug}.html`),
    "--reporter-htmlextra-title",
    `HW06 - ${name} - 23127396`,
    "--reporter-json-export",
    path.join(reportsDir, `${slug}.json`),
  ];

  const data = DATA_FILES[name];
  if (data && fs.existsSync(data)) argv.push("-d", data);

  let newmanFailed = false;
  try {
    // shell: true is required on Windows - execFileSync spawning a .cmd shim directly
    // throws EINVAL (a Node/Windows quirk, not a real failure) without it. Harmless on
    // Ubuntu CI, which spawns the "newman" binary directly rather than a .cmd shim.
    execFileSync(path.join(root, "node_modules", ".bin", process.platform === "win32" ? "newman.cmd" : "newman"), argv, {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
  } catch (_) {
    newmanFailed = true;
  }

  if (!newmanFailed) {
    summary.push({ name, result: "PASS", quarantined: [] });
    continue;
  }

  // Newman reported at least one failing assertion - check whether every one of them
  // is a documented, quarantined defect for this collection, or a real regression.
  const actualFailed = extractFailedCaseIds(path.join(reportsDir, `${slug}.json`));
  const known = new Set(Object.keys(KNOWN_DEFECTS[name] || {}));
  const unexpected = [...actualFailed].filter((id) => !known.has(id)).sort();
  const notReproduced = [...known].filter((id) => !actualFailed.has(id)).sort();

  if (notReproduced.length > 0) {
    console.log(`  NOTE: previously-known defect(s) did not reproduce for ${name}: ${notReproduced.join(", ")} - update postman/known-defects.json if this is now fixed.`);
  }

  if (unexpected.length === 0) {
    summary.push({ name, result: "PASS", quarantined: [...actualFailed].sort() });
  } else {
    failed += 1;
    summary.push({ name, result: "FAIL", unexpected });
    if (bail) break;
  }
}

console.log(`\n${"=".repeat(70)}\n  RUN SUMMARY\n${"=".repeat(70)}`);
for (const s of summary) {
  console.log(`  ${s.result.padEnd(5)} ${s.name}`);
  if (s.result === "PASS" && s.quarantined && s.quarantined.length > 0) {
    console.log(`        (${s.quarantined.length} known defect(s) quarantined: ${s.quarantined.join(", ")})`);
  }
  if (s.result === "FAIL" && s.unexpected) {
    console.log(`        UNEXPECTED failure(s), not in known-defects.json: ${s.unexpected.join(", ")}`);
  }
}
console.log(`\n  ${summary.length - failed}/${summary.length} collections passed.\n`);

process.exit(failed > 0 ? 1 : 0);
