import "server-only";

import { parseEnv } from "./env-schema";

export { parseEnv } from "./env-schema";

export const env = parseEnv({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
  TUTOR_MODEL: process.env.TUTOR_MODEL,
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL,
  EMBEDDING_DIMENSION: process.env.EMBEDDING_DIMENSION,
  ADMIN_EMAILS: process.env.ADMIN_EMAILS,
});
