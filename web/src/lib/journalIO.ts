import { exportJournal, parseJournalFile, type JournalEntry } from './journal'

/** Скачать журнал целей файлом. */
export function downloadJournal(entries: readonly JournalEntry[]) {
  const date = new Date().toISOString().slice(0, 10)
  const blob = new Blob([exportJournal(entries)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `artillery-journal-${date}.json`
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Прочитать файл журнала и добавить цели; возвращает сообщение для
 * пользователя («Добавлено: 3. Уже были: 1.»).
 */
export async function importJournalFile(
  file: File,
  onImport: (entries: JournalEntry[]) => { added: number; skipped: number },
  ru: boolean
): Promise<string> {
  return describeImport(await file.text(), onImport, ru)
}

/** То же по тексту файла (отдельно — чтобы проверять без File). */
export function describeImport(
  text: string,
  onImport: (entries: JournalEntry[]) => { added: number; skipped: number },
  ru: boolean
): string {
  const parsed = parseJournalFile(text)
  if (parsed === null) {
    return ru
      ? 'Файл не похож на журнал калькулятора.'
      : 'This file is not a calculator journal.'
  }
  const { added, skipped } = onImport(parsed.entries)
  return ru
    ? `Добавлено: ${added}. Уже были: ${skipped}.${parsed.invalid > 0 ? ` Повреждённых: ${parsed.invalid}.` : ''}`
    : `Added: ${added}. Already present: ${skipped}.${parsed.invalid > 0 ? ` Damaged: ${parsed.invalid}.` : ''}`
}

/** Действия над журналом, которые панель целей на карте вызывает сама. */
export interface JournalActions {
  exportAll: () => void
  // Импорт файла; результат — сообщение пользователю
  importFile: (file: File) => Promise<string>
  rename: (id: string, name: string) => void
  remove: (id: string) => void
}
