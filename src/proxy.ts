import { NextResponse, type NextRequest } from "next/server";
import { isUnsupportedAgent } from "@/shared/deviceAgent";

// Pages reachable without a session.
const PUBLIC = ["/welcome", "/manual", "/login", "/register", "/recover", "/nfc", "/unsupported", "/offline", "/session-expired"];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (process.env.DEVICE_GATE !== "off" && pathname !== "/unsupported" && isUnsupportedAgent(req.headers.get("user-agent") ?? "")) {
    return NextResponse.rewrite(new URL("/unsupported", req.url));
  }

  const hasSession = req.cookies.has("fd_session");
  if (pathname === "/") {
    return NextResponse.redirect(new URL(hasSession ? "/home" : "/welcome", req.url));
  }
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!isPublic && !hasSession) {
    const url = new URL("/welcome", req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|.*\\.(?:png|svg|jpg|webp|ico|txt)$).*)"],
};
