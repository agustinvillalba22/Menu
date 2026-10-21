// --- Staff -------------------------------------------------------------
// Identification-only roster — no relation to auth, no permissions gated by
// `position`.

export type StaffPosition = 'mozo' | 'bartender' | 'jefe_cocina' | 'cajero' | 'gerente'

export interface StaffMember {
  id: string
  name: string
  position: StaffPosition
  pin: string
  active: boolean
}

export interface StaffMemberCreatePayload {
  name: string
  position: StaffPosition
  pin: string
}

export interface StaffMemberUpdatePayload {
  name?: string
  position?: StaffPosition
  pin?: string
  active?: boolean
}
