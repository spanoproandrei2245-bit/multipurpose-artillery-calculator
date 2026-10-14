import type { Heightmap } from './heightmap'

/**
 * Хранение сеток высот в IndexedDB: карта весит до нескольких
 * мегабайт — больше, чем надёжно вмещает localStorage.
 */
const DB_NAME = 'artillery-maps'
const STORE = 'heightmaps'

export interface StoredMapInfo {
  world: string
  worldSize: number
  step: number
  size: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'))
      return
    }
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'world' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

export function saveHeightmap(map: Heightmap): Promise<IDBValidKey> {
  return run('readwrite', (store) => store.put(map))
}

export async function loadHeightmap(world: string): Promise<Heightmap | null> {
  const map = await run<Heightmap | undefined>('readonly', (store) =>
    store.get(world)
  )
  return map ?? null
}

export async function listHeightmaps(): Promise<StoredMapInfo[]> {
  const maps = await run<Heightmap[]>('readonly', (store) => store.getAll())
  return maps
    .map(({ world, worldSize, step, size }) => ({
      world,
      worldSize,
      step,
      size,
    }))
    .sort((a, b) => a.world.localeCompare(b.world))
}

export function deleteHeightmap(world: string): Promise<undefined> {
  return run('readwrite', (store) => store.delete(world))
}
