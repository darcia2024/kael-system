import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n")
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^"|"$/g,"")]; })
);

// DDL lewat session pooler (5432), bukan transaction pooler (6543).
const url = env.DATABASE_URL.replace(":6543/", ":5432/");
const sql = postgres(url, { prepare: false, ssl: "require", max: 1, idle_timeout: 10 });

const dir = "supabase/migrations";
const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql")).sort();

let ok = 0;
try {
  for (const f of files) {
    const body = fs.readFileSync(path.join(dir, f), "utf8");
    try {
      await sql.unsafe(body);
      console.log("OK    " + f);
      ok++;
    } catch (e) {
      console.log("GAGAL " + f);
      console.log("      " + e.message);
      break;
    }
  }
  console.log("\n" + ok + "/" + files.length + " migrasi terpasang");
} finally {
  await sql.end({ timeout: 10 });
}
