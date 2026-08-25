import "server-only";

import { createNeonAuth, type NeonAuth } from "@neondatabase/auth/next/server";

import { parseAuthEnv } from "./env";

let authInstance: NeonAuth | undefined;

export function getAuth() {
  if (authInstance) {
    return authInstance;
  }

  const config = parseAuthEnv({
    NEON_AUTH_BASE_URL: process.env.NEON_AUTH_BASE_URL,
    NEON_AUTH_COOKIE_SECRET: process.env.NEON_AUTH_COOKIE_SECRET,
  });

  authInstance = createNeonAuth({
    baseUrl: config.NEON_AUTH_BASE_URL,
    cookies: {
      secret: config.NEON_AUTH_COOKIE_SECRET,
      sessionDataTtl: 300,
    },
  });

  return authInstance;
}
