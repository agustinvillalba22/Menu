// --- Turnos de caja ---------------------------------------------------
// Amounts are decimal strings, never floats.

export interface CashShift {
  id: string
  opened_by_name: string
  opened_at: string
  opening_amount: string
  closed_by_name: string | null
  closed_at: string | null
  counted_amount: string | null
  expected_amount: string | null
  difference: string | null
  notes: string | null
  orders_count: number
}

export interface CashShiftOpenPayload {
  staff_member_id: string
  opening_amount: string
  notes?: string | null
}

export interface CashShiftClosePayload {
  staff_member_id: string
  counted_amount: string
  notes?: string | null
}
