import { describe, it, expect } from "vitest";
import app from "../../src/index.js";

describe("Sessions API — авторизация", () => {
  it("GET /api/sessions — без токена возвращает 401", async () => {
    const res = await app.request("/api/sessions");
    expect(res.status).toBe(401);
  });

  it("POST /api/sessions — без токена возвращает 401", async () => {
    const res = await app.request("/api/sessions", { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("POST /api/sessions/:id/answers — без токена возвращает 401", async () => {
    const res = await app.request("/api/sessions/some-id/answers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: "q1", userAnswer: ["a"] }),
    });
    expect(res.status).toBe(401);
  });

  it("POST /api/sessions/:id/submit — без токена возвращает 401", async () => {
    const res = await app.request("/api/sessions/some-id/submit", { method: "POST" });
    expect(res.status).toBe(401);
  });
});