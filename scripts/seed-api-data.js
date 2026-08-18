/**
 * Deterministic fixtures for the HW06 API test suite.
 *
 * MUST run AFTER the backend is listening: sut/backend/server.js requires ./database,
 * and database.js calls initDatabase() at module load, which DROPs and re-seeds every
 * table. Seeding first would be silently wiped.
 *
 * Everything below is additive to the SUT's own seed (2 users, 5 products, 4 coupons)
 * and is written with fixed IDs so the Postman collections can hard-code them.
 */
const path = require("path");
const sqlite3 = require(path.resolve(__dirname, "../sut/backend/node_modules/sqlite3"));

const dbPath = path.resolve(__dirname, "../sut/backend/database.sqlite");
const db = new sqlite3.Database(dbPath);

const run = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.run(sql, params, function (err) {
      err ? reject(err) : resolve(this);
    }),
  );
const get = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row))),
  );

// Order rows the state-machine tests consume. One per starting state, per owner.
// The FR-10 tests mutate these, so `npm run seed` is re-run before every Newman run.
const ORDER_FIXTURES = [
  ["pending", 500000],
  ["confirmed", 500000],
  ["shipping", 500000],
  ["delivered", 500000],
  ["canceled", 500000],
];

async function main() {
  // --- users -------------------------------------------------------------
  // victim@eshop.com exists purely as the IDOR / horizontal-privilege target.
  // `role` and the profile fields are reset explicitly, not just the credentials:
  // API 1 is PUT /api/users/me, whose cases escalate `role` to admin (SEC-06) and
  // NULL out shipping_address / phone via a partial update. Leaving either behind
  // would make the next collection's authorization results meaningless.
  const users = [
    ["Test User", "test@eshop.com", "Test1234!", "user", "123 Le Loi, Q1, TP.HCM", "0912345678"],
    ["Victim User", "victim@eshop.com", "Victim123!", "user", "456 Hai Ba Trung, Q3, TP.HCM", "0987654321"],
    ["Admin User", "admin@eshop.com", "Admin123!", "admin", "789 Nguyen Hue, Q1, TP.HCM", "0901112223"],
  ];
  for (const [name, email, password, role, address, phone] of users) {
    const existing = await get("SELECT id FROM users WHERE email = ?", [email]);
    if (existing) {
      await run(
        "UPDATE users SET name=?, password=?, role=?, shipping_address=?, phone=?, login_attempts=0, locked_until=NULL, reset_token=NULL WHERE id=?",
        [name, password, role, address, phone, existing.id],
      );
    } else {
      await run(
        "INSERT INTO users (name, email, password, role, shipping_address, phone, login_attempts) VALUES (?,?,?,?,?,?,0)",
        [name, email, password, role, address, phone],
      );
    }
  }

  // Drop every account the fixtures do not own. POST /api/register accepts anything
  // (no validation at all), so any setup step or exploratory case that creates an
  // account leaves a row behind. run-newman.js reseeds between collections WITHOUT
  // restarting the server, so junk rows would otherwise accumulate across a session.
  const keep = users.map(([, email]) => email);
  const placeholders = keep.map(() => "?").join(",");
  const purged = await run(
    `DELETE FROM users WHERE email IS NULL OR email NOT IN (${placeholders})`,
    keep,
  );
  if (purged.changes > 0) console.log(`Purged ${purged.changes} test-created account(s).`);

  const tester = await get("SELECT id FROM users WHERE email = ?", ["test@eshop.com"]);
  const victim = await get("SELECT id FROM users WHERE email = ?", ["victim@eshop.com"]);

  // --- orders ------------------------------------------------------------
  await run("DELETE FROM orders");
  await run("DELETE FROM sqlite_sequence WHERE name = 'orders'");
  const ownerIds = [tester.id, victim.id];
  for (const ownerId of ownerIds) {
    for (const [status, amount] of ORDER_FIXTURES) {
      await run(
        "INSERT INTO orders (user_id, total_amount, status, shipping_address) VALUES (?,?,?,?)",
        [ownerId, amount, status, "123 Le Loi, Q1, TP.HCM"],
      );
    }
  }

  // --- coupon usage ------------------------------------------------------
  // Cleared so the max_uses_per_user (C5) tests start from a known count of 0.
  await run("DELETE FROM coupon_usage");

  const orders = await new Promise((resolve, reject) =>
    db.all("SELECT id, user_id, status FROM orders ORDER BY id", [], (e, r) =>
      e ? reject(e) : resolve(r),
    ),
  );

  const map = {};
  for (const o of orders) {
    const who = o.user_id === tester.id ? "tester" : "victim";
    map[`${who}_${o.status}`] = o.id;
  }

  console.log("Seed complete.");
  console.log(JSON.stringify({ testerId: tester.id, victimId: victim.id, orders: map }, null, 2));
  db.close();
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
