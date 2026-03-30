# LR11: DevOps - Docker & CI/CD (Local-first)

## Полное теоретическое руководство

---

## Оглавление

1. [Почему DevOps в этом курсе начинается с локального контура](#почему-devops-в-этом-курсе-начинается-с-локального-контура)
2. [Windows-first: как читать команды](#windows-first-как-читать-команды)
3. [Docker: базовые сущности](#docker-базовые-сущности)
4. [Как читать Dockerfile](#как-читать-dockerfile)
5. [Multi-stage build для Node.js backend](#multi-stage-build-для-nodejs-backend)
6. [Docker Compose для backend + database](#docker-compose-для-backend--database)
7. [Environment variables и secrets](#environment-variables-и-secrets)
8. [Volumes, bind mounts и dev-режим](#volumes-bind-mounts-и-dev-режим)
9. [Healthchecks и логи](#healthchecks-и-логи)
10. [CI/CD базовая модель](#cicd-базовая-модель)
11. [GitHub Actions: workflow, jobs, steps](#github-actions-workflow-jobs-steps)
12. [CI workflow под LR11](#ci-workflow-под-lr11)
13. [Локальный запуск CI: act и fallback-подход](#локальный-запуск-ci-act-и-fallback-подход)
14. [Local CD-like сценарий без удаленного деплоя](#local-cd-like-сценарий-без-удаленного-деплоя)
15. [Rollback локально](#rollback-локально)
16. [Финальный checklist сдачи](#финальный-checklist-сдачи)

---

## Почему DevOps в этом курсе начинается с локального контура

В корневой программе курса для LR11 заявлены Docker и GitHub Actions.

Чтобы это было практично, в этой лабораторной ограничиваемся локальным циклом:

- сборка контейнера
- запуск окружения
- автоматические проверки
- локальный release/rollback

Почему так:

- проще повторить каждому студенту
- быстрее диагностировать ошибки
- меньше внешних факторов (платформа, квоты, сеть)

Это не «упрощение», а правильный фундамент перед удаленным деплоем в следующих этапах.

---

## Windows-first: как читать команды

В этом гайде команды всегда идут парой:

- **ЛИНУКС (эталон)** — базовый вариант (bash/zsh)
- **WINDOWS (PowerShell)** — эквивалент для большинства студентов

Если команда одинаковая, обе версии все равно показываются отдельно для однозначности.

---

## Docker: базовые сущности

- **Image**: неизменяемый шаблон приложения
- **Container**: запущенный экземпляр image
- **Dockerfile**: рецепт сборки image
- **Registry**: место хранения image (в LR11 можно не использовать)
- **Volume**: постоянное хранилище данных

Ключевая мысль:

> Docker делает окружение воспроизводимым, а не «магическим как на моем ноутбуке».

---

## Как читать Dockerfile

Базовые инструкции:

- `FROM` — базовый образ
- `WORKDIR` — рабочая директория
- `COPY` — копирование файлов в image
- `RUN` — шаги сборки (install/build)
- `ENV` — переменные среды
- `EXPOSE` — документирование порта
- `CMD` — команда запуска контейнера

Порядок инструкций важен для кеша.

Частая ошибка:

- сначала `COPY . .`, потом `npm install`

Лучше:

1. копировать `package*.json`
2. ставить зависимости
3. копировать остальной код

Так Docker может переиспользовать кеш слоев.

---

## Multi-stage build для Node.js backend

Цель: уменьшить размер runtime image и убрать лишние dev-зависимости.

Пример:

```dockerfile
# Stage 1: build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: runtime
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

Что важно:

- runtime stage не должен содержать исходники и dev tooling
- команда запуска должна стартовать уже собранный код

---

## Docker Compose для backend + database

Compose дает локальную оркестрацию нескольких сервисов.

Минимум для LR11:

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: quiz
      POSTGRES_USER: quiz
      POSTGRES_PASSWORD: quiz
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U quiz -d quiz"]
      interval: 5s
      timeout: 5s
      retries: 10
    volumes:
      - pg_data:/var/lib/postgresql/data

  backend:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    depends_on:
      db:
        condition: service_healthy

volumes:
  pg_data:
```

Практическое правило:

- внутри compose backend должен ходить к БД по host `db`, а не `localhost`.

---

## Environment variables и secrets

В LR11 используем локальный `.env` и шаблон `.env.example`.

Пример:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://quiz:quiz@db:5432/quiz
JWT_SECRET=local-dev-secret
```

Правила:

- `.env` не коммитить
- `.env.example` коммитить
- секреты не хардкодить в Dockerfile и workflow

---

## Volumes, bind mounts и dev-режим

- **Named volume**: для данных БД
- **Bind mount**: для исходников в dev-режиме

Для production-подобного запуска LR11 bind mounts не обязательны.

Для dev-итераций можно добавить `docker-compose.dev.yml`:

- монтировать `./src:/app/src`
- запускать `npm run dev`

---

## Healthchecks и логи

Контейнер считается «полезно живым», если проходит healthcheck.

Минимальный smoke-check:

```bash
# ЛИНУКС (эталон)
curl -f http://localhost:3000/health
```

```powershell
# WINDOWS (PowerShell)
$resp = Invoke-WebRequest -Uri "http://localhost:3000/health"
if ($resp.StatusCode -ne 200) { throw "Healthcheck failed" }
```

Диагностика:

```bash
# ЛИНУКС (эталон)
docker compose ps
docker compose logs -f backend
docker compose logs -f db
```

```powershell
# WINDOWS (PowerShell)
docker compose ps
docker compose logs -f backend
docker compose logs -f db
```

Если контейнер restart-ится циклически, сначала смотрите логи backend, затем переменные среды.

---

## CI/CD базовая модель

- **CI (Continuous Integration)**: автоматическая проверка изменений
- **CD (Continuous Delivery/Deployment)**: автоматическая подготовка/доставка релиза

В LR11 реализуем:

- полноценный CI
- локальный CD-like контур без внешней платформы

---

## GitHub Actions: workflow, jobs, steps

Workflow файл хранится в `.github/workflows/ci.yml`.

Структура:

- `on`: когда запускать
- `jobs`: набор независимых задач
- `steps`: последовательность действий внутри job

Пример базового workflow:

```yaml
name: CI

on:
  push:
    branches: ["main", "develop"]
  pull_request:
  workflow_dispatch:

jobs:
  lint-test-build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm run test

      - name: Build
        run: npm run build

      - name: Docker build
        run: docker build -t quiz-backend:ci .
```

---

## CI workflow под LR11

Минимальные quality gates:

1. `npm ci`
2. `npm run lint`
3. `npm run test`
4. `npm run build`
5. `docker build`

Если любой шаг падает — merge блокируется до исправления.

Рекомендуется добавлять шаги именно в этом порядке:

- сначала быстрые проверки (lint)
- затем тесты
- потом более тяжелая docker сборка

---

## Локальный запуск CI: act и fallback-подход

Вариант 1 (предпочтительно): `act`

```bash
# ЛИНУКС (эталон)
act -W .github/workflows/ci.yml
```

```powershell
# WINDOWS (PowerShell)
act -W .github/workflows/ci.yml
```

Вариант 2 (fallback): локальный CI скрипт с тем же порядком команд

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

Важно: fallback не заменяет Actions, но полезен для быстрого дебага.

---

## Local CD-like сценарий без удаленного деплоя

Цель: воспроизвести базовый release-процесс локально.

Пример последовательности:

1. Собрать image с tag
2. Запустить compose
3. Выполнить healthcheck и smoke endpoints
4. В случае ошибки вернуть предыдущий tag

Пример tag-подхода:

```bash
# ЛИНУКС (эталон)
export TAG=$(date +%Y%m%d-%H%M%S)
docker build -t quiz-backend:$TAG .
```

```powershell
# WINDOWS (PowerShell)
$TAG = Get-Date -Format "yyyyMMdd-HHmmss"
docker build -t quiz-backend:$TAG .
```

---

## Rollback локально

Простейший подход:

1. хранить `previous` и `current` tags
2. при сбое переключать compose на `previous`
3. повторять smoke-check

Пример логики rollback:

```bash
# ЛИНУКС (эталон)
# pseudo-steps
# 1) docker compose down
# 2) export BACKEND_IMAGE=quiz-backend:<previous-tag>
# 3) docker compose up -d
# 4) curl /health
```

```powershell
# WINDOWS (PowerShell)
# pseudo-steps
# 1) docker compose down
# 2) $env:BACKEND_IMAGE="quiz-backend:<previous-tag>"
# 3) docker compose up -d
# 4) Invoke-WebRequest http://localhost:3000/health
```

Это дает практику контроля релизов без внешней инфраструктуры.

---

## Финальный checklist сдачи

- Есть `Dockerfile` и `.dockerignore`
- Есть `docker-compose.yml` для backend + db
- Есть `ci.yml` с lint/test/build/docker-build
- Есть подтверждение успешного контейнерного запуска
- Есть локальный smoke-check
- Есть описание локального rollback сценария
- В работе отсутствует удаленный деплой

---

## Частые anti-patterns

1. Сборка и запуск на `latest` без tag'ов
2. Один контейнер и для build, и для runtime с dev-зависимостями
3. Хардкод секретов в Dockerfile
4. Отсутствие healthcheck
5. Нет воспроизводимого порядка CI шагов

---

## Итог

LR11 — это переход от «код запускается» к «код воспроизводимо собирается, проверяется и запускается в стандартизированном окружении».

Следующий логический шаг после этой лабораторной — подключение удаленного deployment в отдельном занятии.
