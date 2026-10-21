import { describe, expect, it } from 'vitest'

import {
  buildIssueUrl,
  parseRequests,
  parseWorkshopLink,
  REPO,
  REQUEST_PREFIX,
} from './mapRequests'

describe('parseWorkshopLink', () => {
  it('понимает обычную ссылку на мод', () => {
    expect(
      parseWorkshopLink('https://steamcommunity.com/sharedfiles/filedetails/?id=1234567890')
    ).toEqual({
      id: '1234567890',
      url: 'https://steamcommunity.com/sharedfiles/filedetails/?id=1234567890',
    })
  })

  it('понимает ссылку без https, с лишними параметрами и пробелами', () => {
    expect(
      parseWorkshopLink('  steamcommunity.com/sharedfiles/filedetails/?l=russian&id=987654321&searchtext=map  ')
        ?.id
    ).toBe('987654321')
  })

  it('понимает steam:// и просто номер', () => {
    expect(parseWorkshopLink('steam://url/CommunityFilePage/1122334455')?.id).toBe('1122334455')
    expect(parseWorkshopLink('1122334455')?.id).toBe('1122334455')
  })

  it('отвергает чужое', () => {
    expect(parseWorkshopLink('')).toBeNull()
    expect(parseWorkshopLink('https://example.com/?id=123456789')).toBeNull()
    expect(parseWorkshopLink('https://steamcommunity.com/id/someone')).toBeNull()
    expect(parseWorkshopLink('12')).toBeNull()
  })
})

describe('buildIssueUrl', () => {
  const link = { id: '1234567890', url: 'https://steamcommunity.com/sharedfiles/filedetails/?id=1234567890' }

  it('ведёт на форму заявки репозитория с префиксом в заголовке', () => {
    const url = new URL(buildIssueUrl(link, 'Malden'))
    expect(url.origin + url.pathname).toBe(`https://github.com/${REPO}/issues/new`)
    expect(url.searchParams.get('title')).toBe(`${REQUEST_PREFIX} Malden`)
    expect(url.searchParams.get('body')).toContain(link.url)
    expect(url.searchParams.get('body')).toContain('Name: Malden')
  })

  it('без названия подставляет номер мода', () => {
    const url = new URL(buildIssueUrl(link, '  '))
    expect(url.searchParams.get('title')).toBe(`${REQUEST_PREFIX} workshop 1234567890`)
    expect(url.searchParams.get('body')).not.toContain('Name:')
  })
})

describe('parseRequests', () => {
  const item = (over: Record<string, unknown>) => ({
    id: 1,
    title: `${REQUEST_PREFIX} Map`,
    html_url: 'https://github.com/x/y/issues/1',
    body: 'Workshop: https://steamcommunity.com/sharedfiles/filedetails/?id=555666777',
    reactions: { '+1': 0 },
    ...over,
  })

  it('считает голоса: заявитель плюс 👍 и сортирует по убыванию', () => {
    const list = parseRequests({
      items: [
        item({ id: 1, title: `${REQUEST_PREFIX} A`, reactions: { '+1': 2 } }),
        item({ id: 2, title: `${REQUEST_PREFIX} B`, reactions: { '+1': 7 } }),
        item({ id: 3, title: `${REQUEST_PREFIX} C` }),
      ],
    })
    expect(list.map((r) => [r.name, r.votes])).toEqual([
      ['B', 8],
      ['A', 3],
      ['C', 1],
    ])
  })

  it('достаёт номер мода из тела заявки', () => {
    expect(parseRequests({ items: [item({})] })[0].workshopId).toBe('555666777')
    expect(parseRequests({ items: [item({ body: 'nothing' })] })[0].workshopId).toBeNull()
  })

  it('пропускает чужие заголовки, pull request и мусор', () => {
    expect(
      parseRequests({
        items: [
          item({ id: 1, title: 'Bug: crash' }),
          item({ id: 2, pull_request: {} }),
          { id: 'x' },
          null,
        ],
      })
    ).toEqual([])
  })

  it('не падает на неожиданном ответе', () => {
    expect(parseRequests(null)).toEqual([])
    expect(parseRequests({})).toEqual([])
    expect(parseRequests({ items: 5 })).toEqual([])
  })
})
