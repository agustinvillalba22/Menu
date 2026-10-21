import type { OrderRead } from './order'

// --- Mesas -------------------------------------------------------------

export interface Table {
  id: string
  number: number
  capacity: number | null
  bill_requested_at?: string | null
}

// Estado operativo de una mesa (GET /tables/occupancy).
export type TableStatus = 'free' | 'occupied' | 'bill'

export interface TableOccupancy {
  id: string
  number: number
  capacity: number | null
  status: TableStatus
  total: string
  first_order_at: string | null
  bill_requested_at: string | null
  orders: OrderRead[]
}

export interface TableCreatePayload {
  number: number
  capacity?: number | null
}

export interface TableUpdatePayload {
  number?: number
  capacity?: number | null
}
