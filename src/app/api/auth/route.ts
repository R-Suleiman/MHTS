import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { pool, readData } from "@/lib/database";
import { hashPassword, verifyPassword, DUMMY_HASH } from "@/lib/passwords";
import {
  AUTH_COOKIE,
  HttpError,
  authError,
  checkOrigin,
  clearSession,
  createSession,
  json,
  rateLimit,
  requireUser,
  setSession,
  tokenHash,
} from "@/lib/auth";

export const runtime = "nodejs";
const password = z.string().min(15).max(128);
const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});
const registration = credentials.extend({
  password,
  name: z.string().trim().min(1).max(40),
  adult: z.literal(true),
  claimLegacy: z.boolean().optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    return json({
      user: { id: user.id, email: user.email },
      ...(await readData(user.profile_key)),
    });
  } catch (error) {
    return authError(error);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const text = await request.text();
    if (Buffer.byteLength(text) > 8192)
      throw new HttpError(413, "Request too large.");
    const body = JSON.parse(text);
    const action = z
      .enum(["register", "login", "logout", "password", "delete"])
      .parse(body?.action);
    if (action === "logout") {
      const token = (await cookies()).get(AUTH_COOKIE)?.value;
      if (token)
        await pool().query("DELETE FROM auth_sessions WHERE token_hash=$1", [
          tokenHash(token),
        ]);
      await clearSession();
      return json({ ok: true });
    }
    if (action === "login" || action === "register") {
      const input =
        action === "register"
          ? registration.parse(body)
          : credentials.parse(body);
      await rateLimit("credential:" + input.email);
      // Global backstop avoids relying on spoofable forwarding headers on a local server.
      await rateLimit("credential:global", 120);
      const newHash =
        action === "register" ? await hashPassword(input.password) : null;
      if (action === "login") {
        const result = await pool().query(
          "SELECT id,password_hash FROM users WHERE email=$1",
          [input.email],
        );
        const valid = await verifyPassword(
          input.password,
          result.rows[0]?.password_hash || DUMMY_HASH,
        );
        if (!valid || !result.rowCount)
          throw new HttpError(401, "Email or password is incorrect.");
        const client = await pool().connect();
        let token: string;
        try {
          await client.query("BEGIN");
          const current = await client.query(
            "SELECT id FROM users WHERE id=$1 AND password_hash=$2 FOR UPDATE",
            [result.rows[0].id, result.rows[0].password_hash],
          );
          if (!current.rowCount)
            throw new HttpError(401, "Email or password is incorrect.");
          token = await createSession(client, result.rows[0].id);
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
        await setSession(token);
        return json({ ok: true });
      }
      const details = registration.parse(body);
      const oldCookie = (await cookies()).get("mhts-session")?.value;
      const legacyKey =
        details.claimLegacy && oldCookie && /^[a-f0-9]{64}$/.test(oldCookie)
          ? tokenHash(oldCookie)
          : null;
      const client = await pool().connect();
      let token: string;
      try {
        await client.query("BEGIN");
        let owner: string = randomUUID();
        if (legacyKey) {
          const previous = await client.query(
            "SELECT owner_key FROM profiles WHERE owner_key=$1 FOR UPDATE",
            [legacyKey],
          );
          const claimed = await client.query(
            "SELECT 1 FROM users WHERE profile_key=$1",
            [legacyKey],
          );
          if (previous.rowCount && !claimed.rowCount) owner = legacyKey;
        }
        await client.query(
          "INSERT INTO profiles(owner_key,profile) VALUES($1,$2) ON CONFLICT(owner_key) DO UPDATE SET profile=COALESCE(profiles.profile,EXCLUDED.profile)",
          [
            owner,
            JSON.stringify({
              name: details.name,
              adult: true,
              consentAt: new Date().toISOString(),
            }),
          ],
        );
        const id = randomUUID();
        await client.query(
          "INSERT INTO users(id,email,password_hash,profile_key) VALUES($1,$2,$3,$4)",
          [id, details.email, newHash, owner],
        );
        token = await createSession(client, id);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        if ((error as { code?: string }).code === "23505")
          throw new HttpError(
            400,
            "Unable to create an account with these details. Try signing in instead.",
          );
        throw error;
      } finally {
        client.release();
      }
      await setSession(token);
      if (details.claimLegacy) (await cookies()).delete("mhts-session");
      return json({ ok: true }, 201);
    }
    const user = await requireUser();
    await rateLimit("sensitive:" + user.id);
    const currentPassword = z
      .string()
      .min(1)
      .max(128)
      .parse(body.currentPassword);
    const newPassword =
      action === "password" ? password.parse(body.newPassword) : null;
    const client = await pool().connect();
    let token: string | null = null;
    try {
      await client.query("BEGIN");
      const current = await client.query(
        "SELECT password_hash FROM users WHERE id=$1 FOR UPDATE",
        [user.id],
      );
      if (
        !current.rowCount ||
        !(await verifyPassword(currentPassword, current.rows[0].password_hash))
      )
        throw new HttpError(401, "Current password is incorrect.");
      if (action === "delete") {
        await client.query("DELETE FROM profiles WHERE owner_key=$1", [
          user.profile_key,
        ]);
      } else {
        await client.query("UPDATE users SET password_hash=$2 WHERE id=$1", [
          user.id,
          await hashPassword(newPassword!),
        ]);
        await client.query("DELETE FROM auth_sessions WHERE user_id=$1", [
          user.id,
        ]);
        token = await createSession(client, user.id);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    if (token) await setSession(token);
    else await clearSession();
    return json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return json(
        {
          error:
            "Check your details. Use a valid email and a password of 15–128 characters when creating or changing it.",
        },
        400,
      );
    return authError(error);
  }
}
