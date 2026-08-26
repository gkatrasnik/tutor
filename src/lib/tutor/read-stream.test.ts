import { describe, expect, it } from "vitest";
import { readTutorStream } from "./read-stream";

function bytes(text: string) {
  const encoded = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({ start(controller) {
    for (const byte of encoded) controller.enqueue(new Uint8Array([byte]));
    controller.close();
  } });
}

describe("tutor stream framing", () => {
  it("handles split JSON lines and multi-byte characters", async () => {
    const events: unknown[] = [];
    await readTutorStream(bytes('{"type":"delta","text":"Živjo 👋"}\n{"type":"done","messageId":"id"}\n'), (event) => events.push(event));
    expect(events).toEqual([{ type: "delta", text: "Živjo 👋" }, { type: "done", messageId: "id" }]);
  });
  it("rejects interrupted streams instead of assuming persistence succeeded", async () => {
    await expect(readTutorStream(bytes('{"type":"delta","text":"partial"}\n'), () => {})).rejects.toThrow("before saving was confirmed");
  });
  it("surfaces safe server errors", async () => {
    await expect(readTutorStream(bytes('{"type":"error","error":"Please retry"}\n'), () => {})).rejects.toThrow("Please retry");
  });
});
