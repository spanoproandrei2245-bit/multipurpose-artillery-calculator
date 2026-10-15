import { useEffect, useState } from 'react'

import { translations } from '../i18n/translations'
import { useSync } from '../lib/syncContext'
import type { Language } from '../types/settings'

interface HeaderProps {
  language: Language
}

/** Знак приложения: перекрестие прицела. */
export function BrandMark({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path
        d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <rect x="10.75" y="10.75" width="2.5" height="2.5" fill="var(--color-accent)" />
    </svg>
  )
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    // Тик ровно на смене секунды — часы не «плавают»
    let timeout = 0
    const tick = () => {
      setNow(new Date())
      timeout = window.setTimeout(tick, 1000 - (Date.now() % 1000))
    }
    timeout = window.setTimeout(tick, 1000 - (Date.now() % 1000))
    return () => window.clearTimeout(timeout)
  }, [])
  return now
}

const pad = (value: number) => String(value).padStart(2, '0')

export function Header({ language }: HeaderProps) {
  const t = translations[language].header
  const ru = language === 'ru'
  const now = useClock()
  const sync = useSync()
  const seconds = now.getSeconds()

  return (
    <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
      <div className="flex min-w-0 items-center gap-3">
        <BrandMark className="h-7 w-7 shrink-0 text-app-text" />
        <div className="min-w-0 leading-none">
          <p className="text-[15px] font-semibold tracking-[0.18em] text-app-text">
            MAC
          </p>
          <p className="label mt-1 hidden truncate text-[9.5px] sm:block">
            {t.title}
          </p>
        </div>
      </div>

      {/* Показания: время и шкала секунд — удобно для залпа по времени */}
      <div className="ml-auto hidden items-center gap-4 md:flex">
        <span className="label">ARMA 3 · ACE3</span>
        <span
          className="mono-num text-[13px] text-app-text"
          aria-label={ru ? 'Время' : 'Time'}
        >
          {pad(now.getHours())}:{pad(now.getMinutes())}:
          <span className="text-accent">{pad(seconds)}</span>
        </span>
        <div className="flex h-3.5 items-end gap-px" aria-hidden="true">
          {Array.from({ length: 60 }, (_, i) => (
            <span
              key={i}
              className={[
                'w-[2px]',
                i % 5 === 0 ? 'h-3.5' : 'h-2',
                i <= seconds ? 'bg-accent' : 'bg-app-line-strong',
              ].join(' ')}
            />
          ))}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2 md:ml-4">
        {sync.enabled && (
          <span
            className={[
              'tag',
              sync.status === 'online'
                ? 'tag-ok'
                : sync.status === 'connecting'
                  ? 'tag-warn'
                  : '',
            ].join(' ')}
            title={ru ? 'Связка' : 'Link'}
          >
            <span
              className={[
                'h-1.5 w-1.5',
                sync.status === 'online'
                  ? 'bg-ok'
                  : sync.status === 'connecting'
                    ? 'animate-pulse bg-warn'
                    : 'bg-danger',
              ].join(' ')}
            />
            {sync.code || (ru ? 'связка' : 'link')}
          </span>
        )}
        <span className="tag tag-accent">
          {t.status} · v{__APP_VERSION__}
        </span>
      </div>
    </div>
  )
}
