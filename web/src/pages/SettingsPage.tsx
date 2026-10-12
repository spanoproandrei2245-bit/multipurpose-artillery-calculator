
import type { Language, Theme } from '../types/settings'
import { translations } from '../i18n/translations'

interface SettingsPageProps {
  language: Language
  onLanguageChange: (language: Language) => void
  theme: Theme
  onThemeChange: (theme: Theme) => void
}

export function SettingsPage({
  language,
  onLanguageChange,
  theme,
  onThemeChange,
}: SettingsPageProps) {
  const t = translations[language].settings

  return (
    <section>
      <h2 className="text-2xl font-bold">
        {t.title}
      </h2>

      <p className="mt-2 text-slate-500 dark:text-slate-400">
        {t.description}
      </p>

      <div className="mt-8 max-w-xl rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-lg font-semibold">
          {t.preferences}
        </h3>

        {/* Настройка языка */}
        <div className="mt-6">
          <label
            htmlFor="language"
            className="mb-2 block text-sm font-medium"
          >
            {t.language}
          </label>

          <select
            id="language"
            value={language}
            onChange={(event) =>
              onLanguageChange(event.target.value as Language)
            }
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="en">English</option>
            <option value="ru">Русский</option>
          </select>
        </div>

        {/* НОВОЕ: Настройка темы */}
        <div className="mt-6">
          <label
            htmlFor="theme"
            className="mb-2 block text-sm font-medium"
          >
            {t.theme}
          </label>

          <select
            id="theme"
            value={theme}
            onChange={(event) =>
              onThemeChange(event.target.value as Theme)
            }
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="light">{t.light}</option>
            <option value="dark">{t.dark}</option>
          </select>
        </div>

        <p className="mt-6 text-sm text-slate-500">
          {t.autoSave}
        </p>
      </div>
    </section>
  )
}
