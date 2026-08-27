import { z } from "zod";

export const authEnvSchema = z.object({
  NEON_AUTH_BASE_URL: z.url(),
  NEON_AUTH_COOKIE_SECRET: z.string().min(32),
});

export function parseAuthEnv(input: Record<string, string | undefined>) {
  const result = authEnvSchema.safeParse(input);

  if (!result.success) {
    throw new Error(
      `Invalid Neon Auth configuration:\n${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}
