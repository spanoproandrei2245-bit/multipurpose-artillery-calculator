import { t } from '../i18n'
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
  onImport: (entries: JournalEntry[]) => { added: number; skipped: number }
): Promise<string> {
  return describeImport(await file.text(), onImport)
}

/** То же по тексту файла (отдельно — чтобы проверять без File). */
export function describeImport(
  text: string,
  onImport: (entries: JournalEntry[]) => { added: number; skipped: number }
): string {
  const parsed = parseJournalFile(text)
  if (parsed === null) {
    return t('journalIO.this-file-is-not-a')
  }
  const { added, skipped } = onImport(parsed.entries)
  return (
    t('journalIO.added-already-present', added, skipped) +
    (parsed.invalid > 0 ? ' ' + t('journalIO.damaged', parsed.invalid) : '')
  )
}

/** Действия над журналом, которые панель целей на карте вызывает сама. */
export interface JournalActions {
  exportAll: () => void
  // Импорт файла; результат — сообщение пользователю
  importFile: (file: File) => Promise<string>
  rename: (id: string, name: string) => void
  remove: (id: string) => void
}
