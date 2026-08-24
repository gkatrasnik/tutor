import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  DATABASE_URL: z.url(),
  DATABASE_URL_UNPOOLED: z.url().optional(),
  TUTOR_MODEL: z.string().min(1).default("alibaba/qwen3.7-flash"),
  EMBEDDING_MODEL: z.string().min(1).default("cohere/embed-v4.0"),
  EMBEDDING_DIMENSION: z.coerce.number().int().positive().default(1536),
  ADMIN_EMAILS: z.string().default(""),
});

export function parseEnv(input: Record<string, string | undefined>) {
  const result = envSchema.safeParse(input);

  if (!result.success) {
    const message = z.prettifyError(result.error);
    throw new Error(`Invalid environment configuration:\n${message}`);
  }

  return result.data;
}
