// Stand administration.
//   pnpm stand:create <STAND-CODE> <username> "<Display Name>"   → new stand + premade owner account
//   pnpm stand:list
//   pnpm stand:rotate <STAND-CODE>                               → new tag secret (old tag stops working)
//   pnpm stand:disable <STAND-CODE> | stand:enable <STAND-CODE>
import { randomBytes } from "node:crypto";
import { appUrl, openDb, provisionStand, sha256, tagSecret, writeTagSheet } from "./lib.mjs";

const [cmd, ...args] = process.argv.slice(2);
const { db } = await openDb();

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

if (cmd === "create") {
  const [code, username, displayName] = args;
  if (!code || !username) fail('Usage: pnpm stand:create FD-2001 username "Display Name"');
  if (!/^[A-Z0-9-]{3,16}$/.test(code.toUpperCase())) fail("Stand codes use A-Z, 0-9 and dashes (3–16 chars).");
  if (!/^[a-zA-Z0-9_.]{3,24}$/.test(username)) fail("Usernames use letters, numbers, dots and underscores (3–24 chars).");
  const password = "FD-" + randomBytes(6).toString("base64url");
  const r = await provisionStand(db, { code: code.toUpperCase(), username, password, displayName: displayName || username });
  console.log(`Created ${r.code} for ${r.username}\n  Temp password: ${r.password}\n  Recovery code: ${r.recovery}\n  NFC tag URL:   ${r.url}`);
  console.log(`Saved to ${writeTagSheet([r])}`);
} else if (cmd === "list") {
  const rows = db
    .prepare(
      `SELECT s.stand_code, s.status, u.username, u.trial_granted_at FROM phone_stands s
         LEFT JOIN stand_assignments a ON a.stand_id = s.id AND a.unassigned_at IS NULL
         LEFT JOIN users u ON u.id = a.user_id ORDER BY s.stand_code`,
    )
    .all();
  console.table(rows.map((r) => ({ stand: r.stand_code, status: r.status, owner: r.username ?? "—", trialUsed: r.trial_granted_at ? new Date(r.trial_granted_at).toISOString().slice(0, 10) : "no" })));
} else if (cmd === "rotate") {
  const code = args[0]?.toUpperCase();
  const secret = tagSecret();
  const r = db.prepare("UPDATE phone_stands SET tag_secret_hash = ? WHERE stand_code = ?").run(sha256(secret), code);
  if (!r.changes) fail("Stand not found.");
  console.log(`New NFC tag URL for ${code} (rewrite the tag):\n  ${appUrl()}/nfc/${code}#k=${secret}`);
} else if (cmd === "disable" || cmd === "enable") {
  const r = db.prepare("UPDATE phone_stands SET status = ? WHERE stand_code = ?").run(cmd === "disable" ? "disabled" : "active", args[0]?.toUpperCase());
  if (!r.changes) fail("Stand not found.");
  console.log(`${args[0].toUpperCase()} ${cmd}d.`);
} else {
  fail("Commands: create, list, rotate, disable, enable");
}
db.close();
