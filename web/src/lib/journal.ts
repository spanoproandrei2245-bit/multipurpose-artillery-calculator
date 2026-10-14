import { useState } from 'react'

import type { ArtilleryMode } from '../types/artillery'

const STORAGE_KEY = 'artilleryJournal'

export type AngleUnit = 'mil' | 'deg'
export type WindMode = 'vector' | 'components'

/** Погодные вводные (как ввёл пользователь). */
export interface JournalWeather {
  windMode: WindMode
  // Режим vector: скорость, м/с, и откуда дует, °
  windSpeed: number | null
  windFrom: number | null
  // Режим components: встречный (+) / попутный (−) и боковой
  // справа (+) / слева (−), м/с
  headwind: number | null
  crosswind: number | null
  temperature: number | null // °C
  pressure: number | null // гПа
}

/**
 * Запись журнала: сохранённые вводные и результат на момент сохранения.
 * Запись относится к календарному дню (dayKey), когда она создана.
 */
export interface JournalEntry {
  id: string
  name: string

  createdAt: string // ISO-время создания
  dayKey: string // YYYY-MM-DD, локальная дата создания

  modelId: string
  ammoId: string
  charge: number

  distance: number
  ownHeight: number | null
  targetHeight: number | null
  rangeCorrection: number

  // Снимок результата
  elevation: number
  tof: number

  // Поля v0.7, в старых записях отсутствуют.
  // Азимут на цель и азимут с поправкой на ветер — в единицах azimuthUnit.
  azimuth?: number | null
  azimuthUnit?: AngleUnit
  firingAzimuth?: number | null
  weather?: JournalWeather | null

  // Поле v0.8: боковая поправка, м (> 0 — вправо)
  lateralCorrection?: number

  // Поле v0.10: режим таблицы; нет — HIGH
  mode?: ArtilleryMode
}

export type JournalDraft = Omit<
  JournalEntry,
  'id' | 'createdAt' | 'dayKey'
>

export interface JournalDay {
  dayKey: string
  entries: JournalEntry[]
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNumberOrNull(value: unknown): boolean {
  return value === null || isNumber(value)
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || isNumberOrNull(value)
}

function isWeather(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value !== 'object') return false
  const v = value as Record<string, unknown>

  return (
    (v.windMode === 'vector' || v.windMode === 'components') &&
    isNumberOrNull(v.windSpeed) &&
    isNumberOrNull(v.windFrom) &&
    isNumberOrNull(v.headwind) &&
    isNumberOrNull(v.crosswind) &&
    isNumberOrNull(v.temperature) &&
    isNumberOrNull(v.pressure)
  )
}

function isEntry(value: unknown): value is JournalEntry {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>

  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.createdAt === 'string' &&
    typeof v.dayKey === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(v.dayKey) &&
    typeof v.modelId === 'string' &&
    typeof v.ammoId === 'string' &&
    isNumber(v.charge) &&
    isNumber(v.distance) &&
    isNumberOrNull(v.ownHeight) &&
    isNumberOrNull(v.targetHeight) &&
    isNumber(v.rangeCorrection) &&
    isNumber(v.elevation) &&
    isNumber(v.tof) &&
    isOptionalNumber(v.azimuth) &&
    (v.azimuthUnit === undefined ||
      v.azimuthUnit === 'mil' ||
      v.azimuthUnit === 'deg') &&
    isOptionalNumber(v.firingAzimuth) &&
    (v.lateralCorrection === undefined || isNumber(v.lateralCorrection)) &&
    (v.mode === undefined || v.mode === 'HIGH' || v.mode === 'LOW') &&
    isWeather(v.weather)
  )
}

export function loadEntries(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return []

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    // Повреждённые записи отбрасываются, остальные сохраняются.
    return parsed.filter(isEntry)
  } catch {
    return []
  }
}

// ---- перенос журнала между устройствами ----

const EXPORT_APP = 'multipurpose-artillery-calculator'
const EXPORT_VERSION = 1

/** Файл экспорта: обёртка с пометкой приложения и версии формата. */
export function exportJournal(
  entries: readonly JournalEntry[],
  now = new Date()
): string {
  return JSON.stringify(
    {
      app: EXPORT_APP,
      version: EXPORT_VERSION,
      exportedAt: now.toISOString(),
      entries,
    },
    null,
    2
  )
}

