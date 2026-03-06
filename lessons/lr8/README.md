# LR9: Database & Business Logic - Scoring Algorithm

## Структура занятия

- **Лекция (90 минут):** Теория Advanced Backend разработки
  - Материалы: [slides.html](docs/slides-standalone/slides.html) | [slides-speech.md](docs/slides-speech.md)
  - Справочные материалы: [GUIDE.md](docs/GUIDE.md) | [CHEATSHEET.md](docs/CHEATSHEET.md) | [Interactive Examples](docs/interactive.html)

- **Практическая работа (следующая неделя, 180 минут):** Реализация бизнес-логики

---

## 🎯 Практическая работа: Добавляем Business Logic

### Цели

По окончании практической работы вы:

1. **Реализуете Scoring Algorithm** для разных типов вопросов
2. **Добавите бизнес-логику в endpoints** (Session, Answer)
3. **Обновите Prisma schema** с relationships и индексами
4. **Реализуете admin endpoints** для управления и оценивания
5. **Добавите валидацию** на сервере для всех inputs
6. **Оптимизируете database queries** для performance

### Результат

Backend приложение которое:

- ✅ Правильно считает баллы (multiple-select, essay)
- ✅ Управляет жизненным циклом сессии (start, submit, expire)
- ✅ Имеет admin функциональность (manage, grade, report)
- ✅ Валидирует все данные на сервере
- ✅ Быстро работает с большими наборами данных
- ✅ Использует transactions для безопасности

---

## 🛠️ Инструменты и технологии

Те же что в LR8 плюс дополнительные концепции:

| Технология           | Назначение                                          |
| -------------------- | --------------------------------------------------- |
| **Prisma**           | ORM с relationships, transactions, batch operations |
| **Zod**              | Runtime validation для inputs                       |
| **Transactions**     | Atomic операции для consistency                     |
| **Database Indexes** | Для оптимизации queries                             |
| **Pagination**       | Для работы с большими наборами                      |

---

## 📦 Структура работы

Вы работаете с backend из LR8 и добавляете функциональность:

```
quiz-backend/ (из LR8)
├── src/
│   ├── services/                ← НОВОЕ: Бизнес-логика
│   │   ├── scoringService.ts    # Функции для подсчёта баллов
│   │   └── sessionService.ts    # Управление жизненным циклом сессии
│   ├── utils/
│   │   └── validation.ts        ← НОВОЕ: Zod schemas
│   ├── middleware/
│   │   └── admin.ts             ← НОВОЕ: проверка admin роли
│   ├── routes/
│   │   ├── sessions.ts          ← ИЗМЕНИТЬ: добавить логику
│   │   ├── answers.ts           ← НОВОЕ: endpoints для ответов
│   │   └── admin.ts             ← НОВОЕ: admin endpoints
│   └── index.ts                 ← ИЗМЕНИТЬ: добавить новые routes
├── prisma/
│   └── schema.prisma            ← ИЗМЕНИТЬ: relationships, индексы
└── ...
```

---

## 📋 Checkpoints (без микроменеджмента)

Работайте независимо. Каждый checkpoint — это отдельная функциональность.

### ✅ Checkpoint 0: Quiz Models (30 минут)

**Цель:** Добавить модели Session, Answer, Question, Category в Prisma schema

**Контекст из LR8:**
В LR8 вы создали только User модель для аутентификации. Теперь добавляем модели для Quiz функциональности.

**Что делать:**

1. Откройте `prisma/schema.prisma` и добавьте модели:

```prisma
model Category {
  id        String     @id @default(cuid())
  name      String
  slug      String     @unique
  questions Question[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
}

model Question {
  id             String   @id @default(cuid())
  text           String
  type           String   // "single-select", "multiple-select", "essay"
  categoryId     String
  category       Category @relation(fields: [categoryId], references: [id])
  correctAnswer  Json?    // Правильные ответы для автопроверки
  points         Int      @default(1)
  answers        Answer[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model Session {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  status      String    @default("in_progress") // "in_progress", "completed", "expired"
  score       Float?
  startedAt   DateTime  @default(now())
  expiresAt   DateTime
  completedAt DateTime?
  answers     Answer[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([userId])
  @@index([status])
  @@index([userId, status])
}

model Answer {
  id         String   @id @default(cuid())
  sessionId  String
  session    Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  questionId String
  question   Question @relation(fields: [questionId], references: [id])
  userAnswer Json
  score      Float?   // null если ещё не проверен (essay)
  isCorrect  Boolean? // для автопроверки
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([sessionId, questionId]) // один ответ на вопрос в сессии
  @@index([sessionId])
  @@index([questionId])
}
```

