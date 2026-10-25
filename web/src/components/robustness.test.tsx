// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { artilleryRegistry } from '../data/artillery/registry'
import { setLanguage } from '../i18n'
import { readErrors, recordError } from '../lib/errorLog'
import { DataStatusBadge } from './DataStatusBadge'
import { ErrorBoundary } from './ErrorBoundary'

function Boom({ message = 'boom' }: { message?: string }): never {
  throw new Error(message)
}

beforeEach(() => {
  localStorage.clear()
  setLanguage('ru')
  // React пишет пойманную ошибку в консоль — в тестах это шум
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ErrorBoundary', () => {
  it('вместо белого экрана показывает сообщение и пишет ошибку в журнал', () => {
    render(
      <ErrorBoundary area="test">
        <Boom message="сломалось в тесте" />
      </ErrorBoundary>
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Что-то сломалось')).toBeInTheDocument()
    expect(screen.getByText('сломалось в тесте')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Перезагрузить/ })).toBeInTheDocument()
    const log = readErrors()
    expect(log).toHaveLength(1)
    expect(log[0].area).toBe('test')
    expect(log[0].message).toBe('сломалось в тесте')
  })

  it('карточка блока: «Повторить» снова показывает содержимое', () => {
    let fail = true
    function Flaky() {
      if (fail) throw new Error('flaky')
      return <p>карта на месте</p>
    }
    render(
      <ErrorBoundary area="map" variant="inline">
        <Flaky />
      </ErrorBoundary>
    )
    expect(screen.getByText('Карта не открылась')).toBeInTheDocument()
    fail = false
    fireEvent.click(screen.getByRole('button', { name: /Повторить/ }))
    expect(screen.getByText('карта на месте')).toBeInTheDocument()
  })

  it('ссылка «Сообщить о проблеме» ведёт в issues с текстом ошибки', () => {
    render(
      <ErrorBoundary area="test">
        <Boom message="ссылка" />
      </ErrorBoundary>
    )
    const link = screen.getByRole('link', { name: /Сообщить о проблеме/ })
    expect(link.getAttribute('href')).toContain('/issues/new?title=')
    expect(decodeURIComponent(link.getAttribute('href')!)).toContain('ссылка')
  })
})

describe('журнал ошибок', () => {
  it('хранит не больше 10 последних записей', () => {
    for (let i = 0; i < 15; i += 1) recordError('test', new Error(`e${i}`))
    const log = readErrors()
    expect(log).toHaveLength(10)
    expect(log[0].message).toBe('e5')
    expect(log[9].message).toBe('e14')
  })
})

describe('DataStatusBadge', () => {
  it('проверенные и непроверенные таблицы различаются значком и подсказкой', () => {
    render(
      <>
        <DataStatusBadge status="verified" />
        <DataStatusBadge status="in-progress" />
      </>
    )
    const badges = screen.getAllByRole('img')
    expect(badges[0]).toHaveAttribute('data-status', 'verified')
    expect(badges[0].getAttribute('aria-label')).toMatch(/проверено в игре/)
    expect(badges[1].getAttribute('aria-label')).toMatch(/не проверено в игре/)
    expect(badges[1].getAttribute('aria-label')).toMatch(/возможны промахи/)
  })

  it('у каждого орудия есть статус проверки таблиц', () => {
    for (const reference of Object.values(artilleryRegistry)) {
      expect(['pending', 'in-progress', 'verified']).toContain(reference.source.status)
    }
  })
})
