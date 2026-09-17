import { MockLanguageModelV4 } from "ai/test";

// Exercise the SDK streaming path with the same structured fixtures used for
// lesson generation. Dedicated gated-stream tests verify incremental delivery.
export function streamingModel(
  options: ConstructorParameters<typeof MockLanguageModelV4>[0],
) {
  const model = new MockLanguageModelV4(options);
  model.doStream = async (params) => {
    const result = await model.doGenerate(params);
    return {
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: "stream-start", warnings: [] });
          controller.enqueue({ type: "text-start", id: "text" });
          for (const part of result.content) {
            if (part.type === "text")
              controller.enqueue({
                type: "text-delta",
                id: "text",
                delta: part.text,
              });
          }
          controller.enqueue({ type: "text-end", id: "text" });
          controller.enqueue({
            type: "finish",
            finishReason: result.finishReason,
            usage: result.usage,
            providerMetadata: result.providerMetadata,
          });
          controller.close();
        },
      }),
    };
  };
  return model;
}
