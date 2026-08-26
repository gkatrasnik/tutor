import type { CourseOutline } from "./outline";

export const outlineFixture: CourseOutline = {
  title: "Learning to learn", summary: "A path through effective study habits.",
  lessons: ["Attention", "Memory", "Practice", "Reflection"].map((title) => ({
    title, objective: `Explain ${title.toLowerCase()} using the source.`,
    concepts: [title], retrievalQuery: `${title} study habits examples`,
  })),
};

export const sourceFixture = {
  courseName: "Learning to learn",
  materials: [
    { id: "aca9b80d-e56a-4728-b399-c416806b5069", filename: "Study notes",
      chunks: [{ ordinal: 0, pageNumber: 1, content: "Attention and memory support learning." }] },
    { id: "bca9b80d-e56a-4728-b399-c416806b5069", filename: "Practice notes",
      chunks: [{ ordinal: 0, pageNumber: 1, content: "Practice and reflection reinforce learning." }] },
  ],
};
