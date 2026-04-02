import { FormEvent, useCallback, useEffect, useState } from 'react';

type ServerTodo = {
  id: number;
  title: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
};

type QueueAction =
  | { id: string; type: 'create'; ts: number; title: string }
  | { id: string; type: 'toggle'; ts: number; todoId: number; done: boolean }
  | { id: string; type: 'delete'; ts: number; todoId: number };

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const QUEUE_KEY = 'todo-offline-queue';

function loadQueue(): QueueAction[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as QueueAction[];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueueAction[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function toLocalText(value: string) {
  const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU');
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

async function apiFetchTodos(): Promise<ServerTodo[]> {
  const response = await fetch(`${API_BASE_URL}/api/todos`);
  const data = await parseJson<{ items: ServerTodo[] }>(response);
  return data.items;
}

async function apiCreate(title: string): Promise<ServerTodo> {
  const response = await fetch(`${API_BASE_URL}/api/todos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  return parseJson<ServerTodo>(response);
}

async function apiToggle(todoId: number, done: boolean): Promise<ServerTodo> {
  const response = await fetch(`${API_BASE_URL}/api/todos/${todoId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ done }),
  });
  return parseJson<ServerTodo>(response);
}

async function apiDelete(todoId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/todos/${todoId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

function registerServiceWorkerStarter() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => console.log('SW зарегистрирован'))
      .catch(err => console.error('SW ошибка:', err));
  }
}

export default function App() {
  const [todos, setTodos] = useState<ServerTodo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<string>('');
  const [inputValue, setInputValue] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [queueActions, setQueueActions] = useState<QueueAction[]>(loadQueue());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const refreshFromServer = useCallback(async () => {
    const serverTodos = await apiFetchTodos();
    setTodos(serverTodos);
  }, []);

  // Синхронизация очереди
  const syncQueue = useCallback(async () => {
    const queue = loadQueue();
    if (queue.length === 0) return;

    setIsSyncing(true);
    setMessage('Синхронизация...');

    const remaining: QueueAction[] = [];

    for (const action of queue) {
      try {
        if (action.type === 'create') {
          await apiCreate(action.title);
        } else if (action.type === 'toggle') {
          await apiToggle(action.todoId, action.done);
        } else if (action.type === 'delete') {
          await apiDelete(action.todoId);
        }
        // Успешно — не добавляем в remaining
      } catch {
        // Ошибка — оставляем в очереди
        remaining.push(action);
      }
    }

    saveQueue(remaining);
    setQueueActions(remaining);
    setIsSyncing(false);

    if (remaining.length === 0) {
      setMessage('Синхронизация завершена!');
      await refreshFromServer();
    } else {
      setMessage(`Не удалось синхронизировать ${remaining.length} действий.`);
    }
  }, [refreshFromServer]);

  const addToQueue = useCallback((action: QueueAction) => {
    const queue = loadQueue();
    queue.push(action);
    saveQueue(queue);
    setQueueActions([...queue]);
  }, []);

  const onCreate = useCallback(
    async (title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;

      try {
        await apiCreate(trimmed);
        await refreshFromServer();
        setMessage('Задача добавлена.');
      } catch {
        addToQueue({
          id: crypto.randomUUID(),
          type: 'create',
          ts: Date.now(),
          title: trimmed,
        });
        setMessage('Офлайн: задача добавлена в очередь.');
      }
    },
    [refreshFromServer, addToQueue]
  );

  const onToggle = useCallback(
    async (todo: ServerTodo) => {
      try {
        await apiToggle(todo.id, !todo.done);
        await refreshFromServer();
        setMessage('Статус обновлен.');
      } catch {
        addToQueue({
          id: crypto.randomUUID(),
          type: 'toggle',
          ts: Date.now(),
          todoId: todo.id,
          done: !todo.done,
        });
        setMessage('Офлайн: действие добавлено в очередь.');
      }
    },
    [refreshFromServer, addToQueue]
  );

  const onDelete = useCallback(
    async (todo: ServerTodo) => {
      try {
        await apiDelete(todo.id);
        await refreshFromServer();
        setMessage('Задача удалена.');
      } catch {
        addToQueue({
          id: crypto.randomUUID(),
          type: 'delete',
          ts: Date.now(),
          todoId: todo.id,
        });
        setMessage('Офлайн: удаление добавлено в очередь.');
      }
    },
    [refreshFromServer, addToQueue]
  );

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const value = inputValue;
      setInputValue('');
      await onCreate(value);
    },
    [inputValue, onCreate]
  );

  useEffect(() => {
    registerServiceWorkerStarter();

    let cancelled = false;

    const bootstrap = async () => {
      try {
        await refreshFromServer();
      } catch {
        if (!cancelled) {
          setMessage('Не удалось загрузить данные. Проверьте, что backend запущен.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [refreshFromServer]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setMessage('Соединение восстановлено!');
      void syncQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setMessage('Нет соединения. Работаем офлайн.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncQueue]);

  return (
    <main className="app">
      <header className="header">
        <h1>Todo-сы</h1>
        <span className={`badge ${isOnline ? 'online' : 'offline'}`}>
          {isOnline ? 'online' : 'offline'}
        </span>
      </header>

      <p className="muted">
        PWA Todo — офлайн-очередь и синхронизация реализованы.
      </p>

      <form className="toolbar" onSubmit={onSubmit}>
        <input
          type="text"
          maxLength={200}
          placeholder="Новая задача"
          required
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
        />
        <button type="submit">Добавить</button>
        <button
          type="button"
          disabled={isSyncing || queueActions.length === 0}
          onClick={() => void syncQueue()}
        >
          {isSyncing ? 'Синхронизация...' : `Синхронизировать (${queueActions.length})`}
        </button>
      </form>

      <section className="meta">
        <span className="badge">Офлайн-очередь: {queueActions.length}</span>
        <span className="badge">{isSyncing ? 'sync: идёт...' : 'sync: готов'}</span>
      </section>

      {message ? <div className="message">{message}</div> : null}
      {isLoading ? <p>Загрузка...</p> : null}
      {!isLoading && todos.length === 0 ? <div className="empty">Пока нет задач</div> : null}

      <ul className="list">
        {todos.map((todo) => (
          <li className="item" key={todo.id}>
            <button type="button" onClick={() => void onToggle(todo)}>
              {todo.done ? '✅' : '⬜'}
            </button>
            <div>
              <div className={todo.done ? 'done' : ''}>{todo.title}</div>
              <div className="hint">Сервер · {toLocalText(todo.updatedAt)}</div>
            </div>
            <button type="button" onClick={() => void onDelete(todo)}>
              Удалить
            </button>
            <span className="hint">#{todo.id}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}