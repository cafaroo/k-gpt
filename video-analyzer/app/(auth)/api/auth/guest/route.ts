import { NextResponse } from "next/server";

// Guest auth disabled for POC (no database available). Just redirect home.
export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawRedirect = searchParams.get("redirectUrl") || "/";
  const redirectUrl =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/";
  return NextResponse.redirect(new URL(redirectUrl, request.url));
}
