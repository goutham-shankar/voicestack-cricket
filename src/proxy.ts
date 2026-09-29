import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  if (!session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") && session.user.role !== "admin") {
    return NextResponse.redirect(new URL(homeFor(session.user.role), req.url));
  }

  if (pathname.startsWith("/auctioneer") && session.user.role !== "auctioneer") {
    return NextResponse.redirect(new URL(homeFor(session.user.role), req.url));
  }

  if (pathname.startsWith("/team") && session.user.role !== "team") {
    return NextResponse.redirect(new URL(homeFor(session.user.role), req.url));
  }

  return NextResponse.next();
});

function homeFor(role: "admin" | "auctioneer" | "team") {
  if (role === "admin") return "/admin/dashboard";
  if (role === "auctioneer") return "/auctioneer/auction";
  return "/team/dashboard";
}

export const config = {
  matcher: ["/admin/:path*", "/auctioneer/:path*", "/team/:path*", "/display/:path*"],
};
