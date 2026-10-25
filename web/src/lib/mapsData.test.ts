import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { mapKind, parseMapDescription } from './builtinMaps'

const ROOT = fileURLToPath(new URL('../../public/maps/', import.meta.url))

// Карты лежат в ветке maps (npm run maps:pull); без них проверка карт пропускается, в CI они есть всегда
const HAS_MAPS = existsSync(join(ROOT, 'index.json'))

const index = (HAS_MAPS ? JSON.parse(readFileSync(join(ROOT, 'index.json'), 'utf8')) : { maps: [] }) as {
  maps: { world: string; displayName: string; author: string; kind?: 'official' | 'community'; worldSize: number }[]
}

describe('mapKind', () => {
  it('Bohemia — официальные, остальные — сообщество', () => {
    expect(mapKind({ author: 'Bohemia Interactive' })).toBe('official')
    expect(mapKind({ author: 'Jacko' })).toBe('community')
  })

  it('явный kind важнее автора', () => {
    expect(mapKind({ author: 'Jacko', kind: 'official' })).toBe('official')
  })
})

describe.skipIf(!HAS_MAPS)('встроенные карты в public/maps', () => {
  it('в списке есть карты и нет повторов', () => {
    expect(index.maps.length).toBeGreaterThan(0)
    const worlds = index.maps.map((m) => m.world)
    expect(new Set(worlds).size).toBe(worlds.length)
  })

  it.each(index.maps.map((m) => [m.world, m] as const))(
    '%s: описание, высоты и тайлы согласованы',
    (world, entry) => {
      const dir = join(ROOT, world)
      const description = parseMapDescription(
        JSON.parse(readFileSync(join(dir, 'map.json'), 'utf8'))
      )
      expect(description).not.toBeNull()
      const d = description!
      expect(d.world).toBe(world)
      expect(d.worldSize).toBe(entry.worldSize)
      expect(['official', 'community']).toContain(entry.kind ?? mapKind(entry))

      // Высоты: Int16 на каждую точку сетки
      const heights = statSync(join(dir, d.heights.file))
      expect(heights.size).toBe(d.heights.size * d.heights.size * 2)

      const tl = d.tiles
      if (tl) {
        // Каждому уровню пирамиды соответствует папка с тайлами (в урезанных
        // картах верхний уровень убран — levels уменьшен вместе с ним)
        for (let z = 0; z < tl.levels; z += 1) {
          const level = join(dir, 'tiles', String(z))
          expect(existsSync(level), `уровень ${z}`).toBe(true)
          expect(readdirSync(level).length).toBeGreaterThan(0)
        }
        expect(existsSync(join(dir, 'tiles', String(tl.levels))), 'лишний уровень').toBe(false)
  
        expect(existsSync(join(dir, 'tiles', '0', `0_0.${tl.ext}`))).toBe(true)
  
        // Размер сетки тайлов покрывает карту целиком
        const top = tl.metersPerTile
        const cols = Math.ceil(d.worldSize / top)
        expect(existsSync(join(dir, 'tiles', String(tl.levels - 1), `${cols - 1}_${cols - 1}.${tl.ext}`))).toBe(true)
      }
      // Превью карты для списков
      expect(existsSync(join(dir, "preview.webp"))).toBe(true)
    }
  )

  it('суммарный вес карт не раздувается (порог 120 МБ, с векторными слоями)', () => {
    function size(dir: string): number {
      return readdirSync(dir).reduce((sum, name) => {
        const p = join(dir, name)
        const s = statSync(p)
        return sum + (s.isDirectory() ? size(p) : s.size)
      }, 0)
    }
    expect(size(ROOT) / 1024 / 1024).toBeLessThan(120)
  })
})
