import { describe, expect, it } from "vitest";

import { embeddingProviderOptions } from "./embedding-client.mjs";

describe("Cohere embedding contract", () => {
  it.each(["search_document", "search_query"] as const)(
    "uses %s with float 1536-dimensional output",
    (inputType) => {
      expect(
        embeddingProviderOptions("cohere/embed-v4.0", 1536, inputType),
      ).toEqual({
        cohere: {
          inputType,
          outputDimension: 1536,
          embeddingTypes: ["float"],
        },
      });
    },
  );
});
