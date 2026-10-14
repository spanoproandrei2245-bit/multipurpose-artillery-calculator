
import type { Language } from '../types/settings'
import { translations } from '../i18n/translations'

interface HeaderProps {
  language: Language
}

export function Header({ language }: HeaderProps) {
  const t = translations[language].header

  return (
    <header className="border-b border-app-border bg-app-surface">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:py-5">
        <div>
          <h1 className="text-base font-bold text-app-text sm:text-xl">
            {t.title}
          </h1>

          <p className="mt-1 text-xs text-app-muted sm:text-sm">
            {t.subtitle}
          </p>
        </div>

        <span className="rounded-lg bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 sm:text-sm">
          {t.status} · v{__APP_VERSION__}
        </span>
      </div>
    </header>
  )
}
