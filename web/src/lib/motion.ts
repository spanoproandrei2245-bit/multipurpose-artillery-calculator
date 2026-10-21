import { useSyncExternalStore } from 'react'

/**
 * Анимации интерфейса по видам, каждый включается отдельно в настройках:
 *   numbers  — «прокрутка» чисел расчёта и их короткая вспышка;
 *   switches — скользящая «таблетка» у переключателей;
 *   appear   — появление окон, плашек и карточек;
 *   smooth   — плавные переходы: наведение, смена выбора, раскрытие;
 *   fire     — отдача при нажатии «Огонь» и вспышка у орудия;
 *   impact   — подсветка и «прыжок» таймера, когда снаряд прилетел.
 * Переезд обучения и круг при смене темы встроены и всегда включены.
 * По умолчанию всё включено, если в системе не выбрано «уменьшить движение».
 * Выбор отмечается на <html> (data-m-<вид>), по нему CSS гасит анимации.
 */
export type MotionKind =
  | 'numbers'
  | 'switches'
  | 'appear'
  | 'smooth'
  | 'fire'
  | 'impact'

export const MOTION_KINDS: readonly MotionKind[] = [
  'numbers',
  'switches',
  'appear',
  'smooth',
  'fire',
  'impact',
]

const listeners = new Set<() => void>()
const memory: Partial<Record<MotionKind, boolean>> = {}

const storageKey = (kind: MotionKind) => `motion:${kind}`

function systemReduced(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function read(kind: MotionKind): boolean {
  try {
    const value = localStorage.getItem(storageKey(kind))
    if (value === 'on') return true
    if (value === 'off') return false
  } catch {
    // Хранилище недоступно — берём системную настройку
  }
  return !systemReduced()
}

export function getMotion(kind: MotionKind): boolean {
  return memory[kind] ?? read(kind)
}

/** Отметить выбор на <html>: CSS по нему отключает анимации. */
export function applyMotion() {
  if (typeof document === 'undefined') return
  for (const kind of MOTION_KINDS) {
    document.documentElement.setAttribute(
      `data-m-${kind}`,
      getMotion(kind) ? 'on' : 'off'
    )
  }
}

export function setMotion(kind: MotionKind, value: boolean) {
  memory[kind] = value
  try {
    localStorage.setItem(storageKey(kind), value ? 'on' : 'off')
  } catch {
    // Настройка живёт до перезагрузки.
  }
  applyMotion()
  listeners.forEach((listener) => listener())
}

export function useMotion(kind: MotionKind): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => getMotion(kind),
    () => true
  )
}
