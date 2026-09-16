import { NoObjectGeneratedError } from "ai";
import type { z } from "zod";

export const OBJECT_OUTPUT_INSTRUCTION =
  "Return exactly one JSON object matching the requested schema. Do not wrap the object in an array, another property, or Markdown. Arrays belong only in fields defined as arrays by the schema.";

export function recoverWrappedObject<T>(error: unknown, schema: z.ZodType<T>) {
  if (
    !NoObjectGeneratedError.isInstance(error) ||
    error.finishReason !== "stop" ||
    !error.text
  )
    return null;
  let value: unknown;
  try {
    value = JSON.parse(error.text);
  } catch {
    return null;
  }
  if (!Array.isArray(value) || value.length !== 1) return null;
  const parsed = schema.safeParse(value[0]);
  return parsed.success ? parsed : null;
}
