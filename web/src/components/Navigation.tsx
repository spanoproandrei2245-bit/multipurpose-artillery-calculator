import type { Language } from '../types/settings'
import { translations } from '../i18n/translations'

export type PageId = 'dashboard' | 'sync' | 'models' | 'settings'

interface NavigationProps {
  activePage: PageId
  onPageChange: (page: PageId) => void
  language: Language
}

const pages: PageId[] = ['dashboard', 'sync', 'models', 'settings']

export function Navigation({
  activePage,
  onPageChange,
  language,
}: NavigationProps) {
  const t = translations[language].navigation

  return (
    <nav className="border-t border-app-border">
      <div className="mx-auto flex max-w-6xl overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {pages.map((page, index) => {
          const isActive = activePage === page

          return (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              aria-current={isActive ? 'page' : undefined}
              className={[
                'group relative flex shrink-0 cursor-pointer items-baseline gap-2 px-3 py-3 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors first:pl-0',
                isActive
                  ? 'text-app-text'
                  : 'text-app-muted hover:text-app-text',
              ].join(' ')}
            >
              <span
                className={
                  isActive ? 'text-accent' : 'text-app-faint group-hover:text-accent'
                }
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              {t[page]}
              <span
                className={[
                  'absolute inset-x-3 -bottom-px h-px group-first:left-0',
                  isActive ? 'bg-accent' : 'bg-transparent',
                ].join(' ')}
              />
            </button>
          )
        })}
      </div>
    </nav>
  )
}
