
import { models } from '../data/models'

export function ModelsPage() {
  return (
    <section>
      <h2 className="text-2xl font-bold">Game Models</h2>

      <p className="mt-2 text-slate-400">
        Browse supported game models.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(models).map(([id, model]) => (
          <article
            key={id}
            className="rounded-xl border border-slate-800 bg-slate-900 p-6"
          >
            <h3 className="text-xl font-semibold">
              {model.name}
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              {model.mod}
            </p>

            <p className="mt-4 text-sm text-slate-300">
              Modes: {model.modes.join(', ')}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Source: {model.source}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
