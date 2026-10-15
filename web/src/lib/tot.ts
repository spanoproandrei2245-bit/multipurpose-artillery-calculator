/**
 * Огонь по времени (TOT, time on target): задан момент разрыва —
 * выстрел в момент «разрыв − время полёта». Время — по часам
 * устройства (на телефонах и ПК они сверяются по сети).
 */

const SECOND = 1000
const MINUTE = 60 * SECOND
const DAY = 24 * 60 * MINUTE

/** Момент выстрела для разрыва в impactAt, мс. */
export function fireMoment(impactAt: number, tofS: number): number {
  return impactAt - tofS * SECOND
}

/**
 * Ближайшее «круглое» время разрыва: не раньше чем через leadS секунд
 * на подготовку плюс время полёта, кратно stepS секундам.
 */
export function suggestImpactTime(
  now: number,
  tofS: number,
  leadS = 30,
  stepS = 10
): number {
  const earliest = now + (leadS + tofS) * SECOND
  const step = stepS * SECOND
  return Math.ceil(earliest / step) * step
}

/**
 * Время разрыва из строки «18:30», «18:30:15» или «183015»
 * (часы устройства). Ближайшее такое время: если сегодня оно
 * прошло больше пяти минут назад — завтра. null — не время.
 */
export function parseClock(text: string, now: number): number | null {
  const trimmed = text.trim()
  let parts: number[]
  if (/^\d{4}$|^\d{6}$/.test(trimmed)) {
    parts = trimmed.match(/\d{2}/g)!.map(Number)
  } else if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    parts = trimmed.split(':').map(Number)
  } else {
    return null
  }
  const [hours, minutes, seconds = 0] = parts
  if (hours > 23 || minutes > 59 || seconds > 59) return null

  const date = new Date(now)
  date.setHours(hours, minutes, seconds, 0)
  let at = date.getTime()
  if (at < now - 5 * MINUTE) at += DAY
  return at
}

const pad = (value: number) => String(value).padStart(2, '0')

/** «18:30:05» по часам устройства. */
export function formatClock(ms: number): string {
  const date = new Date(ms)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** «18:29:41.2» — момент выстрела с десятыми. */
export function formatClockTenths(ms: number): string {
  const tenths = Math.floor((((ms % SECOND) + SECOND) % SECOND) / 100)
  return `${formatClock(ms)}.${tenths}`
}
