import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  updateSession,
} from "./app/lib/supabase-proxy";

export async function proxy(
  request: NextRequest
) {
  const pathname =
    request.nextUrl.pathname;

  // Public production health check
  if (
    pathname === "/api/health" ||
      pathname === "/api/queue/analysis-jobs" ||
      pathname === "/api/queue/notification-deliveries" ||
      pathname === "/api/analysis-jobs/upload" ||
      pathname === "/api/customer-automation/source/upload" ||
      pathname === "/api/cron/recurring-scans"
  ) {
    return NextResponse.next();
  }

  // Never expose internal verification routes in production
if (
  process.env.NODE_ENV === "production" &&
  pathname.startsWith("/api/test-")
) {
  return new NextResponse(null, {
    status: 404,
  });
}

// Development-only API routes
  if (
    process.env.NODE_ENV !==
      "production" &&
    (
      pathname.startsWith(
        "/api/test-"
      ) ||
      pathname.startsWith(
        "/api/map-csv"
      ) ||
      pathname.startsWith(
        "/api/analyze-csv"
      )
    )
  ) {
    return NextResponse.next();
  }

  return updateSession(
    request
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
