import nextEnv from "@next/env";
import pg from "pg";
import { mkdirSync, chmodSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

nextEnv.loadEnvConfig(process.cwd());

async function transfer() {
  const source = new URL(process.env.SOURCE_DATABASE_URL);
  const target = new URL(process.env.DATABASE_URL);
  if (!target.password || target.password === "YOUR_PASSWORD")
    throw new Error(
      "Fill in devuser's password in DATABASE_URL in .env.local first. URL-encode special characters.",
    );
  if (
    source.hostname === target.hostname &&
    (source.port || "5432") === (target.port || "5432") &&
    source.pathname === target.pathname
  )
    throw new Error("Source and destination must be different databases.");
  if (target.pathname !== "/mhts")
    throw new Error(
      "This transfer script expects the destination database to be named mhts.",
    );

  const adminUrl = new URL(target);
  adminUrl.pathname = "/postgres";
  const admin = new pg.Client({
    connectionString: adminUrl.toString(),
    connectionTimeoutMillis: 5000,
  });
  await admin.connect();
  try {
    const exists = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = 'mhts'",
    );
    if (!exists.rowCount) await admin.query("CREATE DATABASE mhts");
  } finally {
    await admin.end();
  }

  const destination = new pg.Client({
    connectionString: target.toString(),
    connectionTimeoutMillis: 5000,
  });
  await destination.connect();
  try {
    const objects = await destination.query(
      "SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' LIMIT 1",
    );
    if (objects.rowCount)
      throw new Error(
        "Destination is not empty. Nothing was overwritten. Use an empty mhts database; do not run db:migrate before transferring.",
      );
  } finally {
    await destination.end();
  }

  mkdirSync(".local-db/backups", { recursive: true, mode: 0o700 });
  const backup = resolve(`.local-db/backups/mhts-${Date.now()}.dump`);
  function run(tool, url, args) {
    // Credentials go through the child environment, never command arguments or logs.
    const result = spawnSync(
      process.env.PG_BIN ? `${process.env.PG_BIN}/${tool}` : tool,
      args,
      {
        env: {
          ...process.env,
          PGHOST: url.hostname,
          PGPORT: url.port || "5432",
          PGUSER: decodeURIComponent(url.username),
          PGPASSWORD: decodeURIComponent(url.password),
          PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
          PGCONNECT_TIMEOUT: "5",
        },
        stdio: "inherit",
      },
    );
    if (result.error || result.status !== 0)
      throw new Error(
        `${tool} failed. The original database is unchanged. Check the connection and PostgreSQL tool version.`,
      );
  }
  run("pg_dump", source, [
    "--format=custom",
    "--no-owner",
    "--no-privileges",
    "--file",
    backup,
  ]);
  chmodSync(backup, 0o600);
  run("pg_restore", target, [
    "--dbname",
    "mhts",
    "--single-transaction",
    "--exit-on-error",
    "--no-owner",
    "--no-privileges",
    backup,
  ]);
  console.log(
    "Transfer complete. The original database and a local backup are preserved. Restart MHTS to use the new connection.",
  );
}

transfer().catch((error) => {
  // Never print connection URLs or configuration objects.
  console.error(
    error instanceof Error ? error.message : "Database transfer failed.",
  );
  process.exitCode = 1;
});
