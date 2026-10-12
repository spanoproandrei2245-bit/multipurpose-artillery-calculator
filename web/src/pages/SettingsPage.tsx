
import type { Language } from '../types/settings'

interface SettingsPageProps {
  language: Language
  onLanguageChange: (language: Language) => void
}

export function SettingsPage({
  language,
  onLanguageChange,
}: SettingsPageProps) {
  const isRussian = language === 'ru'

  return (
    <section>
      <h2 className="text-2xl font-bold">
        {isRussian ? 'Настройки' : 'Settings'}
      </h2>

      <p className="mt-2 text-slate-400">
        {isRussian
          ? 'Настройте приложение под себя.'
          : 'Customize your application.'}
      </p>

      <div className="mt-8 max-w-xl rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-lg font-semibold">
          {isRussian ? 'Основные настройки' : 'Preferences'}
        </h3>

        <div className="mt-6">
          <label
            htmlFor="language"
            className="mb-2 block text-sm font-medium text-slate-300"
          >
            {isRussian ? 'Язык интерфейса' : 'Interface language'}
          </label>

          <select
            id="language"
            value={language}
            onChange={(event) =>
              onLanguageChange(event.target.value as Language)
            }
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-emerald-500"
          >
            <option value="en">English</option>
            <option value="ru">Русский</option>
          </select>

          <p className="mt-3 text-sm text-slate-500">
            {isRussian
              ? 'Настройки сохраняются автоматически.'
              : 'Your preferences are saved automatically.'}
          </p>
        </div>
      </div>
    </section>
  )
}
