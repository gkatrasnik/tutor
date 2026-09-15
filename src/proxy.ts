import { NextResponse, NextRequest } from "next/server";
import {
  parseSetCookies,
  processAuthMiddleware,
} from "@neondatabase/auth/server";
import { getAuth, getAuthConfig } from "@/lib/auth/server";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname !== "/") {
    return getAuth().middleware({ loginUrl: "/auth/sign-in" })(request);
  }

  // Refresh landing-page cookies before rendering, without requiring sign-in.
  const auth = getAuthConfig();
  const result = await processAuthMiddleware({
    request,
    pathname: "/",
    skipRoutes: ["/"],
    loginUrl: "/auth/sign-in",
    baseUrl: auth.baseUrl,
    cookieSecret: auth.cookies.secret,
    sessionDataTtl: auth.cookies.sessionDataTtl,
  });
  // Let this render read the refreshed cookies as well as sending them to the browser.
  const forwarded = new NextRequest(request.url, { headers: request.headers });
  for (const header of result.cookies ?? []) {
    for (const cookie of parseSetCookies(header)) {
      if (cookie.maxAge === 0) forwarded.cookies.delete(cookie.name);
      else forwarded.cookies.set(cookie.name, cookie.value);
    }
  }
  const requestHeaders = new Headers(forwarded.headers);
  if (result.action === "allow" && result.headers) {
    for (const [name, value] of Object.entries(result.headers)) {
      requestHeaders.set(name, value);
    }
  }
  const response =
    result.action === "redirect_oauth"
      ? NextResponse.redirect(result.redirectUrl)
      : NextResponse.next({ request: { headers: requestHeaders } });
  for (const cookie of result.cookies ?? []) {
    response.headers.append("Set-Cookie", cookie);
  }
  return response;
}

export const config = {
  matcher: ["/", "/app/:path*", "/admin/:path*"],
};
