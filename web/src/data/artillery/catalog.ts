
import mk6Data from './mk6.json'
import m252Data from './m252_rhsusaf.json'
import m29Data from './m29_sog.json'
import m2Data from './m2_sog.json'
import m101Data from './m101_sog.json'

import type { ArtilleryReference } from '../../types/artillery'

function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function isAmmunition(value: unknown): boolean {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.designation === 'string' &&
    typeof value.type === 'string' &&
    typeof value.description === 'string' &&
    typeof value.verified === 'boolean' &&
    (value.charges === undefined ||
      (Array.isArray(value.charges) &&
        value.charges.every(
          (c: unknown) =>
            typeof c === 'number' && Number.isInteger(c) && c >= 0
        ))) &&
    (value.profile === undefined ||
      typeof value.profile === 'string')
  )
}

// Обязательные значения: дальность, возвышение, время полёта.
// В остальных столбцах допускается прочерк (null).
const REQUIRED_COLUMNS = new Set([0, 1, 4])

function isBallisticRow(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    (value.length === 5 || value.length === 12) &&
    value.every((item: unknown, index: number) =>
      item === null
        ? !REQUIRED_COLUMNS.has(index)
        : typeof item === 'number' && Number.isFinite(item)
    )
  )
}

function isChargeTable(rows: unknown): boolean {
  if (!Array.isArray(rows) || rows.length === 0) return false
  if (!rows.every(isBallisticRow)) return false

  for (let i = 1; i < rows.length; i += 1) {
    // Дальность должна строго возрастать, иначе интерполяция
    // даст неверный результат.
    if (rows[i][0] <= rows[i - 1][0]) return false
    // Все строки одной таблицы — одинаковой ширины.
    if (rows[i].length !== rows[0].length) return false
  }

  return true
}

function isProfile(value: unknown): boolean {
  if (!isObject(value) || !isObject(value.modes)) return false

  return Object.values(value.modes).every(
    (charges) =>
      isObject(charges) &&
      Object.entries(charges).every(
        ([charge, rows]) =>
          /^\d+$/.test(charge) && isChargeTable(rows)
      )
  )
}

export function parseReference(
  data: unknown,
  expectedId: string
): ArtilleryReference {
  if (!isObject(data) || !isObject(data.source)) {
    throw new Error(`Invalid model: ${expectedId}`)
  }

  const validModes =
    Array.isArray(data.availableModes) &&
    data.availableModes.length > 0 &&
    data.availableModes.every(
      (mode: unknown) => mode === 'HIGH' || mode === 'LOW'
    )

  const validScreenshots =
    Array.isArray(data.screenshots) &&
    data.screenshots.every(
      (item: unknown) => typeof item === 'string'
    )

  const validAmmunition =
    data.ammunition === undefined ||
    (
      Array.isArray(data.ammunition) &&
      data.ammunition.length > 0 &&
      data.ammunition.every(isAmmunition) &&
      new Set(
        data.ammunition.map(
          (item: { id: string }) => item.id
        )
      ).size === data.ammunition.length
    )

  const validProfiles =
    data.profiles === undefined ||
    (isObject(data.profiles) &&
      Object.values(data.profiles).every(isProfile))

  // Каждая ссылка боеприпаса на профиль должна указывать
  // на существующий профиль, а заявленные заряды — быть
  // в таблицах этого профиля.
  const profileRefsOk =
    !Array.isArray(data.ammunition) ||
    data.ammunition.every(
      (item: { profile?: string; charges?: number[] }) => {
        if (item.profile === undefined) return true
        if (!isObject(data.profiles)) return false

        const profile = data.profiles[item.profile]
        if (!isObject(profile) || !isObject(profile.modes)) return false

        const tables = Object.values(profile.modes).filter(isObject)
        return (item.charges ?? []).every((charge) =>
          tables.some((charges) => String(charge) in charges)
        )
      }
    )

  const validStatus =
    data.source.status === 'pending' ||
    data.source.status === 'in-progress' ||
    data.source.status === 'verified'

  if (
    data.schemaVersion !== 1 ||
    data.id !== expectedId ||
    typeof data.name !== 'string' ||
    typeof data.modification !== 'string' ||
    typeof data.source.name !== 'string' ||
    !validStatus ||
    !validModes ||
    !validScreenshots ||
    !validAmmunition ||
    !validProfiles ||
    !profileRefsOk
  ) {
    throw new Error(`Invalid model: ${expectedId}`)
  }

  return data as unknown as ArtilleryReference
}

export const artilleryCatalog = {
  mk6: parseReference(mk6Data, 'mk6'),
  m252_rhsusaf: parseReference(
    m252Data,
    'm252_rhsusaf'
  ),
  m29_sog: parseReference(m29Data, 'm29_sog'),
  m2_sog: parseReference(m2Data, 'm2_sog'),
  m101_sog: parseReference(m101Data, 'm101_sog'),
}
