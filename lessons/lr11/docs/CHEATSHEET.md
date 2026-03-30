# LR11: DevOps - Docker & CI/CD (Local-first)

## Cheatsheet

Короткие шаблоны для практики LR11.

Формат: сначала **ЛИНУКС (эталон)**, затем **WINDOWS (PowerShell)**.

---

## 1. Проверка окружения

```bash
# ЛИНУКС (эталон)
docker --version
docker compose version
```

```powershell
# WINDOWS (PowerShell)
docker --version
docker compose version
```

---

## 2. Dockerfile (multi-stage, skeleton)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

---

## 3. `.dockerignore`

```text
node_modules
npm-debug.log
.git
.gitignore
coverage
dist
.env
```

---

## 4. Build + Run

```bash
# ЛИНУКС (эталон)
docker build -t quiz-backend:local .
docker run --rm -p 3000:3000 --env-file .env quiz-backend:local
```

```powershell
# WINDOWS (PowerShell)
docker build -t quiz-backend:local .
docker run --rm -p 3000:3000 --env-file .env quiz-backend:local
```

---

## 5. `docker-compose.yml` (минимум)

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: quiz
      POSTGRES_USER: quiz
      POSTGRES_PASSWORD: quiz

  backend:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    depends_on:
      - db
```

---

## 6. Compose команды

```bash
# ЛИНУКС (эталон)
docker compose up --build -d
docker compose ps
docker compose logs -f backend
docker compose down -v
```

```powershell
# WINDOWS (PowerShell)
docker compose up --build -d
docker compose ps
docker compose logs -f backend
docker compose down -v
```

---

## 7. Healthcheck

```bash
# ЛИНУКС (эталон)
curl -f http://localhost:3000/health
```

```powershell
# WINDOWS (PowerShell)
$resp = Invoke-WebRequest -Uri "http://localhost:3000/health"
if ($resp.StatusCode -ne 200) { throw "Healthcheck failed" }
```

---

## 8. GitHub Actions CI (базовый)

```yaml
name: CI

on:
  push:
  pull_request:
  workflow_dispatch:

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
      - run: docker build -t quiz-backend:ci .
```

---

## 9. Локальный запуск workflow (optional)

```bash
# ЛИНУКС (эталон)
act -W .github/workflows/ci.yml
```

```powershell
# WINDOWS (PowerShell)
act -W .github/workflows/ci.yml
```

Fallback:

```bash
# ЛИНУКС (эталон)
npm ci
npm run lint
npm run test
npm run build
docker build -t quiz-backend:ci .
```

```powershell
# WINDOWS (PowerShell)
npm ci
npm run lint
npm run test
npm run build
docker build -t quiz-backend:ci .
```

---

## 10. Local release script (идея)

```bash
# ЛИНУКС (эталон) - scripts/local-release.sh
#!/usr/bin/env bash
set -euo pipefail

TAG=$(date +%Y%m%d-%H%M%S)
docker build -t quiz-backend:$TAG .

docker compose up -d --build
curl -f http://localhost:3000/health

echo "Release ok: $TAG"
```

```powershell
# WINDOWS (PowerShell) - scripts/local-release.ps1
$ErrorActionPreference = "Stop"

$TAG = Get-Date -Format "yyyyMMdd-HHmmss"
docker build -t quiz-backend:$TAG .

docker compose up -d --build
$resp = Invoke-WebRequest -Uri "http://localhost:3000/health"
if ($resp.StatusCode -ne 200) { throw "Healthcheck failed" }

Write-Host "Release ok: $TAG"
```

---

## 11. Local rollback (идея)

```bash
# ЛИНУКС (эталон) - scripts/rollback-local.sh
#!/usr/bin/env bash
set -euo pipefail

PREV_TAG="$1"
export BACKEND_IMAGE="quiz-backend:${PREV_TAG}"

docker compose down
docker compose up -d
curl -f http://localhost:3000/health
```

```powershell
# WINDOWS (PowerShell) - scripts/rollback-local.ps1
param(
  [Parameter(Mandatory = $true)]
  [string]$PrevTag
)

$ErrorActionPreference = "Stop"
$env:BACKEND_IMAGE = "quiz-backend:$PrevTag"

docker compose down
docker compose up -d
$resp = Invoke-WebRequest -Uri "http://localhost:3000/health"
if ($resp.StatusCode -ne 200) { throw "Healthcheck failed" }
```

---

## 12. Диагностика

```bash
# ЛИНУКС (эталон)
docker images | head
docker ps -a
docker logs <container_id>
docker exec -it <container_id> sh
```

```powershell
# WINDOWS (PowerShell)
docker images
docker ps -a
docker logs <container_id>
docker exec -it <container_id> /bin/sh
```

---

## 13. Минимум для зачёта

- Dockerfile (multi-stage)
- Compose backend + db
- CI workflow (`lint`, `test`, `build`, `docker build`)
- Smoke-check после запуска
- Локальный release/rollback сценарий

---

## 14. Что не делаем в LR11

- Remote deploy на Railway/Render/Vercel
- Production secrets management во внешних vault
- Kubernetes