2. **Обновите User модель** - добавьте role и relationship с Session:

```prisma
model User {
  id        String    @id @default(cuid())
  email     String    @unique
  name      String?
  githubId  String    @unique
  role      String    @default("student") // "student" или "admin"
  sessions  Session[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}
```

3. Запустите миграцию:

```bash
npx prisma migrate dev --name add-quiz-models
```

4. Проверьте в Prisma Studio:

```bash
npx prisma studio
```

**Подсказка:**

- `Json` тип для `correctAnswer` и `userAnswer` - гибкая структура данных
- `onDelete: Cascade` - при удалении Session автоматически удаляются все Answer
- Индексы на `userId`, `status` для быстрых queries по этим полям
- `@@unique([sessionId, questionId])` - студент может ответить на вопрос только один раз в сессии
- `role` поле в User - для admin функциональности в Checkpoint 5

**Проверка:**

- Prisma Studio показывает все 5 таблиц: User, Category, Question, Session, Answer
- Relationships видны в Studio (можно переходить по связям между таблицами)
- Миграция применена без ошибок

---

### ✅ Checkpoint 1: Scoring Service (30 минут)

**Цель:** Создать сервис для подсчёта баллов

**Что делать:**

1. Создайте файл `src/services/scoringService.ts` (это **бизнес-логика**, а не утилита!)
2. Создайте class `ScoringService` с методами:
   - `scoreMultipleSelect(correctAnswers, studentAnswers): number`
     - Правила: +1 за правильный, -0.5 за неправильный, min 0
   - `scoreEssay(grades, rubric): number`
     - Параметры: массив оценок, рубрика с максимальными баллами
3. Экспортируйте singleton: `export const scoringService = new ScoringService()`
4. Напишите тесты (минимум 5 тестов для каждого метода)

**Подсказка:**

- Используйте примеры из slides-speech.md (слайд 9-10)
- Services слой — это место для сложной бизнес-логики
- Routes будут вызывать `scoringService.scoreMultipleSelect(...)` в лучше этого Checkpoint'е

**Проверка:** Тесты проходят, методы возвращают правильные значения

---

### ✅ Checkpoint 2: Prisma Schema Updates (20 минут)

**Цель:** Обновить schema с relationships и оптимизацией

**Что делать:**

1. Обновите `prisma/schema.prisma`
   - Добавьте одиночные индексы на часто используемые поля (userId, status)
   - Добавьте комбинированный индекс на [userId, status]
   - Убедитесь что relationships правильные
2. Создайте миграцию: `npx prisma migrate dev --name add-indexes`
3. Проверьте в Prisma Studio что всё работает

**Подсказка:** Смотрите CHEATSHEET.md — раздел "Database Indexes"

**Проверка:** Миграция применена, индексы видны в БД

---

### ✅ Checkpoint 3: Session & Answer Endpoints (60 минут)

**Цель:** Добавить бизнес-логику в endpoints (использовать services)

**Что делать:**

1. **Создайте файл `src/services/sessionService.ts`**
   - Класс с методом `submitAnswer(sessionId, questionId, userAnswer)`
   - Класс с методом `submitSession(sessionId)`
   - Используйте `scoringService` для вычисления баллов
   - Используйте `prisma.$transaction()` для безопасности

2. **Обновите POST /api/sessions** (route)
   - Получить количество вопросов для квиза
   - Создать Session с expiresAt (1 час)
   - Вернуть session с информацией

3. **Создайте POST /api/sessions/:id/answers** (route)
   - Вызвать `sessionService.submitAnswer(...)`
   - Вернуть answer с score (если есть)
   - Обработать ошибки

4. **Обновите GET /api/sessions/:id** (route)
   - Загружать session со всеми answers
   - Загружать вопросы для каждого ответа
   - Проверять авторизацию (только свои сессии)

5. **Создайте POST /api/sessions/:id/submit** (route)
   - Вызвать `sessionService.submitSession(...)`
   - Вернуть completed session

**Подсказка:**

- Логика остаётся в **services**, routes — только HTTP
- SessionService использует ScoringService
- Transactions защищают критичные операции

**Проверка:** Можно создать сессию, добавить ответы через service, завершить её

---

### ✅ Checkpoint 4: Validation with Zod (20 минут)

**Цель:** Добавить валидацию для всех inputs

**Что делать:**

