import { describe, it, expect } from "vitest";
import app from "../../src/index.js";
describe("Admin API — security", () => {
  it("без токена — возвращает 401", async () => {
    const res = await app.request("/api/admin/questions");
    expect(res.status).toBe(401);
  });

  it("с невалидным токеном — возвращает 401", async () => {
    const res = await app.request("/api/admin/questions", {
      headers: { "Authorization": "Bearer invalid_token" },
    });
    expect(res.status).toBe(401);
  });
  
  it("GET /api/admin/answers/pending — без токена возвращает 401", async () => {
    const res = await app.request("/api/admin/answers/pending");
    expect(res.status).toBe(401);
  });
});