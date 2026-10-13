import { useState } from 'react'

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

  return { entries, add, rename, remove, clearDay }
}
