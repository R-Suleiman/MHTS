import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  chmodSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const root = resolve(".local-db");
const cluster = join(root, "cluster");
const versions = existsSync("/usr/lib/postgresql")
  ? readdirSync("/usr/lib/postgresql").sort((a, b) => Number(b) - Number(a))
  : [];
const bin =
  process.env.PG_BIN ||
  (versions[0] ? `/usr/lib/postgresql/${versions[0]}/bin` : "");
function pg(name, args, quiet = false) {
  return execFileSync(bin ? join(bin, name) : name, args, {
    stdio: quiet ? "pipe" : "inherit",
  });
}
const command = process.argv[2] || "start";
mkdirSync(root, { recursive: true, mode: 0o700 });
if (command === "stop") {
  pg("pg_ctl", ["-D", cluster, "-m", "fast", "-w", "stop"]);
  process.exit(0);
}
if (command === "status") {
  pg("pg_ctl", ["-D", cluster, "status"]);
  process.exit(0);
}
if (command !== "start") throw new Error("Use start, stop or status");
if (!existsSync(join(cluster, "PG_VERSION"))) {
  const password = randomBytes(24).toString("hex");
  writeFileSync(join(root, "password"), password, { mode: 0o600 });
  pg("initdb", [
    "-D",
    cluster,
    "-U",
    "mhts",
    "--auth=scram-sha-256",
    `--pwfile=${join(root, "password")}`,
    "--encoding=UTF8",
    "--no-locale",
  ]);
  writeFileSync(
    join(cluster, "postgresql.auto.conf"),
    `listen_addresses = '127.0.0.1'\nport = 5433\nunix_socket_directories = '${root.replaceAll("'", "''")}'\n`,
  );
}
let running = true;
try {
  pg("pg_ctl", ["-D", cluster, "status"], true);
} catch {
  running = false;
}
if (!running)
  pg("pg_ctl", [
    "-D",
    cluster,
    "-l",
    join(root, "postgres.log"),
    "-w",
    "start",
  ]);
const password = readFileSync(join(root, "password"), "utf8").trim();
const { default: postgres } = await import("pg");
const client = new postgres.Client({
  host: "127.0.0.1",
  port: 5433,
  user: "mhts",
  password,
  database: "postgres",
});
await client.connect();
try {
  if (
    !(await client.query("SELECT 1 FROM pg_database WHERE datname='mhts'"))
      .rowCount
  )
    await client.query("CREATE DATABASE mhts");
} finally {
  await client.end();
}
if (!existsSync(".env.local")) {
  writeFileSync(
    ".env.local",
    `DATABASE_URL=postgresql://mhts:${password}@127.0.0.1:5433/mhts\nCOOKIE_SECURE=false\n`,
    { mode: 0o600 },
  );
  chmodSync(".env.local", 0o600);
}
console.log(
  "Local PostgreSQL is ready on 127.0.0.1:5433. Run npm run db:migrate.",
);
