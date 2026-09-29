import { NextRequest } from "next/server";
import { handlers } from "@/auth";

/**
 * Custom server binds Next to localhost, so Request.url is https://localhost:3000
 * even when the browser hits an ngrok/public host. Auth.js builds callback/CSRF
 * URLs from that origin and login breaks. Rebuild the request URL from proxy headers.
 */
function withPublicUrl(req: NextRequest) {
  const forwardedHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const forwardedProto = (
    req.headers.get("x-forwarded-proto") ??
    req.nextUrl.protocol.replace(":", "") ??
    "http"
  )
    .split(",")[0]
    .trim();

  if (!forwardedHost) return req;

  const host = forwardedHost.split(",")[0].trim();
  const origin = `${forwardedProto}://${host}`;
  if (req.nextUrl.origin === origin) return req;

  return new NextRequest(`${origin}${req.nextUrl.pathname}${req.nextUrl.search}`, req);
}

export const GET = (req: NextRequest) => handlers.GET(withPublicUrl(req));
export const POST = (req: NextRequest) => handlers.POST(withPublicUrl(req));
