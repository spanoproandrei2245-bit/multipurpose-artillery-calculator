
import { artilleryCatalog } from './catalog'

import type { ModelId } from '../models'
import type { ArtilleryReference } from '../../types/artillery'

// Связываем ID интерфейса с JSON-справочниками.
export const artilleryRegistry = {
  mk6: artilleryCatalog.mk6,
  m252: artilleryCatalog.m252_rhsusaf,
  m29: artilleryCatalog.m29_sog,
  m2: artilleryCatalog.m2_sog,
  m101: artilleryCatalog.m101_sog,
} satisfies Record<ModelId, ArtilleryReference>
