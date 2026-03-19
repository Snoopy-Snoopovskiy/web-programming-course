import app from "../../quiz-backend/src/index";

// Хелпер для запросов без авторизации
export function makeRequest(path: string, options?: RequestInit) {
  return app.request(path, options);
}

// Хелпер для запросов с Bearer токеном
export function makeAuthRequest(path: string, token: string, options?: RequestInit) {
  return app.request(path, {
    ...options,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
}