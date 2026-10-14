import { useEffect } from 'react'

export const wakeLockSupported =
  typeof navigator !== 'undefined' && 'wakeLock' in navigator

/**
 * Не давать экрану гаснуть, пока active = true.
 * Браузер снимает блокировку, когда вкладка скрыта, — при возврате
 * она запрашивается заново.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !wakeLockSupported) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    async function request() {
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) {
          void lock.release()
          return
        }
        sentinel = lock
      } catch {
        // Отказ (энергосбережение, нет жеста пользователя) — не критично.
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') void request()
    }

    void request()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      void sentinel?.release()
    }
  }, [active])
}
