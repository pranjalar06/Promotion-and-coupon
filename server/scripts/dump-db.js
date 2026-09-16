// Regenerates prisma/schema.sql (structure only) and prisma/schema_data.sql
// (structure + data) from the database DATABASE_URL currently points at.
// Strips pg_dump 18's \restrict/\unrestrict guards for broad psql compatibility
// and excludes Prisma's internal _prisma_migrations bookkeeping table.
require("dotenv").config();
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set (check server/.env).");
  process.exit(1);
}

const OUT_DIR = path.join(__dirname, "..", "prisma");

// Resolve pg_dump: prefer PATH, else PGDUMP_PATH env var, else search common
// Windows PostgreSQL install locations (pg_dump often isn't on PATH there).
function resolvePgDump() {
  if (process.env.PGDUMP_PATH) return process.env.PGDUMP_PATH;
  try {
    execFileSync("pg_dump", ["--version"], { stdio: "ignore" });
    return "pg_dump";
  } catch {
    // fall through to search
  }
  const base = "C:\\Program Files\\PostgreSQL";
  if (fs.existsSync(base)) {
    const versions = fs.readdirSync(base).sort().reverse();
    for (const v of versions) {
      const candidate = path.join(base, v, "bin", "pg_dump.exe");
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  console.error(
    "Could not find pg_dump. Add it to your PATH, or set PGDUMP_PATH=C:\\path\\to\\pg_dump.exe"
  );
  process.exit(1);
}

const PG_DUMP = resolvePgDump();

// Prisma's DATABASE_URL carries a `?schema=` query param that libpq/pg_dump
// doesn't understand as a URI param — connect via discrete -h/-p/-U/-d flags
// instead, and pass the password via PGPASSWORD rather than embedding it in argv.
const parsed = new URL(DATABASE_URL);
const pgEnv = { ...process.env, PGPASSWORD: decodeURIComponent(parsed.password || "") };
const connArgs = [
  "-h", parsed.hostname,
  "-p", parsed.port || "5432",
  "-U", decodeURIComponent(parsed.username || ""),
  "-d", decodeURIComponent(parsed.pathname.replace(/^\//, "")),
];

function stripRestrictGuards(sql) {
  return sql
    .split("\n")
    .filter((line) => !line.startsWith("\\restrict") && !line.startsWith("\\unrestrict"))
    .join("\n");
}

function dump(schemaOnly, outFile, header) {
  const args = [...connArgs, "--no-owner", "--no-privileges", "--no-comments", "--exclude-table=_prisma_migrations"];
  if (schemaOnly) args.push("--schema-only");

  let sql;
  try {
    sql = execFileSync(PG_DUMP, args, { encoding: "utf8", maxBuffer: 1024 * 1024 * 50, env: pgEnv });
  } catch (err) {
    console.error(`pg_dump failed (is it on your PATH?): ${err.message}`);
    process.exit(1);
  }

  sql = stripRestrictGuards(sql).replace(
    "-- Dumped from database version",
    `${header}\n-- Dumped from database version`
  );

  const outPath = path.join(OUT_DIR, outFile);
  fs.writeFileSync(outPath, sql);
  console.log(`Wrote ${outPath}`);
}

dump(
  true,
  "schema.sql",
  `-- Schema-only dump of the PromoStore database. Use this to bootstrap a fresh
-- PostgreSQL database without needing Node/Prisma installed:
--   createdb promo_db
--   psql -d promo_db -f schema.sql
-- This does NOT seed any data — run \`npm run seed\` (server/prisma/seed.js)
-- afterwards for demo categories/products/promotions/admin account.`
);

dump(
  false,
  "schema_data.sql",
  `-- Full dump (schema + data) of the PromoStore database, as an alternative to
-- schema.sql + npm run seed. Use this to clone the exact current dev database
-- (categories, products, promotions, the admin account, and any orders placed
-- locally) onto a fresh PostgreSQL instance without needing Node/Prisma:
--   createdb promo_db
--   psql -d promo_db -f schema_data.sql
-- Note: user password hashes come along as-is (bcrypt hashes, not plaintext),
-- so seeded/existing accounts keep working; anyone who signed up locally can
-- still log in with their original password on the new database.`
);
