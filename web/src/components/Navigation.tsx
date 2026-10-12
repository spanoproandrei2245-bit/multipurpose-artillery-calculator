
import type { Language } from '../types/settings'
import { translations } from '../i18n/translations'

export type PageId = 'dashboard' | 'models' | 'settings'

interface NavigationProps {
  activePage: PageId
  onPageChange: (page: PageId) => void
  language: Language
}

const pages: PageId[] = [
  'dashboard',
  'models',
  'settings',
]

export function Navigation({
  activePage,
  onPageChange,
  language,
}: NavigationProps) {
  const t = translations[language].navigation

  return (
    <nav className="border-b border-app-border bg-app-surface">
      <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4">
        {pages.map((page) => {
          const isActive = activePage === page

          return (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              aria-current={isActive ? 'page' : undefined}
              className={`cursor-pointer border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-app-muted hover:text-app-text'
              }`}
            >
              {t[page]}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
