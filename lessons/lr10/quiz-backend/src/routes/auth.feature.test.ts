import { describe, it, expect } from "vitest";
import app from "../../src/index.js";
// Проверяем, что сервер вообще живой
describe("Auth API", () => {
  it("GET /health — сервер работает", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });
  // Проверяем, что нас не пускает без токена
  it("GET /api/auth/me — без токена возвращает 401", async () => {
    const res = await app.request("/api/auth/me");
    expect(res.status).toBe(401);
  });
  // Проверяем, что Zod не дает передать пустые данные
  it("POST /api/auth/github/callback — пустой code возвращает 400", async () => {
    const res = await app.request("/api/auth/github/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "" }),
    });
    expect(res.status).toBe(400);
  });
});