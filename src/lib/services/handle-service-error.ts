import { NextResponse } from "next/server";
import { ServiceError } from "@/lib/services/service-error";

export function handleServiceError(err: unknown) {
  if (err instanceof ServiceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
}
