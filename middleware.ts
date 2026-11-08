import { NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "weather-decision-auth";

export function middleware(request: Request) {
  const url = new URL(request.url);
  const { pathname } = url;

  const isPublicPath =
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api");

  if (isPublicPath) {
    return NextResponse.next();
  }

  const isProtectedPath = pathname === "/future" || pathname === "/ai-chat";
  const sessionCookie = request.headers.get("cookie") ?? "";
  const hasAuthCookie = sessionCookie
    .split(";")
    .some((cookie) => cookie.trim().startsWith(`${AUTH_COOKIE_NAME}=`));

  if (isProtectedPath && !hasAuthCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
