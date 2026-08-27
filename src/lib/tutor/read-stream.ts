import type { TutorEvent } from "./contracts";

// Streaming TextDecoder retains split UTF-8 characters; the buffer retains split
// JSON records. A clean "done" is required before treating an answer as saved.
export async function readTutorStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: TutorEvent) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done = false;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) {
        buffer += decoder.decode();
        break;
      }
      buffer += decoder.decode(part.value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        const event = JSON.parse(line) as TutorEvent;
        if (event.type === "error") throw new Error(event.error);
        if (event.type === "done") done = true;
        onEvent(event);
      }
    }
    if (!done || buffer.trim())
      throw new Error(
        "The connection ended before saving was confirmed. Refresh the conversation before resending.",
      );
  } finally {
    reader.releaseLock();
  }
}
