import { useState } from 'react'

import { ArtilleryCalculator } from '../components/ArtilleryCalculator'
import { ModelSelector } from '../components/ModelSelector'
import { ShotJournal } from '../components/ShotJournal'
import { TargetBar } from '../components/TargetBar'
import { isModelId, type ModelId } from '../data/models'
import {
  useJournal,
  type JournalDraft,
  type JournalEntry,
} from '../lib/journal'
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
  // Цель, с которой сейчас работает калькулятор (загружена или
  // только что сохранена) — её можно обновить.
  const [activeId, setActiveId] = useState<string | null>(null)

  const activeEntry =
    journal.entries.find(
      (e) => e.id === activeId && e.modelId === selectedModel
    ) ?? null

  // Ручная смена модели сбрасывает ранее загруженную запись.
  function handleModelChange(id: ModelId) {
    setLoadRequest(null)
    setActiveId(null)
    onModelChange(id)
  }

  // Загрузка записи журнала: переключаем модель и восстанавливаем вводные.
  function handleLoad(entry: JournalEntry) {
    if (!isModelId(entry.modelId)) return

    if (entry.modelId !== selectedModel) onModelChange(entry.modelId)
    setActiveId(entry.id)

    setLoadRequest((previous) => ({
      entry,
      nonce: (previous?.nonce ?? 0) + 1,
    }))
  }

  function handleSave(draft: JournalDraft) {
    setActiveId(journal.add(draft).id)
  }

  function handleUpdate(id: string, draft: JournalDraft) {
    journal.update(id, draft)
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
      <ArtilleryCalculator
        key={`${selectedModel}-${loadRequest?.nonce ?? 0}`}
        modelId={selectedModel}
        modelSelector={selector}
        targetBar={
          <TargetBar
            entries={journal.entries}
            activeId={activeEntry?.id ?? null}
            onLoad={handleLoad}
            language={language}
          />
        }
        language={language}
        initial={initial}
        gridInput={gridInput}
        activeEntry={activeEntry}
        onSave={handleSave}
        onUpdate={handleUpdate}
      />

      <ShotJournal
        entries={journal.entries}
        language={language}
        activeId={activeEntry?.id ?? null}
        onLoad={handleLoad}
        onRename={journal.rename}
        onRemove={journal.remove}
        onClearDay={journal.clearDay}
      />
    </section>
  )
}
