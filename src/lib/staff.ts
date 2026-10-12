import { apiDelete, apiGet, apiPatch, apiPost } from './api'
import type { StaffMember, StaffMemberCreatePayload, StaffMemberUpdatePayload } from './types'

export function listStaffMembers(restaurantId: string): Promise<StaffMember[]> {
  return apiGet<StaffMember[]>(`/restaurants/${restaurantId}/staff`)
}

export function createStaffMember(
  restaurantId: string,
  data: StaffMemberCreatePayload,
): Promise<StaffMember> {
  return apiPost<StaffMember>(`/restaurants/${restaurantId}/staff`, data)
}

export function updateStaffMember(
  restaurantId: string,
  staffMemberId: string,
  data: StaffMemberUpdatePayload,
): Promise<StaffMember> {
  return apiPatch<StaffMember>(`/restaurants/${restaurantId}/staff/${staffMemberId}`, data)
}

export function deleteStaffMember(restaurantId: string, staffMemberId: string): Promise<void> {
  return apiDelete<void>(`/restaurants/${restaurantId}/staff/${staffMemberId}`)
}
