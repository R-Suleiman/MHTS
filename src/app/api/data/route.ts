import { requireUser, HttpError } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { dataSchema } from "@/lib/data";
import {
  ConflictError,
  deleteRecords,
  readData,
  writeData,
} from "@/lib/database";

export const runtime = "nodejs";
function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
function errorResponse(error: unknown) {
  if (error instanceof HttpError)
    return json({ error: error.message }, error.status);
  if (error instanceof ConflictError)
    return json({ error: error.message }, 409);
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return json(
      { error: "Invalid records. Please check the submitted values." },
      400,
    );
  // Do not log health records, credentials, or raw database errors.
  return json(
    {
      error:
        "The database is unavailable. Your change was not confirmed. Retry, or reload to check saved records.",
    },
    503,
  );
}
export async function GET() {
  try {
    const user = await requireUser();
    return json({ ...(await readData(user.profile_key)), accountId: user.id });
  } catch (error) {
    return errorResponse(error);
  }
}
const inputSchema = z.object({
  data: dataSchema,
  revision: z.number().int().min(0),
});
async function mutate(request: Request, remove: boolean) {
  const origin = request.headers.get("origin");
  const allowedOrigin =
    process.env.APP_ORIGIN ||
    `${new URL(request.url).protocol}//${request.headers.get("host")}`;
  if (origin !== allowedOrigin)
    return json({ error: "Request origin not allowed." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json"))
    return json({ error: "JSON required." }, 415);
  try {
    const user = await requireUser();
    const body = await request.text();
    if (Buffer.byteLength(body) > 2_000_000)
      return json({ error: "Records exceed the 2 MB request limit." }, 413);
    const parsed = JSON.parse(body);
    if (parsed.accountId !== user.id)
      return json(
        { error: "The signed-in account changed. Reload before saving." },
        409,
      );
    if (remove) {
      const { revision } = z
        .object({ revision: z.number().int().min(0) })
        .parse(parsed);
      return json(await deleteRecords(user.profile_key, revision));
    }
    const { data, revision } = inputSchema.parse(parsed);
    if (
      !data.profile ||
      new Set(data.checkins.map((c) => c.date)).size !== data.checkins.length ||
      new Set(data.assessments.map((a) => a.id)).size !==
        data.assessments.length ||
      new Set(data.actions.map((a) => a.id)).size !== data.actions.length
    )
      return json(
        { error: "Records need a profile and unique dates and IDs." },
        400,
      );
    return json(await writeData(user.profile_key, data, revision));
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PUT(request: Request) {
  return mutate(request, false);
}
export async function DELETE(request: Request) {
  return mutate(request, true);
}
