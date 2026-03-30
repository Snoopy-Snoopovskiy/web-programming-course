# LR11: DevOps - Docker & CI/CD (Local-first)

## Структура занятия

- **Лекция:** Контейнеризация и автоматизация backend
  - Материалы: [slides.html](docs/slides-standalone/slides.html)
  - Справочные материалы: [GUIDE.md](docs/GUIDE.md) | [CHEATSHEET.md](docs/CHEATSHEET.md) | [Interactive Examples](docs/interactive.html)

- **Практическая работа:** Полный локальный DevOps цикл для backend

### Формат команд в LR11

В материалах ниже команды с меткой **ЛИНУКС (эталон)** остаются базовыми, а рядом дается эквивалент для **WINDOWS (PowerShell)**.

---

## Практическая работа: Локальный DevOps контур без удаленного деплоя

### Цели

По окончании практической работы вы:

1. Подготовите reproducible runtime окружение через Docker
2. Соберете оптимизированный Docker image для Node.js backend
3. Запустите backend + database в `docker compose`
4. Настроите CI workflow в GitHub Actions (lint + test + build)
5. Проверите workflow локально (через `act`) или через альтернативный локальный запуск
6. Соберете локальный CD-like сценарий: "build -> start -> healthcheck -> rollback"

### Результат

Backend приложение, которое:

- Имеет production-подобный локальный запуск в контейнерах
- Имеет предсказуемую сборку и запуск через Dockerfile
- Имеет автоматизированный CI pipeline
- Проходит smoke-проверку после контейнерного старта
- Не зависит от удаленного deployment окружения

### Важное ограничение LR11

- локальные контейнеры
- локальные проверки качества
- локальная симуляция release-процесса

---

## Содержание лекции (из программы курса)

Базовая канва из корневого `README.md`, раздел "Занятие 11":

1. **Docker Basics**

- Что такое Docker и почему нужен
- Images vs Containers
- Dockerfile и best practices
- Docker Compose для multi-container приложений

2. **Containerizing Backend**

- Dockerfile для Node.js
- Multi-stage builds
- Environment variables и secrets
- Volume mounting для development

3. **CI/CD с GitHub Actions**

- Принципы CI/CD
- Workflow, jobs, steps
- Triggers (`push`, `pull_request`, `workflow_dispatch`)

4. **Локальный release-контур (вместо remote deployment)**

- Автоматический build локального образа
- Запуск контейнеров и healthcheck
- Локальные логи и диагностика
- Простой rollback на предыдущий tag

---

## Инструменты и технологии

| Технология               | Назначение                               |
| ------------------------ | ---------------------------------------- |
| **Docker**               | Сборка и запуск контейнеров              |
| **Docker Compose**       | Локальная оркестрация backend + DB       |
| **GitHub Actions**       | CI pipeline (lint, test, build)          |
| **act** _(optional)_     | Локальный запуск GitHub Actions workflow |
| **Healthcheck scripts**  | Smoke-проверка после старта              |
| **Logs (`docker logs`)** | Диагностика проблем в контейнере         |

---

## Рекомендуемая структура проекта

```text
quiz-backend/
├── src/
├── prisma/
├── Dockerfile
├── .dockerignore
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── .github/
│   └── workflows/
│       └── ci.yml
├── scripts/
│   ├── healthcheck.sh
│   ├── healthcheck.ps1
│   ├── local-release.sh
│   ├── local-release.ps1
│   ├── rollback-local.sh
│   └── rollback-local.ps1
└── package.json
```

---

