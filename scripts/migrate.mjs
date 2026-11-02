// Usage: pnpm db:migrate
import { openDb } from "./lib.mjs";

const { db, file, ran } = await openDb();
console.log(`Database: ${file}`);
console.log(ran.length ? `Applied: ${ran.join(", ")}` : "Already up to date.");
db.close();
