import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth guard (only active when JOURNAL_PASSWORD is set). The session cookie is
 * validated for presence here and cryptographically in API handlers — the
 * middleware runtime has no Node crypto, so it gates navigation while the
 * handlers gate data.
 */
export const middleware = (request: NextRequest) => {
  const multiuser = process.env.XT_MULTIUSER === "1";
  if (!multiuser && !process.env.JOURNAL_PASSWORD) return NextResponse.next();
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname === "/api/auth" || pathname.startsWith("/api/customer/"))
    return NextResponse.next();
  const cookie = request.cookies.get(multiuser ? "xt_customer_session" : "journal_session")?.value;
  if (!cookie) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
};

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