## Scripts (пример)

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "lint": "eslint .",
    "test": "vitest run",
    "docker:build": "docker build -t quiz-backend:local .",
    "docker:run": "docker run --rm -p 3000:3000 --env-file .env quiz-backend:local",
    "compose:up": "docker compose up --build -d",
    "compose:down": "docker compose down -v",
    "compose:logs": "docker compose logs -f backend",
    "ci:local:linux": "bash ./scripts/local-release.sh",
    "ci:local:win": "powershell -ExecutionPolicy Bypass -File .\\scripts\\local-release.ps1"
  }
}
```

---

## Checkpoints

### Checkpoint 0: База и prerequisites

**Что сделать:**

1. Проверить `docker --version` и `docker compose version`
2. Подготовить `.env` на основе `.env.example`
3. Убедиться, что backend из LR8-10 стабильно стартует локально

**Проверка:** локальный `npm run dev` и базовый health endpoint работают

**Вопросы:**

- зачем вообще нужен Docker в проекте, если приложение уже запускается локально
- какие две команды из Checkpoint 0 подтверждают, что Docker и Docker Compose готовы к работе
- зачем делать `.env` на основе `.env.example`, а не писать переменные вручную с нуля

---

### Checkpoint 1: Dockerfile для backend

**Что сделать:**

1. Создать или обновить `Dockerfile` для Node.js backend
2. Использовать multi-stage build (`builder` + `runner`)
3. Добавить `.dockerignore` для ускорения сборки
4. Запустить:

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

**Проверка:** контейнер стартует, `/health` отвечает `200`

**Вопросы:**

- что делает docker build, откуда берется конфигурация
- что делает docker run
- что такое --rm
- что такое -p XXX:YYY
- зачем нужен `--env-file .env` в `docker run`, и что будет, если его не передать

---

### Checkpoint 2: Docker Compose (backend + database)

**Что сделать:**

1. Добавить `docker-compose.yml`:

- сервис `backend`
- сервис `db` (Postgres/MySql)
- том для данных БД

2. Добавить `depends_on` + `healthcheck`
3. Прокинуть environment variables через `.env`
4. Запустить стек:

```bash
# ЛИНУКС (эталон)
docker compose up --build -d
docker compose ps
docker compose logs -f backend
```

```powershell
# WINDOWS (PowerShell)
docker compose up --build -d
docker compose ps
docker compose logs -f backend
```

**Проверка:** backend подключается к БД, migrations проходят, API доступно

**Вопросы:**

- зачем использовать `docker compose`, если можно запускать контейнеры по одному
- чем `docker compose up --build -d` отличается от запуска без `-d`
- где смотреть статус сервисов и логи при старте стека (CLI или Docker Desktop)
- почему внутри compose backend должен подключаться к БД по имени сервиса, а не по `localhost`

---

### Checkpoint 3: CI pipeline в GitHub Actions

**Что сделать:**

1. Создать `.github/workflows/ci.yml`
2. Добавить job'ы:

- `lint`
- `test`
- `docker-build`

3. Добавить triggers:

- `push`
- `pull_request`
- `workflow_dispatch`

4. Проверить пайплайн:

- в GitHub Actions UI
- или локально через `act` (опционально)

Локальный fallback (если `act` не используется):

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

**Проверка:** workflow завершается со статусом success

**Вопросы:**

- что проверяет CI pipeline в нашем случае
- почему в pipeline есть и `test`, и `docker build`
- как запустить workflow вручную в GitHub Actions
- что делать первым делом, если workflow завершился с ошибкой

---

### Checkpoint 4: Локальный CD-like сценарий

**Что сделать:**

1. Создать скрипты `scripts/local-release.sh` и `scripts/local-release.ps1`:

- сборка нового образа с tag
- запуск compose
- smoke-check (`/health`, 1-2 API endpoint)

2. Создать `scripts/rollback-local.sh` и `scripts/rollback-local.ps1`:

- переключение на предыдущий tag
- повторная smoke-проверка

3. Прогнать сценарий минимум один раз

**Проверка:** есть воспроизводимый локальный release/rollback цикл

**Вопросы:**

- зачем тегировать образ перед локальным релизом
- чем smoke-check отличается от полного набора тестов
- в каком случае нужно запускать rollback
- какие негативные последствия можно получить, если не реализовать rollback-сценарий

---

## Итоговые требования

- Рабочий `Dockerfile` (multi-stage)
- Рабочий `docker-compose.yml` с backend + db
- CI workflow с `lint + test + docker build`
- Документированный локальный release сценарий (без remote deploy)
- Smoke-check после запуска контейнеров

---

## Типичные проблемы

| Проблема                           | Причина                              | Решение                                          |
| ---------------------------------- | ------------------------------------ | ------------------------------------------------ |
| `Cannot find module dist/...`      | build шаг не выполнен перед запуском | Проверить `RUN npm run build` в Dockerfile       |
| Контейнер backend падает на старте | БД ещё не готова                     | Добавить healthcheck и retry/wait-for-db         |
| `ECONNREFUSED` к Postgres          | Неверный host/port в `DATABASE_URL`  | Для compose использовать host = имя сервиса `db` |
| Медленная сборка Docker            | Большой build context                | Настроить `.dockerignore`, использовать кеш слои |
| CI green локально, red в Actions   | Разные версии Node                   | Зафиксировать Node version в workflow            |

---

## Критерии оценки

- Реализованы все checkpoints
- Контейнерный запуск стабилен и воспроизводим
- CI pipeline проверяет качество и сборку
- Есть локальный CD-like сценарий и rollback
- Нет привязки к удаленным deployment сервисам
- README и структура проекта понятны для повторного запуска

---

## Справочные материалы

- [GUIDE.md](docs/GUIDE.md)
- [CHEATSHEET.md](docs/CHEATSHEET.md)
- [slides-speech.md](docs/slides-speech.md)
- [interactive.html](docs/interactive.html)

---

## Дополнительно

- Добавить отдельный `docker-compose.test.yml` для изолированного тестового запуска

---

**Цель LR11:** научиться упаковывать backend в контейнеры и автоматизировать качество/сборку локально, без зависимости от удаленного деплоя.
