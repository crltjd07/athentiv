// Usage: pnpm db:migrate
import { openDb } from "./lib.mjs";

const { db, file, ran, remote } = await openDb();
console.log(`Database: ${remote ? "Turso " : ""}${file}`);
console.log(ran.length ? `Applied: ${ran.join(", ")}` : "Already up to date.");
db.close();
