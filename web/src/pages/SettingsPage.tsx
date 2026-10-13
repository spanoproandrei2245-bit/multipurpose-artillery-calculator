import type { ReactNode } from 'react'

import type { Language, Theme } from '../types/settings'
import { translations } from '../i18n/translations'
import { wakeLockSupported } from '../lib/useWakeLock'

interface SettingsPageProps {
  language: Language
  onLanguageChange: (language: Language) => void
  theme: Theme
  onThemeChange: (theme: Theme) => void
  gridInput: boolean
  onGridInputChange: (value: boolean) => void
  keepAwake: boolean
  onKeepAwakeChange: (value: boolean) => void
}

const selectClass =
  'w-full rounded-lg border border-app-border bg-app-bg px-4 py-3 text-app-text outline-none focus:border-emerald-500'

function Card({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-6">
      <h3 className="text-lg font-semibold text-app-text">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-app-muted">{description}</p>
      )}
      {children}
    </div>
  )
}

export function SettingsPage({
  language,
  onLanguageChange,
  theme,
  onThemeChange,
  gridInput,
  onGridInputChange,
  keepAwake,
  onKeepAwakeChange,
}: SettingsPageProps) {
  const t = translations[language].settings

  return (
    <section className="max-w-xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-app-text">{t.title}</h2>
        <p className="mt-2 text-app-muted">{t.description}</p>
      </div>

      <Card title={t.preferences}>
        <div className="mt-6">
          <label
            htmlFor="language"
            className="mb-2 block text-sm font-medium text-app-muted"
          >
            {t.language}
          </label>

          <select
            id="language"
            value={language}
            onChange={(event) =>
              onLanguageChange(event.target.value as Language)
            }
            className={selectClass}
          >
            <option value="en">English</option>
            <option value="ru">Русский</option>
          </select>
        </div>

        <div className="mt-6">
          <label
            htmlFor="theme"
            className="mb-2 block text-sm font-medium text-app-muted"
          >
            {t.theme}
          </label>

          <select
            id="theme"
            value={theme}
            onChange={(event) => onThemeChange(event.target.value as Theme)}
            className={selectClass}
          >
            <option value="light">{t.light}</option>
            <option value="dark">{t.dark}</option>
          </select>
        </div>

        <label className="mt-6 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={keepAwake}
            disabled={!wakeLockSupported}
            onChange={(event) => onKeepAwakeChange(event.target.checked)}
            className="mt-1 h-4 w-4 accent-emerald-600"
          />
          <span>
            <span className="block text-sm font-medium text-app-text">
              {t.keepAwake}
            </span>
            <span className="block text-xs text-app-muted">
              {wakeLockSupported ? t.keepAwakeDescription : t.keepAwakeUnsupported}
            </span>
          </span>
        </label>

        <p className="mt-6 text-sm text-app-muted">{t.autoSave}</p>
      </Card>

      <Card title={t.experimental} description={t.experimentalDescription}>
        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={gridInput}
            onChange={(event) => onGridInputChange(event.target.checked)}
            className="mt-1 h-4 w-4 accent-emerald-600"
          />
          <span>
            <span className="block text-sm font-medium text-app-text">
              {t.gridInput}
            </span>
            <span className="block text-xs text-app-muted">
              {t.gridInputDescription}
            </span>
          </span>
        </label>
      </Card>

      <p className="text-xs text-app-muted">
        Multipurpose Artillery Calculator v{__APP_VERSION__} · made by Heis
      </p>
    </section>
  )
}
