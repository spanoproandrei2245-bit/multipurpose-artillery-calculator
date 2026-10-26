import type { ArtilleryMode } from '../types/artillery'
import type { AdjustmentEntry } from '../components/AdjustFire'
import type { MapTarget } from './journal'

/**
 * Черновик вводных: всё, что введено в калькуляторе, переживает смену орудия,
 * снаряда, переход в настройки и перезагрузку страницы.
 *
 * Общие поля (дистанция, азимут, высоты, цель на карте, корректировка) —
 * одни на все орудия; выбор снаряда, траектории и заряда — свой у каждого орудия.
 */
export interface CalcDraft {
  distance: string
  ownHeight: string
  targetHeight: string
  azimuth: string
  mapTarget: MapTarget | null
  adjust: AdjustmentEntry[]
}

export interface ModelDraft {
  ammoId?: string
  modeChoice?: ArtilleryMode | 'auto'
  charge?: number | null
}

const DRAFT_KEY = 'calcDraft'
const modelKey = (modelId: string) => `calcModel:${modelId}`

const isString = (v: unknown): v is string => typeof v === 'string'

function read(key: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null') as unknown
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Хранилище недоступно — поля живут до перезагрузки.
  }
}

export function readCalcDraft(): CalcDraft | null {
  const v = read(DRAFT_KEY)
  if (!v) return null
  const target = v.mapTarget as Record<string, unknown> | null | undefined
  return {
    distance: isString(v.distance) ? v.distance : '',
    ownHeight: isString(v.ownHeight) ? v.ownHeight : '',
    targetHeight: isString(v.targetHeight) ? v.targetHeight : '',
    azimuth: isString(v.azimuth) ? v.azimuth : '',
    mapTarget:
      target && isString(target.world) && typeof target.x === 'number' && typeof target.y === 'number'
        ? { world: target.world, x: target.x, y: target.y }
        : null,
    adjust: Array.isArray(v.adjust)
      ? (v.adjust as AdjustmentEntry[]).filter(
          (e) => typeof e?.range === 'number' && typeof e?.lateral === 'number'
        )
      : [],
  }
}

export function writeCalcDraft(draft: CalcDraft) {
  write(DRAFT_KEY, draft)
}

export function readModelDraft(modelId: string): ModelDraft {
  const v = read(modelKey(modelId))
  if (!v) return {}
  return {
    ammoId: isString(v.ammoId) ? v.ammoId : undefined,
    modeChoice:
      v.modeChoice === 'auto' || v.modeChoice === 'HIGH' || v.modeChoice === 'LOW'
        ? v.modeChoice
        : undefined,
    charge: typeof v.charge === 'number' ? v.charge : null,
  }
}

export function writeModelDraft(modelId: string, draft: ModelDraft) {
  write(modelKey(modelId), draft)
}
