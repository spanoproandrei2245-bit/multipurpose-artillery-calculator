
export function Header() {
  return (
    <header className="border-b border-slate-800 bg-slate-900">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <div>
          <h1 className="text-xl font-bold text-white">
            Multipurpose Artillery Calculator
          </h1>

          <p className="mt-1 text-sm text-slate-400">
            Game Companion
          </p>
        </div>

        <span className="rounded-lg bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
          Alpha
        </span>
      </div>
    </header>
  )
}