1. Создайте или обновите `src/utils/validation.ts`
   - AnswerSchema (questionId, userAnswer, sessionId)
   - GradeSchema (для оценивания essay)
   - QuestionSchema (для создания вопроса)
2. Добавьте валидацию в endpoints:
   - POST /api/sessions/:id/answers
   - POST /api/sessions/:id/submit
   - POST /api/admin/answers/:id/grade
   - POST /api/admin/questions
3. Возвращайте 400 с детальной ошибкой если валидация не прошла

**Подсказка:** Смотрите CHEATSHEET.md — раздел "Validation with Zod"

**Проверка:** Invalid requests возвращают 400 с ошибкой

---

### ✅ Checkpoint 5: Admin Endpoints (40 минут)

**Цель:** Реализовать admin функциональность

**Что делать:**

1. **Создайте или обновите `src/middleware/admin.ts`**
   - Middleware для проверки что пользователь — admin

2. **Обновите User model** (если нужно)
   - Добавьте поле role ("student", "admin")

3. **Создайте admin endpoints:**

   **GET /api/admin/questions**
   - Получить все вопросы с информацией
   - Включить count ответов для каждого вопроса

   **POST /api/admin/questions**
   - Создать новый вопрос
   - Валидировать данные

   **PUT /api/admin/questions/:id**
   - Обновить вопрос

   **GET /api/admin/answers/pending**
   - Получить essay ответы которые не проверены (score = null)
   - Включить информацию о student и session

   **POST /api/admin/answers/:id/grade**
   - Выставить оценку за essay
   - Использовать transaction
   - Если все ответы в сессии проверены → обновить Session score

   **GET /api/admin/students/:userId/stats**
   - Получить статистику студента
   - Среднее значение score, количество сессий

**Подсказка:** Используйте примеры из slides-speech.md (слайд 13-15)

**Проверка:** Admin endpoints работают, возвращают правильные данные

---

### ✅ Checkpoint 6: Optimization (30 минут)

**Цель:** Оптимизировать queries для performance

**Что делать:**

1. Используйте `select` вместо `include` где возможно
   - Не загружайте unnecessary поля
   - Пример: для списка сессий не нужны все answers

2. Добавьте pagination в endpoints которые возвращают много записей
   - GET /api/admin/answers/pending
   - GET /api/admin/students - если будет

3. Используйте batch operations где нужно
   - Если создаёте много вопросов — используйте createMany

4. Проверьте что индексы используются
   - Логируйте slow queries через Prisma
   - Убедитесь что есть индексы на часто используемые WHERE условия

**Подсказка:** CHEATSHEET.md — разделы "Performance" и "Batch Operations"

**Проверка:** Queries быстрые, используют индексы

---

## 🏗️ Архитектурные улучшения в LR9

### Разделение ответственности (Separation of Concerns)

В LR8 вся логика была в `routes/` — это нормально для учебного проекта. Вы учились создавать REST API.

