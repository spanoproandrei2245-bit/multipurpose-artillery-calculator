
import { artilleryCatalog } from './catalog'

import type { ModelId } from '../models'
import type { ArtilleryReference } from '../../types/artillery'

// Связываем ID интерфейса с JSON-справочниками.
export const artilleryRegistry = {
  mk6: artilleryCatalog.mk6,
  m252: artilleryCatalog.m252_rhsusaf,
} satisfies Record<ModelId, ArtilleryReference>
