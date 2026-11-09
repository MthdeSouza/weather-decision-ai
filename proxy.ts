import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE_NAME = "weather-decision-auth";

export function proxy(request: NextRequest) {
  const url = new URL(request.url);
  const { pathname } = url;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  const isPublicPath =
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api");

  if (isPublicPath) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const protectedRoutes = [
    "/future",
    "/ai-chat",
    "/meus-chamados",
    "/analise-chamados",
    "/gerenciamento",
    "/acompanhamento",
  ];

  const isProtectedPath = protectedRoutes.includes(pathname);
  const sessionCookie = request.headers.get("cookie") ?? "";
  const hasAuthCookie = sessionCookie
    .split(";")
    .some((cookie) => cookie.trim().startsWith(`${AUTH_COOKIE_NAME}=`));

  if (isProtectedPath && !hasAuthCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
