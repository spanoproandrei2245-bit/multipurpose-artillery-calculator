// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { solveAllCharges, type ChargeResult } from '../lib/ballistics'
import { artilleryRegistry } from '../data/artillery/registry'
import { AnimatedNumber } from './AnimatedNumber'
import { ChargeStrip } from './ChargeStrip'
import { Dropdown } from './Dropdown'
import { Row, Toggle } from './FormControls'

beforeAll(() => {
  // jsdom не умеет, а компоненты зовут
  Element.prototype.scrollIntoView = () => {}
  class RO {
    observe() {}
    disconnect() {}
    unobserve() {}
  }
  vi.stubGlobal('ResizeObserver', RO)
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
})
afterEach(cleanup)

describe('Dropdown', () => {
  const options = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Bravo', description: 'второй' },
    { value: 'c', label: 'Charlie', disabled: true },
  ]

  it('показывает выбранное и выбирает по клику', () => {
    const onChange = vi.fn()
    render(<Dropdown label="Выбор" value="a" options={options} onChange={onChange} />)
    const button = screen.getByRole('button', { name: 'Выбор' })
    expect(button).toHaveTextContent('Alpha')
    fireEvent.click(button)
    fireEvent.click(screen.getByRole('option', { name: /Bravo/ }))
    expect(onChange).toHaveBeenCalledWith('b')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('управляется стрелками и Enter, Escape закрывает', () => {
    const onChange = vi.fn()
    render(<Dropdown label="Выбор" value="a" options={options} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Выбор' }))
    const list = screen.getByRole('listbox')
    fireEvent.keyDown(list, { key: 'ArrowDown' })
    fireEvent.keyDown(list, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('b')

    fireEvent.click(screen.getByRole('button', { name: 'Выбор' }))
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('не выбирает недоступные пункты', () => {
    const onChange = vi.fn()
    render(<Dropdown label="Выбор" value="a" options={options} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Выбор' }))
    fireEvent.click(screen.getByRole('option', { name: /Charlie/ }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('заголовки групп выводятся один раз на группу', () => {
    render(
      <Dropdown
        label="Карта"
        value="x"
        onChange={() => {}}
        options={[
          { value: 'x', label: 'X', group: 'Официальные' },
          { value: 'y', label: 'Y', group: 'Официальные' },
          { value: 'z', label: 'Z', group: 'Сообщество' },
        ]}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Карта' }))
    expect(screen.getAllByText('Официальные')).toHaveLength(1)
    expect(screen.getAllByText('Сообщество')).toHaveLength(1)
  })

  it('кнопка внутри строки не выбирает пункт (звёздочка избранного)', () => {
    const onChange = vi.fn()
    const star = vi.fn()
    render(
      <Dropdown
        label="Карта"
        value="x"
        onChange={onChange}
        options={[
          {
            value: 'y',
            label: 'Y',
            trailing: (
              <button
                aria-label="star"
                onClick={(e) => {
                  e.stopPropagation()
                  star()
                }}
              />
            ),
          },
        ]}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Карта' }))
    fireEvent.click(screen.getByRole('button', { name: 'star' }))
    expect(star).toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('Toggle и Row', () => {
  it('Toggle отмечает выбранное и вызывает onChange', () => {
    const onChange = vi.fn()
    render(
      <Toggle
        label="Режим"
        value="HIGH"
        onChange={onChange}
        options={[
          { value: 'HIGH', label: 'Навесная' },
          { value: 'LOW', label: 'Настильная' },
        ]}
      />
    )
    expect(screen.getByRole('button', { name: 'Навесная' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Настильная' }))
    expect(onChange).toHaveBeenCalledWith('LOW')
  })

  it('Row с единицей показывает её справа от контрола', () => {
    render(
      <dl>
        <Row label="Дистанция" control="unit" unit="м">
          <input aria-label="d" />
        </Row>
      </dl>
    )
    expect(screen.getByText('Дистанция')).toBeInTheDocument()
    expect(screen.getByText('м')).toBeInTheDocument()
  })
})

describe('AnimatedNumber', () => {
  it('показывает прочерк без значения и число со значением', () => {
    const { rerender } = render(<AnimatedNumber value={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
    rerender(<AnimatedNumber value={1043.4} />)
    return waitFor(() => expect(screen.getByText('1043')).toBeInTheDocument())
  })

  it('докручивается до нового значения и использует формат', async () => {
    const { rerender, container } = render(
      <AnimatedNumber value={10} format={(v) => v.toFixed(1)} duration={40} />
    )
    await waitFor(() => expect(container).toHaveTextContent('10.0'))
    rerender(<AnimatedNumber value={20} format={(v) => v.toFixed(1)} duration={40} />)
    await waitFor(() => expect(container).toHaveTextContent('20.0'))
  })

  it('большой скачок (азимут через ноль) — без прокрутки', async () => {
    const { rerender, container } = render(<AnimatedNumber value={6200} maxTween={3000} duration={400} />)
    await waitFor(() => expect(container).toHaveTextContent('6200'))
    rerender(<AnimatedNumber value={50} maxTween={3000} duration={400} />)
    await waitFor(() => expect(container).toHaveTextContent('50'))
    expect(container).not.toHaveTextContent('3')
  })
})

describe('ChargeStrip', () => {
  const profile = artilleryRegistry.m101.profiles?.['default'] ?? Object.values(artilleryRegistry.m101.profiles ?? {})[0]

  function results(range: number): ChargeResult[] {
    if (!profile) throw new Error('нет профиля M101')
    return solveAllCharges(profile, 'HIGH', undefined, range, 0)
  }

  it('показывает все заряды, выбранный отмечен, недоступные выключены', () => {
    const onPick = vi.fn()
    const list = results(3000)
    render(
      <ChargeStrip
        groups={[{ mode: 'HIGH', label: 'Навесная', results: list }]}
        activeMode="HIGH"
        activeCharge={list.find((r) => r.solution)?.charge ?? null}
        onPick={onPick}
      />
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(list.length)
    const usable = list.filter((r) => r.solution)
    expect(buttons.filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1)
    expect(buttons.filter((b) => (b as HTMLButtonElement).disabled)).toHaveLength(list.length - usable.length)

    const first = buttons.find((b) => !(b as HTMLButtonElement).disabled)!
    fireEvent.click(first)
    expect(onPick).toHaveBeenCalledWith('HIGH', usable[0].charge)
  })

  it('при нескольких траекториях подписывает группы', () => {
    const list = results(3000)
    render(
      <ChargeStrip
        groups={[
          { mode: 'HIGH', label: 'Навесная траектория', results: list },
          { mode: 'LOW', label: 'Настильная траектория', results: list },
        ]}
        activeMode="HIGH"
        activeCharge={null}
        onPick={() => {}}
      />
    )
    expect(screen.getByText('Навесная траектория')).toBeInTheDocument()
    expect(screen.getByText('Настильная траектория')).toBeInTheDocument()
  })

  it('выбор в другой траектории сообщает и режим', () => {
    const list = results(3000)
    const onPick = vi.fn()
    render(
      <ChargeStrip
        groups={[
          { mode: 'HIGH', label: 'H', results: list },
          { mode: 'LOW', label: 'L', results: list },
        ]}
        activeMode="HIGH"
        activeCharge={null}
        onPick={onPick}
      />
    )
    const low = screen.getByText('L').parentElement!
    const enabled = within(low).getAllByRole('button').find((b) => !(b as HTMLButtonElement).disabled)
    expect(enabled).toBeTruthy()
    act(() => {
      fireEvent.click(enabled!)
    })
    expect(onPick.mock.calls[0][0]).toBe('LOW')
  })
})
