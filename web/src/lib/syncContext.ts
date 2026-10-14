import { createContext, useContext } from 'react'

import type { SyncRole, SyncServerId, SyncSolution } from './sync'

export type SyncStatus = 'off' | 'connecting' | 'online' | 'offline' | 'error'

export interface SyncPeer {
  id: string
  role: SyncRole
  lastSeen: number
}

export interface RemoteSolution {
  solution: SyncSolution | null
  // Когда наводчик отправил и когда пришло сюда, мс
  sentAt: number
  receivedAt: number
}

export interface SyncApi {
  enabled: boolean
  role: SyncRole
  code: string
  server: SyncServerId
  // Позывной — подпись к своим меткам
  callsign: string
  status: SyncStatus
  // Связь включена и брокер на связи
  active: boolean
  // Другие устройства в комнате, которые недавно отзывались
  peers: SyncPeer[]
  // Последнее решение от наводчика (для стрелка)
  remote: RemoteSolution | null
  // Когда наводчик последний раз отправил решение
  lastSharedAt: number | null
  setRole: (role: SyncRole) => void
  setCode: (code: string) => void
  setServer: (server: SyncServerId) => void
  setCallsign: (callsign: string) => void
  connect: () => void
  disconnect: () => void
  // Наводчик: текущее решение (повторы без изменений не отправляются)
  shareSolution: (solution: SyncSolution | null) => void
  // Выстрел: у остальных запускается отсчёт до разрыва
  sendShot: () => void
  // Выстрел с другого устройства; возвращает отписку
  onShot: (handler: () => void) => () => void
}

const noop = () => {}

export const SyncContext = createContext<SyncApi>({
  enabled: false,
  role: 'computer',
  code: '',
  server: 'hivemq',
  callsign: '',
  status: 'off',
  active: false,
  peers: [],
  remote: null,
  lastSharedAt: null,
  setRole: noop,
  setCode: noop,
  setServer: noop,
  setCallsign: noop,
  connect: noop,
  disconnect: noop,
  shareSolution: noop,
  sendShot: noop,
  onShot: () => noop,
})

export function useSync(): SyncApi {
  return useContext(SyncContext)
}

export function syncStatusText(status: SyncStatus, ru: boolean): string {
  switch (status) {
    case 'off':
      return ru ? 'выключена' : 'off'
    case 'connecting':
      return ru ? 'подключение…' : 'connecting…'
    case 'online':
      return ru ? 'на связи' : 'online'
    case 'offline':
      return ru ? 'нет сети' : 'offline'
    case 'error':
      return ru ? 'ошибка связи' : 'connection error'
  }
}

export function syncStatusColor(status: SyncStatus): string {
  return status === 'online'
    ? 'bg-emerald-500'
    : status === 'connecting'
      ? 'bg-amber-500'
      : status === 'off'
        ? 'bg-app-muted'
        : 'bg-red-500'
}
