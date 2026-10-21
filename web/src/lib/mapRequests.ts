/**
 * Заявки на новые карты. У приложения нет своего сервера, поэтому заявки
 * живут в Issues репозитория: «предложить» открывает готовую заявку,
 * «голос» — это 👍 на её странице, а список и счётчик берутся из
 * публичного API GitHub.
 */

export const REPO = 'spanoproandrei2245-bit/multipurpose-artillery-calculator'
export const REQUEST_PREFIX = '[Map request]'

export interface WorkshopLink {
  id: string
  url: string
}

function linkFor(id: string): WorkshopLink {
  return {
    id,
    url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${id}`,
  }
}

/** Ссылка на мод в Steam Workshop → номер мода и «чистая» ссылка; иначе null. */
export function parseWorkshopLink(input: string): WorkshopLink | null {
  const text = input.trim()
  if (!text) return null
  // Только номер мода тоже годится
  const bare = text.match(/^\d{6,12}$/)
  if (bare) return linkFor(bare[0])
  const match = text.match(
    /^(?:https?:\/\/)?(?:www\.)?steamcommunity\.com\/(?:sharedfiles|workshop)\/filedetails\/?\?(?:[^#\s]*&)?id=(\d{6,12})(?:[&#].*)?$/i
  )
  if (match) return linkFor(match[1])
  const proto = text.match(/^steam:\/\/url\/CommunityFilePage\/(\d{6,12})$/i)
  if (proto) return linkFor(proto[1])
  return null
}

/** Ссылка на готовую форму заявки (пользователь сам нажимает «Submit»). */
export function buildIssueUrl(link: WorkshopLink, name: string): string {
  const trimmed = name.trim()
  const label = trimmed || `workshop ${link.id}`
  const lines = [`Workshop: ${link.url}`]
  if (trimmed) lines.push(`Name: ${trimmed}`)
  lines.push('', 'Please add this map to the built-in maps.')
  const params = new URLSearchParams({
    title: `${REQUEST_PREFIX} ${label}`,
    body: lines.join('\n'),
  })
  return `https://github.com/${REPO}/issues/new?${params.toString()}`
}

export interface MapRequest {
  id: number
  // Название из заголовка заявки без префикса
  name: string
  // Страница заявки на GitHub: там голосуют 👍
  issueUrl: string
  // Номер мода из тела заявки, если нашёлся
  workshopId: string | null
  // Заявитель сам «за» — плюс 👍 других
  votes: number
}

interface SearchItem {
  id?: unknown
  title?: unknown
  html_url?: unknown
  body?: unknown
  reactions?: { '+1'?: unknown }
  pull_request?: unknown
}

/** Разбор ответа поиска GitHub в список заявок, по убыванию голосов. */
export function parseRequests(json: unknown): MapRequest[] {
  if (typeof json !== 'object' || json === null) return []
  const items = (json as { items?: unknown }).items
  if (!Array.isArray(items)) return []
  const result: MapRequest[] = []
  for (const raw of items as SearchItem[]) {
    if (typeof raw !== 'object' || raw === null) continue
    if (
      typeof raw.id !== 'number' ||
      typeof raw.title !== 'string' ||
      typeof raw.html_url !== 'string' ||
      raw.pull_request !== undefined ||
      !raw.title.startsWith(REQUEST_PREFIX)
    ) {
      continue
    }
    const body = typeof raw.body === 'string' ? raw.body : ''
    const workshop = body.match(/filedetails\/?\?id=(\d{6,12})/i)
    const plus = raw.reactions?.['+1']
    result.push({
      id: raw.id,
      name: raw.title.slice(REQUEST_PREFIX.length).trim() || '—',
      issueUrl: raw.html_url,
      workshopId: workshop ? workshop[1] : null,
      votes: 1 + (typeof plus === 'number' && plus > 0 ? plus : 0),
    })
  }
  return result.sort((a, b) => b.votes - a.votes)
}

const CACHE_KEY = 'mapRequestsCache'
const CACHE_MS = 5 * 60_000

/** Открытые заявки; ответ на 5 минут запоминается (у API лимит запросов). */
export async function fetchRequests(force = false): Promise<MapRequest[]> {
  if (!force) {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? 'null') as {
        at: number
        items: MapRequest[]
      } | null
      if (cached && Date.now() - cached.at < CACHE_MS) return cached.items
    } catch {
      // Кэша нет — идём в сеть
    }
  }
  const q = `repo:${REPO} is:issue is:open in:title "${REQUEST_PREFIX}"`
  const response = await fetch(
    `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=50`,
    { headers: { Accept: 'application/vnd.github+json' } }
  )
  if (!response.ok) throw new Error(`GitHub ${response.status}`)
  const items = parseRequests(await response.json())
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), items }))
  } catch {
    // Не страшно
  }
  return items
}
