import { NextResponse } from "next/server";
import { MobileAuthError } from "@/lib/mobile/auth";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, { status: 200, ...init });
}

export function jsonCreated<T>(data: T) {
  return NextResponse.json({ data }, { status: 201 });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function readJsonBody<T = Record<string, unknown>>(
  request: Request,
): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new MobileAuthError(400, "Invalid JSON body");
  }
}

export function handleMobileError(err: unknown) {
  if (err instanceof MobileAuthError) {
    return jsonError(err.message, err.status);
  }
  console.error("[mobile-api]", err);
  const message = err instanceof Error ? err.message : "Internal server error";
  // Don't leak internal errors for unexpected failures
  if (message.startsWith("Invalid") || message.includes("not found") || message.includes("Cannot")) {
    return jsonError(message, 400);
  }
  return jsonError("Something went wrong", 500);
}

export function money(value: { toString(): string } | number | null | undefined) {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value.toString());
}
