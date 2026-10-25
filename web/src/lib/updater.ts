import { isDesktop, isOverlayWindow } from './desktop'

/** Новая версия программы для ПК (GitHub Releases, подписанный установщик). */
export interface AvailableUpdate {
  version: string
  notes: string | null
  // Скачать, установить и перезапустить; onProgress — доля 0…1 (null, если размер неизвестен)
  install: (onProgress: (share: number | null) => void) => Promise<void>
}

/** Есть ли обновление. В браузере и в окне-оверлее — никогда. */
export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  if (!isDesktop || isOverlayWindow) return null
  try {
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
  } catch {
    // Нет сети или релизов — просто работаем на текущей версии
    return null
  }
}