/**
 * Разбор файла журнала. Принимает файл экспорта или голый массив
 * записей. Возвращает корректные записи (повреждённые отбрасываются)
 * и число отброшенных; null — файл не похож на журнал.
 */
export function parseJournalFile(
  text: string
): { entries: JournalEntry[]; invalid: number } | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }

  const list =
    Array.isArray(parsed)
      ? parsed
      : typeof parsed === 'object' &&
          parsed !== null &&
          (parsed as { app?: unknown }).app === EXPORT_APP &&
          Array.isArray((parsed as { entries?: unknown }).entries)
        ? (parsed as { entries: unknown[] }).entries
        : null

  if (list === null) return null

  const entries = list.filter(isEntry)
  return { entries, invalid: list.length - entries.length }
}

/** Добавить новые записи; записи с уже существующим id пропускаются. */
export function mergeEntries(
  existing: readonly JournalEntry[],
  incoming: readonly JournalEntry[]
): { entries: JournalEntry[]; added: number; skipped: number } {
  const ids = new Set(existing.map((e) => e.id))
  const fresh: JournalEntry[] = []

  for (const entry of incoming) {
    if (ids.has(entry.id)) continue
    ids.add(entry.id)
    fresh.push(entry)
  }

  return {
    entries: [...existing, ...fresh],
    added: fresh.length,
    skipped: incoming.length - fresh.length,
  }
}

/** Поиск по названию, модели и дистанции (без учёта регистра). */
export function matchesQuery(
  entry: JournalEntry,
  query: string,
  modelName = ''
): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return true
  return [entry.name, modelName, String(entry.distance)]
    .join(' ')
    .toLowerCase()
    .includes(q)
}

function saveEntries(entries: JournalEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Хранилище недоступно или переполнено — журнал живёт до перезагрузки.
  }
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function dayKeyOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`
}

/** 2026-09-13 → 13.09.2026 */
export function formatDayKey(dayKey: string): string {
  const [year, month, day] = dayKey.split('-')
  return `${day}.${month}.${year}`
}

export function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Группировка по дням: свежие дни сверху, внутри дня свежие записи сверху. */
export function groupByDay(
  entries: readonly JournalEntry[]
): JournalDay[] {
  const map = new Map<string, JournalEntry[]>()

  for (const entry of entries) {
    const list = map.get(entry.dayKey) ?? []
    list.push(entry)
    map.set(entry.dayKey, list)
  }

  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([dayKey, list]) => ({
      dayKey,
      entries: [...list].sort((a, b) =>
        a.createdAt < b.createdAt ? 1 : -1
      ),
    }))
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

export function useJournal() {
  const [entries, setEntries] = useState<JournalEntry[]>(loadEntries)

  function commit(next: JournalEntry[]) {
    setEntries(next)
    saveEntries(next)
  }

  function add(draft: JournalDraft): JournalEntry {
    const now = new Date()
    const entry: JournalEntry = {
      ...draft,
      id: makeId(),
      createdAt: now.toISOString(),
      dayKey: dayKeyOf(now),
    }
    commit([entry, ...entries])
    return entry
  }

  /** Перезаписать вводные и результат записи, сохранив её id и день. */
  function update(id: string, draft: JournalDraft) {
    commit(
      entries.map((e) =>
        e.id === id
          ? { ...draft, id: e.id, createdAt: e.createdAt, dayKey: e.dayKey }
          : e
      )
    )
  }

  /** Импорт: возвращает, сколько записей добавлено и пропущено. */
  function importEntries(incoming: readonly JournalEntry[]) {
    const result = mergeEntries(entries, incoming)
    if (result.added > 0) commit(result.entries)
    return { added: result.added, skipped: result.skipped }
  }

  function rename(id: string, name: string) {
    const trimmed = name.trim()
    if (trimmed === '') return
    commit(
      entries.map((e) => (e.id === id ? { ...e, name: trimmed } : e))
    )
  }

  function remove(id: string) {
    commit(entries.filter((e) => e.id !== id))
  }

  function clearDay(dayKey: string) {
    commit(entries.filter((e) => e.dayKey !== dayKey))
  }

  return { entries, add, update, importEntries, rename, remove, clearDay }
}
