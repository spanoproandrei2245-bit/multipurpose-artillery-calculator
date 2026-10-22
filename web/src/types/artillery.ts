
export type ArtilleryMode = 'HIGH' | 'LOW'

export type DataStatus =
  | 'pending'
  | 'in-progress'
  | 'verified'

// null означает прочерк «-» в игровой таблице (значения нет).
// Одна строка игровой таблицы:
// [дальность м, возвышение мил, d-возвышение на 100 м
//  разницы высот мил, d-время полёта на 100 м разницы высот с,
//  время полёта с]
export type BaseBallisticRow = readonly [
  range: number,
  elevation: number,
  dElevPer100m: number | null,
  dTofPer100m: number | null,
  tof: number,
]

// Строка с погодными столбцами (ACE3 advanced corrections):
// поправка азимута на 1 м/с бокового ветра (мил) и поправки
// дальности (м) на 1 м/с встречного / попутного ветра, на 1 °C
// понижения / повышения температуры (от 15 °C) и на 1 % понижения /
// повышения плотности воздуха. Поправки дальности прибавляются
// к дальности, по которой берётся строка таблицы.
export type WeatherBallisticRow = readonly [
  ...BaseBallisticRow,
  azimuthPerCrosswind: number | null,
  rangePerHeadwind: number | null,
  rangePerTailwind: number | null,
  rangePerTempDec: number | null,
  rangePerTempInc: number | null,
  rangePerDensityDec: number | null,
  rangePerDensityInc: number | null,
]

export type BallisticRow = BaseBallisticRow | WeatherBallisticRow

// Заряд (строкой в JSON) -> строки таблицы
export type ChargeTables = Record<string, BallisticRow[]>

export interface BallisticProfile {
  columns: string[]
  units: Record<string, string>
  notes?: string
  // Режим (HIGH / LOW) -> таблицы по зарядам
  modes: Partial<Record<ArtilleryMode, ChargeTables>>
}

export interface Ammunition {
  id: string
  designation: string
  type: string
  description: string
  verified: boolean

  // Номера зарядов, доступных для боеприпаса
  charges?: number[]
  // Ключ профиля из ArtilleryReference.profiles
  profile?: string
  // Профиль для игры с включённой улучшенной баллистикой (сопротивление воздуха):
  // в игре таблица при этом совсем другая. Нет ключа — таблиц ещё нет.
  advancedProfile?: string
}

export interface ArtilleryReference {
  schemaVersion: number
  id: string
  name: string
  modification: string

  availableModes: ArtilleryMode[]

  source: {
    name: string
    status: DataStatus
  }

  screenshots: string[]

  // Временно необязательное поле:
  // M252 ещё не переведён на новую схему.
  ammunition?: Ammunition[]

  // Баллистические профили (игровые таблицы).
  // Несколько боеприпасов могут ссылаться на один профиль.
  profiles?: Record<string, BallisticProfile>
}
