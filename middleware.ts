import { NextResponse } from "next/server";

import { auth } from "./src/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isPublicPath =
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth");

  if (isPublicPath) {
    return NextResponse.next();
  }

  const isProtectedPath = pathname === "/future" || pathname === "/ai-chat";

  if (isProtectedPath && !req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
