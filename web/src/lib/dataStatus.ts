import { t, type MessageKey } from '../i18n'
import type { DataStatus } from '../types/artillery'

export const DATA_STATUS_HINTS: Record<DataStatus, MessageKey> = {
  verified: 'dataStatus.verified-hint',
  'in-progress': 'dataStatus.in-progress-hint',
  pending: 'dataStatus.pending-hint',
}

/** Название статуса для списков: «проверено в игре» или «не проверено». */
export function dataStatusLabel(status: DataStatus): string {
  return status === 'verified' ? t('dataStatus.verified') : t('dataStatus.unverified')
}
