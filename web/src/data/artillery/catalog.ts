
import mk6Data from './mk6.json'
import m252Data from './m252_rhsusaf.json'

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
    typeof value.verified === 'boolean'
  )
}

function parseReference(
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
    !validAmmunition
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
}
