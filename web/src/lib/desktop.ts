import { emit, listen } from '@tauri-apps/api/event'
import {
  getCurrentWebviewWindow,
  WebviewWindow,
} from '@tauri-apps/api/webviewWindow'

import type { ArtilleryMode } from '../types/artillery'
import type { Language } from '../types/settings'

/** Приложение запущено как программа для ПК (Tauri), а не в браузере. */
export const isDesktop =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** Окно-оверлей поверх игры открывается с адресом …#overlay. */
export const isOverlayWindow =
  typeof window !== 'undefined' && window.location.hash === '#overlay'

/** Глобальные горячие клавиши (src-tauri/src/main.rs). */
export type HotkeyAction = 'fire' | 'overlay' | 'mode'

export const GLOBAL_HOTKEYS: readonly {
  keys: string
  action: HotkeyAction
}[] = [
  { keys: 'Ctrl + Alt + F', action: 'fire' },
  { keys: 'Ctrl + Alt + O', action: 'overlay' },
  { keys: 'Ctrl + Alt + M', action: 'mode' },
]

/** Что показывает оверлей. null — решения нет. */
export interface OverlaySolution {
  language: Language
  title: string
  targetName: string | null
  charge: number
  mode: ArtilleryMode
  elevation: number
  // Готовый азимут в единицах ввода; null — не введён
  azimuth: string | null
  azimuthUnit: string
  tof: number
}

/**
 * Подписка на событие Tauri. Возвращает функцию отписки, которую можно
 * вызвать и до того, как подписка успела оформиться.
 */
function subscribe<T>(event: string, handler: (payload: T) => void) {
  if (!isDesktop) return () => {}

  let cancelled = false
  let unlisten: (() => void) | null = null

  listen<T>(event, (e) => handler(e.payload))
    .then((stop) => {
      if (cancelled) stop()
      else unlisten = stop
    })
    .catch(() => {
      // Нет прав на события — работаем без них.
    })

  return () => {
    cancelled = true
    unlisten?.()
  }
}

export function onHotkey(handler: (action: HotkeyAction) => void) {
  return subscribe<HotkeyAction>('hotkey', handler)
}

export function publishSolution(solution: OverlaySolution | null) {
  if (isDesktop) void emit('solution', solution).catch(() => {})
}

export function onSolution(handler: (solution: OverlaySolution | null) => void) {
  return subscribe<OverlaySolution | null>('solution', handler)
}

/** Оверлей открылся и просит текущее решение. */
export function requestSolution() {
  if (isDesktop) void emit('overlay-ready').catch(() => {})
}

export function onSolutionRequest(handler: () => void) {
  return subscribe<null>('overlay-ready', () => handler())
}

export async function toggleOverlay() {
  if (!isDesktop) return
  try {
    const overlay = await WebviewWindow.getByLabel('overlay')
    if (!overlay) return
    if (await overlay.isVisible()) await overlay.hide()
    else await overlay.show()
  } catch {
    // Окно недоступно — ничего не делаем.
  }
}

export async function hideCurrentWindow() {
  if (!isDesktop) return
  try {
    await getCurrentWebviewWindow().hide()
  } catch {
    // Окно недоступно — ничего не делаем.
  }
}
