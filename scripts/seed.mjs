// Usage: pnpm db:seed
// Creates three demo phone stands with premade stand-owner accounts. Idempotent: existing stands
// are skipped. Credentials and NFC tag URLs are printed and appended to data/stand-tags.txt.
// No fake activity is generated — every account starts empty.
// The demo password is public, so don't run this against a live database you share.
import { openDb, provisionStand, writeTagSheet } from "./lib.mjs";

const { db, file, remote } = await openDb();
console.log(`Database: ${remote ? "Turso " : ""}${file}`);

const demo = [
  { code: "FD-1001", username: "owner1", password: "FocusDock2026", displayName: "Alex" },
  { code: "FD-1002", username: "owner2", password: "FocusDock2026", displayName: "Bea" },
  { code: "FD-1003", username: "owner3", password: "FocusDock2026", displayName: "Carlo" },
];

const created = [];
for (const s of demo) {
  const exists = await db.get("SELECT 1 FROM phone_stands WHERE stand_code = ?", s.code);
  const userExists = await db.get("SELECT 1 FROM users WHERE username = ?", s.username);
  if (exists || userExists) {
    console.log(`- ${s.code} already exists, skipping`);
    continue;
  }
  created.push(await provisionStand(db, s));
}

if (created.length) {
  for (const r of created) console.log(`\n${r.code}  user=${r.username}  password=${r.password}\n  NFC URL: ${r.url}`);
  console.log(`\nSaved to ${writeTagSheet(created)}`);
} else {
  console.log("Nothing to do.");
}
db.close();
