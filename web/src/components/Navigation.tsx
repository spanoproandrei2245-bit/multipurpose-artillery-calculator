
export type PageId = 'dashboard' | 'models' | 'settings'

type NavigationProps = {
  activePage: PageId
  onPageChange: (page: PageId) => void
}

const pages: { id: PageId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'models', label: 'Models' },
  { id: 'settings', label: 'Settings' },
]

export function Navigation({
  activePage,
  onPageChange,
}: NavigationProps) {
  return (
    <nav className="border-b border-slate-800 bg-slate-900/50">
      <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4">
        {pages.map((page) => (
          <button
            key={page.id}
            type="button"
            onClick={() => onPageChange(page.id)}
            aria-current={activePage === page.id ? 'page' : undefined}
            className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activePage === page.id
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {page.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
