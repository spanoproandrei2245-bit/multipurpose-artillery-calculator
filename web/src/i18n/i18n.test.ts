import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { getLanguage, setLanguage, t, translate } from './index'
import { en, ru } from './messages'
import { de } from './messages.de'
import { fr } from './messages.fr'
import { ja } from './messages.ja'
import { uk } from './messages.uk'
import { zh } from './messages.zh'

const placeholders = (s: string) => [...s.matchAll(/\{(\d+)\}/g)].map((m) => m[1]).sort()
const cyrillic = /[А-Яа-яЁё]/

describe('словари', () => {
  const keys = Object.keys(ru)

  it('у обоих языков одни и те же ключи', () => {
    expect(Object.keys(en).sort()).toEqual([...keys].sort())
  })

  it('подстановки {0}, {1} совпадают в русской и английской версии', () => {
    const bad = keys.filter(
      (k) => JSON.stringify(placeholders(ru[k as keyof typeof ru])) !== JSON.stringify(placeholders(en[k as keyof typeof ru]))
    )
    expect(bad).toEqual([])
  })

  it('в английских текстах нет кириллицы, в русских она есть (кроме обозначений)', () => {
    const inEn = keys.filter((k) => cyrillic.test(en[k as keyof typeof ru]))
    expect(inEn).toEqual([])
    const ALLOWED_SAME = new Set(['unit.hpa', 'picker.vanilla'])
    const notTranslated = keys.filter(
      (k) =>
        !ALLOWED_SAME.has(k) &&
        !cyrillic.test(ru[k as keyof typeof ru]) &&
        ru[k as keyof typeof ru] === en[k as keyof typeof ru]
    )
    expect(notTranslated).toEqual([])
  })

  it('пустых текстов нет', () => {
    expect(keys.filter((k) => ru[k as keyof typeof ru].trim() === '' || en[k as keyof typeof ru].trim() === '')).toEqual([])
  })
})

describe('t()', () => {
  it('берёт текущий язык и подставляет значения', () => {
    setLanguage('ru')
    expect(getLanguage()).toBe('ru')
    expect(t('markers.min', 5)).toBe('5 мин')
    setLanguage('en')
    expect(t('markers.min', 5)).toBe('5 min')
    setLanguage('ru')
  })

  it('translate() работает с явным языком и пропущенные аргументы даёт пустыми', () => {
    expect(translate('en', 'markers.h-min', 1, 5)).toBe('1 h 5 min')
    expect(translate('ru', 'markers.h-min', 1)).toBe('1 ч  мин')
  })
})

describe('тексты не зашиты в код', () => {
  const root = fileURLToPath(new URL('..', import.meta.url))

  function files(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) {
        if (name !== 'i18n') files(p, out)
      } else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) && !/\.d\.ts$/.test(name)) out.push(p)
    }
    return out
  }

  // Названия языков пишутся на самих языках — это не перевод
  const ENDONYMS = new Set(['Русский'])

  it('кириллица в строках кода — только в словаре', () => {
    const offenders: string[] = []
    for (const file of files(root)) {
      const code = readFileSync(file, 'utf8')
      const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
      const visit = (n: ts.Node) => {
        if (
          (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) &&
          cyrillic.test(n.text) &&
          !ENDONYMS.has(n.text)
        ) {
          const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
          offenders.push(`${relative(root, file)}:${line} ${n.text.slice(0, 40)}`)
        }
        if (ts.isJsxText(n) && cyrillic.test(n.text)) {
          const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
          offenders.push(`${relative(root, file)}:${line} ${n.text.trim().slice(0, 40)}`)
        }
        ts.forEachChild(n, visit)
      }
      visit(sf)
    }
    expect(offenders).toEqual([])
  })
})

describe('словарь без мусора', () => {
  const root = fileURLToPath(new URL('..', import.meta.url))

  function sources(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) {
        if (name !== 'i18n') sources(p, out)
      } else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(readFileSync(p, 'utf8'))
    }
    return out
  }

  it('каждый ключ используется в коде', () => {
    const code = sources(root).join('\n')
    const unused = Object.keys(ru).filter(
      (k) =>
        // горячие клавиши собираются из имени действия
        !k.startsWith('settings.hotkeys.') &&
        // вопросы и ответы справки собираются по номеру
        !/^help\.[qa]\d+$/.test(k) &&
        !code.includes(`'${k}'`) &&
        !code.includes(`"${k}"`)
    )
    expect(unused).toEqual([])
  })
})

describe('все языки интерфейса', () => {
  const keys = Object.keys(ru) as (keyof typeof ru)[]
  // Обозначения и имена собственные, одинаковые на всех языках
  const SAME_AS_EN = /^(unit\.|picker\.vanilla|about\.)/
  const others = { uk, de, fr, ja, zh }

  for (const [id, dict] of Object.entries(others)) {
    describe(id, () => {
      it('те же ключи и подстановки, что в русском', () => {
        expect(Object.keys(dict).sort()).toEqual([...keys].sort())
        const bad = keys.filter(
          (k) => JSON.stringify(placeholders(dict[k])) !== JSON.stringify(placeholders(ru[k]))
        )
        expect(bad).toEqual([])
      })

      it('кириллица только в украинском (без ы, э, ъ, ё)', () => {
        const withCyr = keys.filter((k) => cyrillic.test(dict[k]))
        if (id === 'uk') {
          expect(withCyr.length).toBeGreaterThan(keys.length * 0.9)
          expect(keys.filter((k) => /[ыэъёЫЭЪЁ]/.test(dict[k]))).toEqual([])
        } else {
          expect(withCyr).toEqual([])
        }
      })

      it('не осталось непереведённых английских строк', () => {
        // В немецком и французском бывают совпадения (Auto, Distance): допускаем короткие
        const cognates = id === 'de' || id === 'fr'
        const same = keys.filter(
          (k) =>
            dict[k] === en[k] &&
            !SAME_AS_EN.test(k) &&
            /[A-Za-z]{4,}/.test(en[k]) &&
            !(cognates && en[k].split(' ').length <= 3)
        )
        expect(same).toEqual([])
      })
    })
  }
})
