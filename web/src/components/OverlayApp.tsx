import { useEffect, useRef, useState } from 'react'

import {
  hideCurrentWindow,
  onHotkey,
  onSolution,
  requestSolution,
  type OverlaySolution,
} from '../lib/desktop'

// Предупреждение «сплэш» за столько секунд до разрыва (как в FireTimer)
const SPLASH_WARNING_S = 5
const IMPACT_HOLD_MS = 4000

interface Shot {
  firedAt: number
  tof: number
}

/**
 * Окно поверх игры: возвышение, азимут, заряд и отсчёт до разрыва.
 * Данные приходят из основного окна, огонь — по глобальной клавише.
 * Звук подаёт основное окно, здесь только отсчёт.
 */
export function OverlayApp() {
  const [solution, setSolution] = useState<OverlaySolution | null>(null)
  const [shot, setShot] = useState<Shot | null>(null)
  const [now, setNow] = useState(() => Date.now())
  // Последнее решение для обработчика клавиши «огонь»
  const solutionRef = useRef<OverlaySolution | null>(null)

  useEffect(() => {
    const stop = onSolution((next) => {
      solutionRef.current = next
      setSolution(next)
    })
    requestSolution()
    return stop
  }, [])

  useEffect(
    () =>
      onHotkey((action) => {
        const current = solutionRef.current
        if (action !== 'fire' || !current) return
        const firedAt = Date.now()
        setNow(firedAt)
        setShot({ firedAt, tof: current.tof })
      }),
    []
  )

  useEffect(() => {
    if (!shot) return
    const interval = window.setInterval(() => {
      const current = Date.now()
      if (current - shot.firedAt > shot.tof * 1000 + IMPACT_HOLD_MS) {
        setShot(null)
        return
      }
      setNow(current)
    }, 100)
    return () => window.clearInterval(interval)
  }, [shot])

  const ru = (solution?.language ?? 'ru') === 'ru'
  const left = shot ? shot.tof - (now - shot.firedAt) / 1000 : null

  return (
    <div
      data-tauri-drag-region
      className="flex h-screen select-none flex-col rounded-xl border border-white/10 bg-slate-950/80 p-3 text-white"
    >
      <div data-tauri-drag-region className="flex items-start gap-2">
        <p
          data-tauri-drag-region
          className="min-w-0 flex-1 truncate text-sm font-semibold"
        >
          {solution
            ? (solution.targetName ?? solution.title)
            : ru
              ? 'Нет решения'
              : 'No solution'}
        </p>
        <button
          type="button"
          onClick={() => void hideCurrentWindow()}
          aria-label={ru ? 'Скрыть оверлей' : 'Hide overlay'}
          className="cursor-pointer rounded px-1.5 text-white/60 hover:bg-white/10 hover:text-white"
        >
          ×
        </button>
      </div>

      {solution ? (
        <div
          data-tauri-drag-region
          className="mt-1 grid flex-1 grid-cols-2 content-center gap-x-4 gap-y-1"
        >
          <div data-tauri-drag-region>
            <p className="text-xs text-white/60">
              {ru ? 'Возвышение, мил' : 'Elevation, mil'}
            </p>
            <p className="text-4xl font-bold leading-tight tabular-nums">
              {Math.round(solution.elevation)}
            </p>
          </div>
          <div data-tauri-drag-region>
            <p className="text-xs text-white/60">
              {ru ? 'Азимут' : 'Azimuth'}
              {solution.azimuth !== null && `, ${solution.azimuthUnit}`}
            </p>
            <p className="text-4xl font-bold leading-tight tabular-nums">
              {solution.azimuth ?? '—'}
            </p>
          </div>
          <p className="text-sm text-white/80">
            {ru ? 'Заряд' : 'Charge'} {solution.charge}
            {solution.mode === 'LOW' && (
              <span className="ml-1 text-amber-300">LOW</span>
            )}
          </p>
          <p className="text-sm text-white/80 tabular-nums">
            {ru ? 'Полёт' : 'Flight'} {solution.tof.toFixed(1)}{' '}
            {ru ? 'с' : 's'}
          </p>
        </div>
      ) : (
        <p
          data-tauri-drag-region
          className="flex flex-1 items-center text-sm text-white/60"
        >
          {ru
            ? 'Введите дистанцию в основном окне.'
            : 'Enter a distance in the main window.'}
        </p>
      )}

      {left !== null && shot && (
        <div className="mt-1">
          <p
            className={[
              'text-sm font-semibold tabular-nums',
              left <= SPLASH_WARNING_S ? 'text-red-400' : 'text-white',
            ].join(' ')}
          >
            {left <= 0
              ? ru
                ? 'Разрыв!'
                : 'Impact!'
              : `${ru ? 'До разрыва' : 'Impact in'} ${left.toFixed(1)} ${ru ? 'с' : 's'}`}
          </p>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className={
                left <= SPLASH_WARNING_S
                  ? 'h-full bg-red-500'
                  : 'h-full bg-emerald-500'
              }
              style={{
                width: `${Math.min(100, Math.max(0, (1 - left / shot.tof) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}

      <p data-tauri-drag-region className="mt-1 text-[10px] text-white/40">
        Ctrl+Alt+F — {ru ? 'огонь' : 'fire'} · Ctrl+Alt+O —{' '}
        {ru ? 'скрыть' : 'hide'} · Ctrl+Alt+M — HIGH/LOW · Ctrl+Alt+N/P —{' '}
        {ru ? 'цели' : 'targets'}
      </p>
    </div>
  )
}
