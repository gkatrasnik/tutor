import { describe, expect, it } from "vitest";

import { cohereEmbeddingOptions } from "./contracts";

describe("Cohere embedding contract", () => {
  it.each(["search_document", "search_query"] as const)("uses %s with float 1536-dimensional output", (inputType) => {
    expect(cohereEmbeddingOptions(inputType, 1536)).toEqual({
      cohere: {
        inputType,
        outputDimension: 1536,
        embeddingTypes: ["float"],
      },
    });
  });
});
