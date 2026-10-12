
export function Header() {
  return (
    <header className="border-b border-slate-800 bg-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:py-5">
        <div>
          <h1 className="text-base font-bold text-white sm:text-xl">
            Multipurpose Artillery Calculator
          </h1>

          <p className="mt-1 text-xs text-slate-400 sm:text-sm">
            Game Companion
          </p>
        </div>

        <span className="rounded-lg bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 sm:text-sm">
          Alpha
        </span>
      </div>
    </header>
  )
}
