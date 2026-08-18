/**
 * Runs every graded Postman collection, re-seeding between them.
 *
 * Re-seeding is not optional:
 *   - API1 (login) deliberately sends wrong passwords, and server.js:54 adds *2* per
 *     failure with a lock at >= 3, so the tester account is locked out afterwards.
 *   - API3 (admin order status) mutates the order rows the state-machine cases start from.
 * A single Newman invocation over all three would therefore be order-dependent and flaky.
 *
 * Usage:  node scripts/run-newman.js [--bail] [--only=API1]
 * Exit code is non-zero if any collection had a failure - this is what makes the
 * GitHub Actions job red for the "one failing test case" sample commit.
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

// Optional data file per API, for the data-driven (Collection Runner) requirement.
// Keyed by the API prefix rather than the full filename so renaming a collection
// does not silently drop its data file and turn 12 iterations into 1.
const DATA_FILES = {
  API1: path.join(root, "postman", "data", "phone-cases.csv"),
  API2: path.join(root, "postman", "data", "coupon-cases.csv"),
};

fs.mkdirSync(reportsDir, { recursive: true });

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

  const data = DATA_FILES[name.split("-")[0]];
  if (data && fs.existsSync(data)) argv.push("-d", data);

  try {
    execFileSync(path.join(root, "node_modules", ".bin", process.platform === "win32" ? "newman.cmd" : "newman"), argv, {
      stdio: "inherit",
    });
    summary.push({ name, result: "PASS" });
  } catch (_) {
    failed += 1;
    summary.push({ name, result: "FAIL" });
    if (bail) break;
  }
}

console.log(`\n${"=".repeat(70)}\n  RUN SUMMARY\n${"=".repeat(70)}`);
for (const s of summary) console.log(`  ${s.result.padEnd(5)} ${s.name}`);
console.log(`\n  ${summary.length - failed}/${summary.length} collections passed.\n`);

process.exit(failed > 0 ? 1 : 0);
