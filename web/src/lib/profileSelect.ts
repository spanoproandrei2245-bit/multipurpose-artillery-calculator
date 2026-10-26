import type {
  Ammunition,
  ArtilleryMode,
  ArtilleryReference,
  BallisticProfile,
} from '../types/artillery'

const MODES: readonly ArtilleryMode[] = ['HIGH', 'LOW']

/**
 * Снята ли таблица с сопротивлением воздуха. ACE показывает погодные поправки
 * (ветер, температура, плотность воздуха) только при включённом сопротивлении:
 * таблица с ними — для улучшенной баллистики, без них — для игры без неё.
 */
export function hasDragData(profile: BallisticProfile | undefined): boolean {
  if (!profile) return false
  return Object.values(profile.modes).some(
    (tables) =>
      tables !== undefined &&
      Object.values(tables).some((rows) =>
        rows.some((row) => row.length > 5 && row.slice(5).some((value) => value !== null))
      )
  )
}

export interface ProfileChoice {
  profile: BallisticProfile | undefined
  // Траектории, для которых нет таблиц под выбранную физику: взяты таблицы
  // другой физики, калькулятор об этом предупреждает
  substituted: ArtilleryMode[]
}

// Склеенный профиль не пересобирается на каждый рендер
const merged = new WeakMap<BallisticProfile, WeakMap<BallisticProfile, BallisticProfile>>()

/**
 * Таблицы для боеприпаса под выбранную физику (advanced — игра с
 * сопротивлением воздуха). Профиль advanced всегда с сопротивлением; обычный —
 * с ним, если в нём есть погодные поправки (у таких орудий таблиц без
 * сопротивления пока нет). Траектории, которых нет в нужных таблицах,
 * берутся из таблиц другой физики и попадают в substituted.
 */
export function selectProfile(
  reference: Pick<ArtilleryReference, 'profiles'>,
  ammo: Pick<Ammunition, 'profile' | 'advancedProfile'> | undefined,
  advanced: boolean
): ProfileChoice {
  const profiles = reference.profiles
  const normal = ammo?.profile !== undefined ? profiles?.[ammo.profile] : undefined
  const adv = ammo?.advancedProfile !== undefined ? profiles?.[ammo.advancedProfile] : undefined
  const normalHasDrag = hasDragData(normal)
  const withDrag = adv ?? (normalHasDrag ? normal : undefined)
  const withoutDrag = normalHasDrag ? undefined : normal

  const preferred = advanced ? withDrag : withoutDrag
  const other = advanced ? withoutDrag : withDrag
  if (!preferred) return { profile: other, substituted: other ? MODES.filter((m) => other.modes[m]) : [] }

  const substituted = MODES.filter((m) => !preferred.modes[m] && other?.modes[m])
  if (!other || substituted.length === 0) return { profile: preferred, substituted: [] }

  let byOther = merged.get(preferred)
  if (!byOther) merged.set(preferred, (byOther = new WeakMap()))
  let profile = byOther.get(other)
  if (!profile) {
    profile = { ...preferred, modes: { ...other.modes, ...preferred.modes } }
    byOther.set(other, profile)
  }
  return { profile, substituted }
}
