import { LogicalSize } from '@tauri-apps/api/dpi'
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
export type HotkeyAction =
  | 'fire'
  | 'overlay'
  | 'input'
  | 'mode'
  | 'next-target'
  | 'previous-target'

export const GLOBAL_HOTKEYS: readonly {
  keys: string
  action: HotkeyAction
}[] = [
  { keys: 'Ctrl + Alt + F', action: 'fire' },
  { keys: 'Ctrl + Alt + O', action: 'overlay' },
  { keys: 'Ctrl + Alt + D', action: 'input' },
  { keys: 'Ctrl + Alt + M', action: 'mode' },
  { keys: 'Ctrl + Alt + N', action: 'next-target' },
  { keys: 'Ctrl + Alt + P', action: 'previous-target' },
]

/** Готовые установки для орудия. */
export interface FiringSolution {
  charge: number
  mode: ArtilleryMode
  elevation: number
  // Готовый азимут в единицах ввода; null — не введён
  azimuth: string | null
  azimuthUnit: string
  tof: number
}

/** Поля ввода, которые можно менять из оверлея. */
export type OverlayField = 'distance' | 'azimuth' | 'ownHeight' | 'targetHeight'

/** Что показывает оверлей: вводные основного окна и решение. */
export interface OverlayState {
  language: Language
  title: string
  targetName: string | null
  mode: ArtilleryMode
  // Режимы, для которых есть таблицы
  modes: ArtilleryMode[]
  // Заряды, которыми можно достать цель
  charges: number[]
  // «мил» или «°» — единицы поля азимута
  azimuthUnit: string
  fields: Record<OverlayField, string>
  // Сумма поправок корректировки, м, и число докладов
  adjust: { range: number; lateral: number; count: number }
  // null — решения нет
  solution: FiringSolution | null
}

/** Команда из оверлея в основное окно. */
export type OverlayCommand =
  | { type: 'field'; field: OverlayField; value: string }
  | { type: 'charge'; charge: number }
  | { type: 'mode' }
  // Доклад по линии орудия: > 0 — перелёт / правее цели, м
  | { type: 'spot'; over: number; right: number }
  | { type: 'undo-adjust' }

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

export function publishSolution(state: OverlayState) {
  if (isDesktop) void emit('solution', state).catch(() => {})
}

export function onSolution(handler: (state: OverlayState) => void) {
  return subscribe<OverlayState>('solution', handler)
}

export function sendOverlayCommand(command: OverlayCommand) {
  if (isDesktop) void emit('overlay-command', command).catch(() => {})
}

export function onOverlayCommand(handler: (command: OverlayCommand) => void) {
  return subscribe<OverlayCommand>('overlay-command', handler)
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

/** Показать оверлей поверх игры и забрать фокус клавиатуры. */
export async function focusCurrentWindow() {
  if (!isDesktop) return
  try {
    const current = getCurrentWebviewWindow()
    await current.show()
    await current.setFocus()
  } catch {
    // Окно недоступно — ничего не делаем.
  }
}

/** Размер окна под содержимое (оверлей раскрывает панель ввода). */
export async function resizeCurrentWindow(width: number, height: number) {
  if (!isDesktop) return
  try {
    await getCurrentWebviewWindow().setSize(new LogicalSize(width, height))
  } catch {
    // Нет прав или окно недоступно — остаётся прежний размер.
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
