import "server-only";

import { createNeonAuth, type NeonAuth } from "@neondatabase/auth/next/server";

import { headers } from "next/headers";
import {
  createAuthServer,
  extractNeonAuthCookies,
  type NeonAuthServer,
} from "@neondatabase/auth/server";

import { parseAuthEnv } from "./env";

let authInstance: NeonAuth | undefined;
let sessionReader: NeonAuthServer | undefined;

export function getAuth() {
  if (authInstance) {
    return authInstance;
  }

  authInstance = createNeonAuth(getAuthConfig());

  return authInstance;
}

export function getAuthConfig() {
  const config = parseAuthEnv({
    NEON_AUTH_BASE_URL: process.env.NEON_AUTH_BASE_URL,
    NEON_AUTH_COOKIE_SECRET: process.env.NEON_AUTH_COOKIE_SECRET,
  });
  return {
    baseUrl: config.NEON_AUTH_BASE_URL,
    cookies: { secret: config.NEON_AUTH_COOKIE_SECRET, sessionDataTtl: 300 },
  };
}

// Rendering may validate a session, but cannot write response cookies. Proxy
// and the auth route handler retain responsibility for refreshing those cookies.
export function getSessionReader() {
  if (sessionReader) return sessionReader;
  const config = getAuthConfig();
  sessionReader = createAuthServer({
    baseUrl: config.baseUrl,
    cookieSecret: config.cookies.secret,
    sessionDataTtl: config.cookies.sessionDataTtl,
    context: async () => {
      const requestHeaders = await headers();
      return {
        getCookies: () => extractNeonAuthCookies(requestHeaders),
        setCookie() {},
        getHeader: (name) => requestHeaders.get(name),
        getOrigin: () => requestHeaders.get("origin") ?? "",
        getFramework: () => "nextjs",
      };
    },
  });
  return sessionReader;
}
