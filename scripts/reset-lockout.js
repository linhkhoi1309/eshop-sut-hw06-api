/**
 * Clears the account-lockout counters.
 *
 * server.js:54 increments login_attempts by *2* per failed login and locks at >= 3
 * (server.js:56) for 180 s. So the account is locked after the SECOND wrong password,
 * not the third. Any negative-path login test poisons every later test that needs to
 * authenticate as that user, unless this runs in between.
 */
const path = require("path");
const sqlite3 = require(path.resolve(__dirname, "../sut/backend/node_modules/sqlite3"));

const db = new sqlite3.Database(path.resolve(__dirname, "../sut/backend/database.sqlite"));
const target = process.argv[2]; // optional single email

const sql = target
  ? "UPDATE users SET login_attempts = 0, locked_until = NULL WHERE email = ?"
  : "UPDATE users SET login_attempts = 0, locked_until = NULL";

db.run(sql, target ? [target] : [], function (err) {
  if (err) {
    console.error("reset-lockout failed:", err.message);
    process.exit(1);
  }
  console.log(`Lockout cleared for ${this.changes} user(s)${target ? ` (${target})` : ""}.`);
  db.close();
});
