
export type ArtilleryMode = 'HIGH' | 'LOW'

export type DataStatus =
  | 'pending'
  | 'in-progress'
  | 'verified'

export interface Ammunition {
  id: string
  designation: string
  type: string
  description: string
  verified: boolean
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
}