В LR9 мы добавляем **services/** слой для бизнес-логики — это учит правильной архитектуре.

**Слои backend'а:**

| Слой            | Ответственность                    | Пример                           |
| --------------- | ---------------------------------- | -------------------------------- |
| **routes/**     | HTTP (req/res, валидация, статусы) | `POST /api/sessions/:id/submit`  |
| **services/**   | Бизнес-логика (scoring, lifecycle) | `sessionService.submitSession()` |
| **middleware/** | Аутентификация, авторизация        | `authMiddleware`, `requireAdmin` |
| **utils/**      | Вспомогательные функции, валидация | `validation.ts`, `jwt.ts`        |
| **prisma/**     | Работа с БД                        | Queries, migrations              |

**Почему так лучше:**

✅ **Тестируемость** — services не зависят от HTTP, легко писать юнит-тесты
✅ **Переиспользование** — один service можно вызвать из разных routes
✅ **Читаемость** — каждый слой делает одно, проще понять код
✅ **Масштабируемость** — когда логика растёт, она остаётся организованной

**Пример: без services (плохо)**

```typescript
// ❌ Вся логика в route handler
app.post("/api/sessions/:id/submit", async (c) => {
  const { id } = c.req.param();

  const session = await prisma.session.findUnique({
    where: { id },
    include: { answers: true },
  });

  if (!session) return c.json({ error: "Not found" }, 404);
  if (session.expiresAt < new Date()) return c.json({ error: "Expired" }, 400);

  const score = session.answers
    .filter((a) => a.score !== null)
    .reduce((sum, a) => sum + (a.score || 0), 0);

  const updated = await prisma.session.update({
    where: { id },
    data: { status: "completed", score },
  });

  return c.json({ session: updated });
});
```

**Пример: с services (хорошо)**

```typescript
// ✅ Бизнес-логика в service
class SessionService {
  async submitSession(sessionId: string) {
    return await prisma.$transaction(async (tx) => {
      const session = await tx.session.findUnique({
        where: { id: sessionId },
        include: { answers: true },
      });

      if (!session) throw new Error("Not found");
      if (session.expiresAt < new Date()) throw new Error("Expired");

      const score = this.calculateScore(session.answers);

      return await tx.session.update({
        where: { id: sessionId },
        data: { status: "completed", score },
      });
    });
  }

  private calculateScore(answers: Answer[]): number {
    return answers
      .filter((a) => a.score !== null)
      .reduce((sum, a) => sum + (a.score || 0), 0);
  }
}

// ✅ Route только HTTP
app.post("/api/sessions/:id/submit", async (c) => {
  const { id } = c.req.param();

  try {
    const session = await sessionService.submitSession(id);
    return c.json({ session });
  } catch (error) {
    return c.json({ error: error.message }, 400);
  }
});
```

**Когда использовать services:**

| Должно быть в services | Должно быть в routes  |
| ---------------------- | --------------------- |
| Scoring algorithm      | HTTP валидация (Zod)  |
| Session lifecycle      | Парсинг req.body      |
| Database transactions  | Возврат статус кодов  |
| Бизнес-правила         | Обработка HTTP ошибок |
| Вычисления             | Middleware            |

**Для простых CRUD операций — services не нужны:**

```typescript
// ✅ Простой CRUD - можно прямо в route
app.get("/api/categories", async (c) => {
  const categories = await prisma.category.findMany();
  return c.json({ categories });
});

// ❌ Не нужен CategoryService для этого
```

Services нужны когда есть:

- Сложная бизнес-логика (scoring, validation rules)
- Несколько шагов операции (transactions)
- Переиспользование логики в разных routes
- Вычисления и трансформации данных

---

## ⚡ Быстрый старт

Если вы помните как запускалась работа из LR8:

```bash
# Обновить dependencies (если нужны новые)
npm install

# Обновить Prisma schema
npx prisma migrate dev --name add-scoring-logic

# Запустить сервер
npm run dev

# Открыть Prisma Studio для просмотра данных
npx prisma studio
```

---

## 📚 Справочные материалы

Для каждого checkpoint используйте эти материалы:

- **GUIDE.md** — подробное объяснение концепций
- **CHEATSHEET.md** — готовые примеры кода
- **interactive.html** — интерактивные примеры с поиском
- **slides-speech.md** — полный текст лекции с деталями

---

## 🔍 Типичные проблемы

| Проблема                          | Решение                                                          |
| --------------------------------- | ---------------------------------------------------------------- |
| `Relation not found`              | Убедитесь что в schema добавлены @relation annotations           |
| `Unique constraint failed`        | Используйте уникальные значения или skipDuplicates в createMany  |
| `Transaction failed`              | Убедитесь что логика внутри transaction не откатывает исключения |
| `N+1 problem (медленные queries)` | Используйте include вместо цикла с отдельными queries            |
| `Prisma cache issue`              | Запустите `npx prisma generate`                                  |

---

## 📊 Критерии оценки

Для получения хороших оценок:

- ✅ Все 6 checkpoints реализованы
- ✅ Scoring functions работают правильно (с тестами)
- ✅ Endpoints валидируют входные данные
- ✅ Admin endpoints требуют авторизацию
- ✅ Используются transactions для критичных операций
- ✅ Queries оптимизированы (select, include, pagination, индексы)
- ✅ Нет ошибок в логах, валидация работает
- ✅ Код читаем, использованы TypeScript типы

---

## 📝 Дополнительная информация

### Для тех кто хочет больше:

- Добавьте Leaderboard endpoint (топ 10 студентов)
- Добавьте экспорт результатов в JSON
- Добавьте email уведомления после submission
- Добавьте логирование всех действий в отдельную таблицу
- Добавьте Rate Limiting на endpoints

### Для тех кто хочет понять deeper:

- Прочитайте про Prisma Aggregation (groupBy, \_count)
- Прочитайте про RAW SQL queries в Prisma
- Изучите различные Caching strategies
- Прочитайте про Database Connection Pooling

---

**Удачи! Вы делаете свой backend production-ready! 🚀**
