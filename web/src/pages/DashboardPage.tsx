import { useState } from 'react'

import { ArtilleryCalculator } from '../components/ArtilleryCalculator'
import { ArtilleryReferencePanel } from '../components/ArtilleryReferencePanel'
import { ModelSelector } from '../components/ModelSelector'
import { ShotJournal } from '../components/ShotJournal'
import { artilleryRegistry } from '../data/artillery/registry'
import { isModelId, type ModelId } from '../data/models'
import { useJournal, type JournalEntry } from '../lib/journal'
import type { Language } from '../types/settings'

interface DashboardPageProps {
  selectedModel: ModelId
  onModelChange: (model: ModelId) => void
  language: Language
  gridInput: boolean
}

interface LoadRequest {
  entry: JournalEntry
  nonce: number
}

export function DashboardPage({
  selectedModel,
  onModelChange,
  language,
  gridInput,
}: DashboardPageProps) {

  const journal = useJournal()
  const [loadRequest, setLoadRequest] = useState<LoadRequest | null>(
    null
  )

  const hasTables =
    artilleryRegistry[selectedModel].profiles !== undefined

  // Ручная смена модели сбрасывает ранее загруженную запись.
  function handleModelChange(id: ModelId) {
    setLoadRequest(null)
    onModelChange(id)
  }

  // Загрузка записи журнала: переключаем модель и восстанавливаем вводные.
  function handleLoad(entry: JournalEntry) {
    if (!isModelId(entry.modelId)) return

    if (entry.modelId !== selectedModel) onModelChange(entry.modelId)

    setLoadRequest((previous) => ({
      entry,
      nonce: (previous?.nonce ?? 0) + 1,
    }))
  }

  const initial =
    loadRequest && loadRequest.entry.modelId === selectedModel
      ? loadRequest.entry
      : null

  const selector = (
    <ModelSelector
      value={selectedModel}
      onChange={handleModelChange}
      language={language}
    />
  )

  return (
    <section>
      {hasTables ? (
        <ArtilleryCalculator
          modelSelector={selector}
          key={`${selectedModel}-${loadRequest?.nonce ?? 0}`}
          modelId={selectedModel}
          language={language}
          initial={initial}
          gridInput={gridInput}
          onSave={journal.add}
        />
      ) : (
        <>
        <div className="max-w-xl">{selector}</div>
        <ArtilleryReferencePanel
          modelId={selectedModel}
          language={language}
        />
        </>
      )}

      <ShotJournal
        entries={journal.entries}
        language={language}
        onLoad={handleLoad}
        onRename={journal.rename}
        onRemove={journal.remove}
        onClearDay={journal.clearDay}
      />
    </section>
  )
}
