import { Pool } from "pg";
import { AppData, dataSchema, emptyData } from "./data";
import { scoreAssessment } from "./assessments";

const globalDatabase = globalThis as unknown as { mhtsPool?: Pool };
export function pool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (globalDatabase.mhtsPool) return globalDatabase.mhtsPool;
  globalDatabase.mhtsPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
  });
  globalDatabase.mhtsPool.on("error", () => {
    console.error("An idle database connection was interrupted.");
  });
  return globalDatabase.mhtsPool;
}
export class ConflictError extends Error {}
export async function readData(session: string) {
  const client = await pool().connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const profile = await client.query(
      "SELECT profile, revision FROM profiles WHERE owner_key=$1",
      [session],
    );
    if (!profile.rowCount) {
      await client.query("COMMIT");
      return { data: emptyData(), revision: 0 };
    }
    const checkins = await client.query(
      "SELECT record FROM checkins WHERE owner_key=$1 ORDER BY day",
      [session],
    );
    const assessments = await client.query(
      "SELECT record FROM assessments WHERE owner_key=$1 ORDER BY record->>'date'",
      [session],
    );
    const actions = await client.query(
      "SELECT id, completed FROM activities WHERE owner_key=$1 ORDER BY id",
      [session],
    );
    await client.query("COMMIT");
    return {
      data: dataSchema.parse({
        version: 1,
        profile: profile.rows[0].profile,
        checkins: checkins.rows.map((r) => r.record),
        assessments: assessments.rows.map((r) => r.record),
        actions: actions.rows,
      }),
      revision: profile.rows[0].revision as number,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function writeData(
  session: string,
  data: AppData,
  revision: number,
) {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      "UPDATE profiles SET profile=$2, revision=revision+1 WHERE owner_key=$1 AND revision=$3 RETURNING revision",
      [session, JSON.stringify(data.profile), revision],
    );
    if (!updated.rowCount)
      throw new ConflictError(
        "Your records changed in another tab. Reload before saving again.",
      );
    await client.query("DELETE FROM checkins WHERE owner_key=$1", [session]);
    await client.query("DELETE FROM assessments WHERE owner_key=$1", [session]);
    await client.query("DELETE FROM activities WHERE owner_key=$1", [session]);
    for (const entry of data.checkins)
      await client.query("INSERT INTO checkins VALUES ($1,$2,$3)", [
        session,
        entry.date,
        JSON.stringify(entry),
      ]);
    for (const entry of data.assessments)
      await client.query("INSERT INTO assessments VALUES ($1,$2,$3,$4)", [
        session,
        entry.id,
        JSON.stringify(entry),
        JSON.stringify(scoreAssessment(entry)),
      ]);
    for (const entry of data.actions)
      await client.query("INSERT INTO activities VALUES ($1,$2,$3)", [
        session,
        entry.id,
        entry.completed,
      ]);
    await client.query("COMMIT");
    return { data, revision: updated.rows[0].revision as number };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function deleteRecords(session: string, revision: number) {
  // Keep a tombstone revision so an older open tab cannot recreate deleted records.
  const current = await readData(session);
  return writeData(
    session,
    { ...emptyData(), profile: current.data.profile },
    revision,
  );
}
