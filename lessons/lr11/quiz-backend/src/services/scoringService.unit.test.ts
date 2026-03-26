import { describe, it, expect } from "vitest";
import { ScoringService } from "./scoringService.js";

const scoring = new ScoringService();

describe("ScoringService", () => {
  describe("scoreMultipleSelect", () => {
    it("все ответы правильные — максимальный балл", () => {
      expect(scoring.scoreMultipleSelect(["a", "b", "c"], ["a", "b", "c"])).toBe(3);
    });

    it("один правильный + много неправильных — не уходит в минус", () => {
      expect(scoring.scoreMultipleSelect(["a"], ["a", "b", "c", "d"])).toBe(0);
    });

    it("частично правильные — штраф за неправильный", () => {
      expect(scoring.scoreMultipleSelect(["a", "b", "c"], ["a", "d"])).toBe(0.5);
    });
  });

  describe("scoreEssay", () => {
    const rubric = [
      { criterion: "structure", maxPoints: 3 },
      { criterion: "content", maxPoints: 5 },
    ];

    it("балл превышает максимум — обрезается", () => {
      expect(scoring.scoreEssay([{ criterion: "content", points: 10 }], rubric)).toBe(5);
    });

    it("несуществующий критерий — игнорируется", () => {
      expect(scoring.scoreEssay([{ criterion: "unknown", points: 5 }], rubric)).toBe(0);
    });
  });
});