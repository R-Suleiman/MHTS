import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { pool } from "./database";
import type { PoolClient } from "pg";
export const AUTH_COOKIE = "mhts-auth";
export const tokenHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function authError(error: unknown) {
  return json(
    {
      error:
        error instanceof HttpError
          ? error.message
          : "We couldn’t connect to your account. Please try again.",
    },
    error instanceof HttpError ? error.status : 503,
  );
}
export function checkOrigin(request: Request) {
  const origin =
    process.env.APP_ORIGIN ||
    `${new URL(request.url).protocol}//${request.headers.get("host")}`;
  if (request.headers.get("origin") !== origin)
    throw new HttpError(403, "Request origin not allowed.");
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "JSON required.");
}
export async function requireUser() {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    throw new HttpError(401, "Please sign in to continue.");
  const result = await pool().query(
    "SELECT u.id, u.email, u.profile_key FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()",
    [tokenHash(token)],
  );
  if (!result.rowCount)
    throw new HttpError(401, "Your session has ended. Please sign in again.");
  return result.rows[0] as { id: string; email: string; profile_key: string };
}
export async function createSession(client: PoolClient, userId: string) {
  const token = randomBytes(32).toString("hex");
  await client.query(
    "INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
    [tokenHash(token), userId],
  );
  return token;
}
export async function setSession(token: string) {
  (await cookies()).set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: 7 * 24 * 3600,
  });
}
export async function clearSession() {
  (await cookies()).delete(AUTH_COOKIE);
}
export async function rateLimit(bucket: string, max = 10) {
  const key = tokenHash(bucket);
  const result = await pool().query(
    "INSERT INTO auth_limits(bucket,attempts,resets_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN auth_limits.resets_at<=now() THEN 1 ELSE auth_limits.attempts+1 END, resets_at=CASE WHEN auth_limits.resets_at<=now() THEN now()+interval '15 minutes' ELSE auth_limits.resets_at END RETURNING attempts",
    [key],
  );
  if (result.rows[0].attempts > max)
    throw new HttpError(
      429,
      "Too many attempts. Please try again in 15 minutes.",
    );
  await pool().query(
    "DELETE FROM auth_limits WHERE resets_at < now() - interval '1 day'",
  );
  await pool().query("DELETE FROM auth_sessions WHERE expires_at < now()");
}
