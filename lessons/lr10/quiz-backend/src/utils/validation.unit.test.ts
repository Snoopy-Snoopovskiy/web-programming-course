import { describe, it, expect } from "vitest";
import {
  answerSchema,
  questionSchema,
  categorySchema,
  paginationSchema,
  toPrismaPage,
} from "./validation.js";

describe("validation schemas", () => {
  it("answerSchema — валидный ответ проходит", () => {
    const result = answerSchema.safeParse({ questionId: "abc123", userAnswer: ["a"] });
    expect(result.success).toBe(true);
  });

  it("answerSchema — пустой userAnswer отклоняется", () => {
    const result = answerSchema.safeParse({ questionId: "abc123", userAnswer: [] });
    expect(result.success).toBe(false);
  });

  it("questionSchema — неверный тип вопроса отклоняется", () => {
    const result = questionSchema.safeParse({
      text: "Вопрос", type: "unknown-type", categoryId: "cat123",
    });
    expect(result.success).toBe(false);
  });

  it("questionSchema — points по умолчанию равен 1", () => {
    const result = questionSchema.safeParse({
      text: "Вопрос", type: "essay", categoryId: "cat123",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.points).toBe(1);
  });

  it("categorySchema — slug с пробелами отклоняется", () => {
    const result = categorySchema.safeParse({ name: "JS", slug: "java script" });
    expect(result.success).toBe(false);
  });

  it("paginationSchema — строки конвертируются в числа", () => {
    const result = paginationSchema.safeParse({ page: "2", limit: "10" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.page).toBe(2);
  });

  it("paginationSchema — limit больше 100 отклоняется", () => {
    const result = paginationSchema.safeParse({ page: 1, limit: 101 });
    expect(result.success).toBe(false);
  });

  it("toPrismaPage — вторая страница даёт правильный skip", () => {
    expect(toPrismaPage({ page: 2, limit: 10 })).toEqual({ skip: 10, take: 10 });
  });
});