
import { models, type ModelId } from '../data/models'
import { translations } from '../i18n/translations'
import type { Language } from '../types/settings'

interface ModelSelectorProps {
  value: ModelId
  onChange: (value: ModelId) => void
  language: Language
}

const modelIds = Object.keys(models) as ModelId[]

export function ModelSelector({
  value,
  onChange,
  language,
}: ModelSelectorProps) {
  const t = translations[language].modelSelector

  return (
    <div>
      <label
        htmlFor="model"
        className="mb-2 block text-sm font-medium text-slate-300"
      >
        {t.label}
      </label>

      <select
        id="model"
        value={value}
        onChange={(event) =>
          onChange(event.target.value as ModelId)
        }
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-emerald-500"
      >
        {modelIds.map((id) => (
          <option key={id} value={id}>
            {models[id].name}
          </option>
        ))}
      </select>
    </div>
  )
}
