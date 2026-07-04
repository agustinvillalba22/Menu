import { apiGet } from './api'
import type { PublicMenuResponse } from './types'

export function getPublicMenu(qrToken: string): Promise<PublicMenuResponse> {
  return apiGet<PublicMenuResponse>(`/menu/${qrToken}`)
}
