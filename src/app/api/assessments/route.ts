import { requireUser, checkOrigin, HttpError, authError } from "@/lib/auth";
import { NextResponse } from "next/server";
import {
  assessmentInput,
  ASSESSMENT_VERSION,
  scoreAssessment,
} from "@/lib/assessments";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    await requireUser();
    const text = await request.text();
    if (text.length > 4096)
      return NextResponse.json(
        { error: "Request too large." },
        { status: 413 },
      );
    const result = assessmentInput.safeParse(JSON.parse(text));
    if (!result.success)
      return NextResponse.json(
        { error: "Please answer every question with a valid option." },
        { status: 400 },
      );
    return NextResponse.json(
      { scores: scoreAssessment(result.data), version: ASSESSMENT_VERSION },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof HttpError) return authError(error);
    return NextResponse.json(
      { error: "Invalid assessment request." },
      { status: 400 },
    );
  }
}
