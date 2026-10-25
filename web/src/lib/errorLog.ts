/**
 * Журнал ошибок на устройстве: последние сбои с версией и стеком. Никуда не
 * отправляется — пользователь сам копирует отчёт или открывает issue.
 */

export interface ErrorEntry {
  time: string
  area: string
  message: string
  stack?: string
  componentStack?: string
}

const KEY = 'errorLog'
const MAX = 10

export function readErrors(): ErrorEntry[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    return Array.isArray(value) ? (value as ErrorEntry[]) : []
  } catch {
    return []
  }
}

export function recordError(area: string, error: unknown, componentStack?: string): ErrorEntry {
  const e = error instanceof Error ? error : new Error(String(error))
  const entry: ErrorEntry = {
    time: new Date().toISOString(),
    area,
    message: e.message.slice(0, 500),
    stack: e.stack?.slice(0, 4000),
    componentStack: componentStack?.slice(0, 2000),
  }
  try {
    localStorage.setItem(KEY, JSON.stringify([...readErrors(), entry].slice(-MAX)))
  } catch {
    // Хранилище недоступно — отчёт всё равно можно скопировать с экрана ошибки.
  }
  return entry
}

/** Текст отчёта для копирования или issue. */
export function errorReport(entry: ErrorEntry): string {
  return [
    `Version: ${typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '?'}`,
    `Time: ${entry.time}`,
    `Area: ${entry.area}`,
    `URL: ${location.pathname}${location.search}`,
    `Browser: ${navigator.userAgent}`,
    '',
    entry.message,
    '',
    entry.stack ?? '',
    entry.componentStack ? `\nComponents:${entry.componentStack}` : '',
  ].join('\n')
}

/** Ошибки вне React (обработчики событий, промисы) тоже попадают в журнал. */
export function installGlobalErrorLog() {
  window.addEventListener('error', (event) => {
    recordError('window', event.error ?? event.message)
  })
  window.addEventListener('unhandledrejection', (event) => {
    recordError('promise', event.reason)
  })
}
