
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
    <nav className="border-b border-slate-800 bg-slate-900/50">
      <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4">
        {pages.map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            aria-current={
              activePage === page ? 'page' : undefined
            }
            className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activePage === page
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {t[page]}
          </button>
        ))}
      </div>
    </nav>
  )
}
