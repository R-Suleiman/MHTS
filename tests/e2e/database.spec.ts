import { test, expect, type APIRequestContext } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { randomBytes, createHash } from "node:crypto";
import { Pool } from "pg";
import { demoData } from "../fixtures";
loadEnvConfig(process.cwd());
const headers = { origin: "http://127.0.0.1:3100" };
const password = "An entirely fictional long password!";
async function register(request: APIRequestContext) {
  const email = `auth-${crypto.randomUUID()}@example.com`;
  const res = await request.post("/api/auth", {
    headers,
    data: { action: "register", email, password, name: "Test", adult: true },
  });
  expect(res.status()).toBe(201);
  return { email, ...(await (await request.get("/api/auth")).json()) };
}
async function remove(request: APIRequestContext, currentPassword = password) {
  return request.post("/api/auth", {
    headers,
    data: { action: "delete", currentPassword },
  });
}

test("protected APIs, account isolation, revisions, and cross-origin rejection", async ({
  request,
  playwright,
}) => {
  expect((await request.get("/api/data")).status()).toBe(401);
  expect(
    (await request.post("/api/assessments", { headers, data: {} })).status(),
  ).toBe(401);
  const first = await register(request);
  const other = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3100",
  });
  try {
    const second = await register(other);
    const data = demoData();
    const body = { data, revision: first.revision, accountId: first.user.id };
    expect(
      (await request.put("/api/data", { headers, data: body })).status(),
    ).toBe(200);
    expect(
      (await (await other.get("/api/data")).json()).data.assessments,
    ).toHaveLength(0);
    expect(
      (await other.put("/api/data", { headers, data: body })).status(),
    ).toBe(409);
    expect(
      (await request.put("/api/data", { headers, data: body })).status(),
    ).toBe(409);
    expect(
      (
        await request.put("/api/data", {
          headers: { origin: "https://evil.example" },
          data: body,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.put("/api/data", {
          headers,
          data: {
            ...body,
            revision: 1,
            data: { ...data, checkins: [{ ...data.checkins[0], mood: 99 }] },
          },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await request.delete("/api/data", {
          headers,
          data: { revision: 1, accountId: first.user.id },
        })
      ).status(),
    ).toBe(200);
    const cleared = await (await request.get("/api/data")).json();
    expect(cleared.data.checkins).toHaveLength(0);
    expect(cleared.data.profile).not.toBeNull();
    expect(second.user.id).not.toBe(first.user.id);
  } finally {
    await remove(request);
    await remove(other);
    await other.dispose();
  }
});

test("password change revokes old sessions, invalid login is generic, logout revokes tokens", async ({
  request,
  playwright,
}) => {
  const account = await register(request);
  const other = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3100",
  });
  const newPassword = "An updated entirely fictional password!";
  try {
    const invalid = await other.post("/api/auth", {
      headers,
      data: { action: "login", email: account.email, password: "incorrect" },
    });
    expect(invalid.status()).toBe(401);
    expect((await invalid.json()).error).toBe(
      "Email or password is incorrect.",
    );
    expect(
      (
        await other.post("/api/auth", {
          headers,
          data: {
            action: "login",
            email: account.email.toUpperCase(),
            password,
          },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.post("/api/auth", {
          headers,
          data: { action: "password", currentPassword: password, newPassword },
        })
      ).status(),
    ).toBe(200);
    expect((await other.get("/api/data")).status()).toBe(401);
    expect((await request.get("/api/data")).status()).toBe(200);
    const state = await request.storageState();
    expect(state.cookies.find((c) => c.name === "mhts-auth")?.httpOnly).toBe(
      true,
    );
    expect(
      (
        await request.post("/api/auth", { headers, data: { action: "logout" } })
      ).status(),
    ).toBe(200);
    const stale = await playwright.request.newContext({
      baseURL: "http://127.0.0.1:3100",
      storageState: state,
    });
    expect((await stale.get("/api/data")).status()).toBe(401);
    await stale.dispose();
    expect(
      (
        await request.post("/api/auth", {
          headers,
          data: {
            action: "login",
            email: account.email,
            password: newPassword,
          },
        })
      ).status(),
    ).toBe(200);
  } finally {
    await remove(request, newPassword);
    await other.dispose();
  }
});

test("an old browser profile is claimed once and expired sessions are refused", async ({
  playwright,
}) => {
  const token = randomBytes(32).toString("hex");
  const key = createHash("sha256").update(token).digest("hex");
  const db = new Pool({ connectionString: process.env.DATABASE_URL });
  const request = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3100",
    storageState: {
      cookies: [
        {
          name: "mhts-session",
          value: token,
          domain: "127.0.0.1",
          path: "/",
          httpOnly: true,
          secure: false,
          sameSite: "Strict",
          expires: -1,
        },
      ],
      origins: [],
    },
  });
  const email = `claim-${crypto.randomUUID()}@example.com`;
  try {
    await db.query("INSERT INTO profiles(owner_key,profile) VALUES($1,$2)", [
      key,
      JSON.stringify({
        name: "Previous",
        adult: true,
        consentAt: new Date().toISOString(),
      }),
    ]);
    expect(
      (
        await request.post("/api/auth", {
          headers,
          data: {
            action: "register",
            email,
            password,
            name: "New",
            adult: true,
            claimLegacy: true,
          },
        })
      ).status(),
    ).toBe(201);
    const account = await (await request.get("/api/auth")).json();
    expect(account.data.profile.name).toBe("Previous");
    await db.query(
      "UPDATE auth_sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1",
      [account.user.id],
    );
    expect((await request.get("/api/data")).status()).toBe(401);
    const stored = await db.query(
      "SELECT password_hash FROM users WHERE id=$1",
      [account.user.id],
    );
    expect(stored.rows[0].password_hash).toMatch(/^scrypt-v1\$/);
    expect(stored.rows[0].password_hash).not.toContain(password);
  } finally {
    await db.query("DELETE FROM profiles WHERE owner_key=$1", [key]);
    await db.end();
    await request.dispose();
  }
});

test("authentication attempts are throttled", async ({ request }) => {
  const account = await register(request);
  try {
    for (let i = 0; i < 9; i++)
      expect(
        (
          await request.post("/api/auth", {
            headers,
            data: { action: "login", email: account.email, password: "wrong" },
          })
        ).status(),
      ).toBe(401);
    expect(
      (
        await request.post("/api/auth", {
          headers,
          data: { action: "login", email: account.email, password: "wrong" },
        })
      ).status(),
    ).toBe(429);
  } finally {
    await remove(request);
  }
});
