import { describe, expect, it } from 'vitest'

import { models, type ModelId } from '../models'
import { artilleryCatalog, parseReference } from './catalog'
import { artilleryRegistry } from './registry'

function validReference() {
  return {
    schemaVersion: 1,
    id: 'test',
    name: 'Test',
    modification: 'Test',
    availableModes: ['HIGH'],
    source: { name: 'test', status: 'in-progress' },
    screenshots: [],
    ammunition: [
      {
        id: 'he',
        designation: 'Test',
        type: 'HE',
        description: '',
        verified: false,
        charges: [0],
        profile: 'default',
      },
    ],
    profiles: {
      default: {
        columns: [],
        units: {},
        modes: {
          HIGH: {
            '0': [
              [100, 1500, null, null, 14],
              [150, 1450, 10, 1, 13.9],
            ],
          },
        },
      },
    },
  }
}

type Reference = ReturnType<typeof validReference>

function withTable(rows: unknown[]): Reference {
  const data = validReference()
  ;(data.profiles.default.modes.HIGH as Record<string, unknown>)['0'] = rows
  return data
}

describe('parseReference', () => {
  it('accepts a valid reference', () => {
    expect(parseReference(validReference(), 'test').id).toBe('test')
  })

  it('rejects a mismatched id or schema', () => {
    expect(() => parseReference(validReference(), 'other')).toThrow()
    expect(() =>
      parseReference({ ...validReference(), schemaVersion: 2 }, 'test')
    ).toThrow()
  })

  it('rejects ranges that do not increase', () => {
    expect(() =>
      parseReference(
        withTable([
          [150, 1450, 10, 1, 13.9],
          [100, 1500, 10, 1, 14],
        ]),
        'test'
      )
    ).toThrow()
  })

  it('rejects a dash in a required column', () => {
    expect(() =>
      parseReference(withTable([[100, null, 10, 1, 14]]), 'test')
    ).toThrow()
  })

  it('rejects rows of the wrong or mixed width', () => {
    expect(() =>
      parseReference(withTable([[100, 1500, 10, 1]]), 'test')
    ).toThrow()
    expect(() =>
      parseReference(
        withTable([
          [100, 1500, 10, 1, 14],
          [150, 1450, 10, 1, 13.9, 1, 1, -1, 0, 0, 0, 0],
        ]),
        'test'
      )
    ).toThrow()
  })

  it('rejects ammunition charges that have no table', () => {
    const data = validReference()
    data.ammunition[0].charges = [0, 1]
    expect(() => parseReference(data, 'test')).toThrow()
  })

  it('rejects a reference to a missing profile', () => {
    const data = validReference()
    data.ammunition[0].profile = 'nope'
    expect(() => parseReference(data, 'test')).toThrow()
  })

  it('rejects duplicate ammunition ids', () => {
    const data = validReference()
    data.ammunition.push({ ...data.ammunition[0] })
    expect(() => parseReference(data, 'test')).toThrow()
  })
})

// Проверка настоящих справочников: защита от опечаток при перепечатке.
describe('bundled tables', () => {
  const references = Object.values(artilleryCatalog)

  it('every model has a reference', () => {
    for (const id of Object.keys(models) as ModelId[]) {
      expect(artilleryRegistry[id]).toBeDefined()
    }
  })

  for (const reference of references) {
    describe(reference.id, () => {
      for (const [profileKey, profile] of Object.entries(
        reference.profiles ?? {}
      )) {
        for (const [mode, tables] of Object.entries(profile.modes)) {
          for (const [charge, rows] of Object.entries(tables ?? {})) {
            const label = `${profileKey} ${mode} charge ${charge}`

            it(`${label}: elevation is monotonic and time of flight is positive`, () => {
              for (let i = 0; i < rows.length; i += 1) {
                expect(rows[i][4]).toBeGreaterThan(0)
                if (i === 0) continue
                // HIGH: с ростом дальности возвышение падает,
                // LOW: растёт.
                if (mode === 'HIGH') {
                  expect(rows[i][1]).toBeLessThan(rows[i - 1][1])
                } else {
                  expect(rows[i][1]).toBeGreaterThan(rows[i - 1][1])
                }
              }
            })

            it(`${label}: height correction has the sign of the mode`, () => {
              // HIGH: D ELEV > 0, LOW: D ELEV < 0
              for (const row of rows) {
                if (row[2] === null) continue
                if (mode === 'HIGH') expect(row[2]).toBeGreaterThan(0)
                else expect(row[2]).toBeLessThan(0)
              }
            })

            it(`${label}: elevation stays within 0–1600 mil`, () => {
              for (const row of rows) {
                expect(row[1]).toBeGreaterThan(0)
                expect(row[1]).toBeLessThanOrEqual(1600)
              }
            })

            it(`${label}: weather columns keep their signs`, () => {
              for (const row of rows) {
                if (row.length !== 12) continue
                const [, , , , , az, head, tail, , tempInc, densDec, densInc] =
                  row
                // HEAD ≥ 0, TAIL ≤ 0, TEMP INC ≤ 0, DENS DEC ≤ 0, DENS INC ≥ 0
                if (az !== null) expect(az).toBeGreaterThanOrEqual(0)
                if (head !== null) expect(head).toBeGreaterThanOrEqual(0)
                if (tail !== null) expect(tail).toBeLessThanOrEqual(0)
                if (tempInc !== null) expect(tempInc).toBeLessThanOrEqual(0)
                if (densDec !== null) expect(densDec).toBeLessThanOrEqual(0)
                if (densInc !== null) expect(densInc).toBeGreaterThanOrEqual(0)
              }
            })
          }
        }
      }
    })
  }
})
