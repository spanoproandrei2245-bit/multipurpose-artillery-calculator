import { useEffect, useRef, useState } from 'react'

interface Props {
  // null — значения нет, показывается «—»
  value: number | null
  // Как показать число (по умолчанию — целое)
  format?: (value: number) => string
  // Скачок больше этого — без прокрутки (азимут через 0 не «мотается»)
  maxTween?: number
  className?: string
  duration?: number
}

const reduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Число, которое плавно «докручивается» до нового значения и коротко
 * вспыхивает при смене — видно, что расчёт обновился.
 */
export function AnimatedNumber({
  value,
  format = (v) => String(Math.round(v)),
  maxTween = Number.POSITIVE_INFINITY,
  className = '',
  duration = 320,
}: Props) {
  const [shown, setShown] = useState<number | null>(value)
  const [pulse, setPulse] = useState(0)
  const shownRef = useRef<number | null>(value)

  useEffect(() => {
    const from = shownRef.current
    if (value === null || from === null || reduced() || Math.abs(value - from) > maxTween) {
      shownRef.current = value
      const frame = requestAnimationFrame(() => {
        setShown(value)
        if (value !== null && value !== from) setPulse((n) => n + 1)
      })
      return () => cancelAnimationFrame(frame)
    }
    if (value === from) return
    const start = performance.now()
    let frame = 0
    const tick = () => {
      // Свои часы, а не метка rAF: так не зависит от окружения
      const t = Math.min(1, Math.max(0, (performance.now() - start) / duration))
      const eased = 1 - Math.pow(1 - t, 3)
      const current = from + (value - from) * eased
      shownRef.current = current
      setShown(current)
      if (t < 1) frame = requestAnimationFrame(tick)
      else setPulse((n) => n + 1)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, maxTween, duration])

  return (
    <span key={pulse} className={`${pulse > 0 ? 'num-pop' : ''} ${className}`}>
      {shown === null ? '—' : format(shown)}
    </span>
  )
}
