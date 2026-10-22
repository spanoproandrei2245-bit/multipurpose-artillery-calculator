import type { Ammunition, BallisticProfile, ArtilleryReference } from '../types/artillery'

/**
 * Профиль таблиц для боеприпаса. При включённой улучшенной баллистике берётся
 * advancedProfile; если таких таблиц ещё нет, используется обычный профиль,
 * а missingAdvanced = true (калькулятор об этом предупреждает).
 */
export function selectProfile(
  reference: Pick<ArtilleryReference, 'profiles'>,
  ammo: Pick<Ammunition, 'profile' | 'advancedProfile'> | undefined,
  advanced: boolean
): { profile: BallisticProfile | undefined; missingAdvanced: boolean } {
  const profiles = reference.profiles
  const normal = ammo?.profile !== undefined ? profiles?.[ammo.profile] : undefined
  if (!advanced) return { profile: normal, missingAdvanced: false }
  const adv = ammo?.advancedProfile !== undefined ? profiles?.[ammo.advancedProfile] : undefined
  return adv ? { profile: adv, missingAdvanced: false } : { profile: normal, missingAdvanced: normal !== undefined }
}
