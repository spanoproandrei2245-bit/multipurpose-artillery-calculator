import { useSyncExternalStore } from 'react'

import { isDesktop, isOverlayWindow } from './desktop'

/** Новая версия программы для ПК (GitHub Releases, подписанный установщик). */
export interface AvailableUpdate {
  version: string
  notes: string | null
  // Скачать, установить и перезапустить; onProgress — доля 0…1 (null, если размер неизвестен)
  install: (onProgress: (share: number | null) => void) => Promise<void>
}

/**
 * Есть ли обновление. В браузере и в окне-оверлее — никогда. Ошибки (нет
 * сети, нет доступа) не глотаются: их показывает «О программе».
 */
export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  if (!isDesktop || isOverlayWindow) return null
  const { check } = await import('@tauri-apps/plugin-updater')
  const update = await check()
  if (!update) return null
  return {
    version: update.version,
    notes: update.body ?? null,
    install: async (onProgress) => {
      let total = 0
      let done = 0
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') total = event.data.contentLength ?? 0
        if (event.event === 'Progress') {
          done += event.data.chunkLength
          onProgress(total > 0 ? Math.min(1, done / total) : null)
        }
      })
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await relaunch()
    },
  }
}

export type UpdateStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'latest' }
  | { kind: 'available'; update: AvailableUpdate }
  | { kind: 'error'; message: string }

let status: UpdateStatus = { kind: 'idle' }
let lastCheck = 0
const listeners = new Set<() => void>()

function setStatus(next: UpdateStatus) {
  status = next
  listeners.forEach((listener) => listener())
}

/** Состояние проверки обновлений: плашка и «О программе». */
export function useUpdateStatus(): UpdateStatus {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => status
  )
}

/** Проверить сейчас. Найденное обновление не перепроверяется: плашка уже есть. */
export async function runUpdateCheck(): Promise<void> {
  if (!isDesktop || isOverlayWindow) return
  if (status.kind === 'checking' || status.kind === 'available') return
  lastCheck = Date.now()
  setStatus({ kind: 'checking' })
  try {
    const update = await checkForUpdate()
    setStatus(update ? { kind: 'available', update } : { kind: 'latest' })
  } catch (error) {
    setStatus({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}

// Программа может работать часами: новая версия ищется и во время работы
const INTERVAL = 30 * 60 * 1000

/**
 * Проверки: через несколько секунд после запуска (не мешать старту), потом
 * раз в полчаса, при возврате к окну (если давно не проверяли) и при
 * повторном запуске программы (он открывает уже работающее окно).
 */
export function startUpdateChecks(): () => void {
  if (!isDesktop || isOverlayWindow) return () => {}
  const first = window.setTimeout(() => void runUpdateCheck(), 4000)
  const timer = window.setInterval(() => void runUpdateCheck(), INTERVAL)
  const onFocus = () => {
    if (Date.now() - lastCheck > INTERVAL) void runUpdateCheck()
  }
  window.addEventListener('focus', onFocus)
  let unlisten: (() => void) | null = null
  let stopped = false
  void import('@tauri-apps/api/event').then(({ listen }) =>
    listen('second-instance', () => void runUpdateCheck()).then((stop) => {
      if (stopped) stop()
      else unlisten = stop
    })
  )
  return () => {
    stopped = true
    window.clearTimeout(first)
    window.clearInterval(timer)
    window.removeEventListener('focus', onFocus)
    unlisten?.()
  }
}
