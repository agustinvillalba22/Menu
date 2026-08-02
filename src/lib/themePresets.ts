import type { FontFamily } from './types'

/**
 * Curated palette presets for the appearance page (Fase 1b — P1).
 *
 * Each preset packs a coherent `{ primary, secondary, font }` triple together
 * so a restaurant owner can land a usable look in one click instead of
 * picking two hexes blind. The existing raw `<input type="color">` and the
 * `<select>` font picker on the page stay as a manual "tweak" escape hatch:
 * clicking a preset just initializes all three state vars, after which the
 * owner can still adjust a single channel and PATCH only that field (the
 * existing PATCH-only-modified-fields behavior is preserved).
 *
 * No new font is introduced beyond the `FontFamily` enum (`Inter`,
 * `Playfair Display`, `Poppins`, `DM Sans`) — the matching Google Fonts CSS
 * imports for the three missing ones are added in `src/index.css`.
 */
export interface ThemePreset {
  id: string
  name: string
  primary_color: string
  secondary_color: string
  font_family: FontFamily
  /** Short, owner-facing subtitle shown under the preset name in the grid. */
  description: string
}

export const THEME_PRESETS: readonly ThemePreset[] = [
  {
    id: 'clasico',
    name: 'Clásico',
    primary_color: '#FC462F',
    secondary_color: '#FFE0E0',
    font_family: 'Inter',
    description: 'Rojo cálido sobre rosa pálido, sans neutra.',
  },
  {
    id: 'moderno',
    name: 'Moderno',
    primary_color: '#1F2937',
    secondary_color: '#F3F4F6',
    font_family: 'Inter',
    description: 'Carbón sobre gris humo — limpio y serio.',
  },
  {
    id: 'mediterraneo',
    name: 'Mediterráneo',
    primary_color: '#0F766E',
    secondary_color: '#FEF3C7',
    font_family: 'Playfair Display',
    description: 'Teal profundo + crema, serif editorial.',
  },
  {
    id: 'cafeteria',
    name: 'Cafetería',
    primary_color: '#7C2D12',
    secondary_color: '#FED7AA',
    font_family: 'Playfair Display',
    description: 'Marrón tostado y damasco, tono barista.',
  },
  {
    id: 'fresco',
    name: 'Fresco',
    primary_color: '#2563EB',
    secondary_color: '#DBEAFE',
    font_family: 'Poppins',
    description: 'Azul electrico y celeste, pops amigables.',
  },
  {
    id: 'citrico',
    name: 'Cítrico',
    primary_color: '#F59E0B',
    secondary_color: '#FEF3C7',
    font_family: 'Poppins',
    description: 'Ambar y vainilla, luminoso y juguetón.',
  },
  {
    id: 'elegante',
    name: 'Elegante',
    primary_color: '#111827',
    secondary_color: '#FBBF24',
    font_family: 'DM Sans',
    description: 'Negro y oro — comedor nocturno.',
  },
  {
    id: 'sabor',
    name: 'Sabor',
    primary_color: '#DB2777',
    secondary_color: '#FCE7F3',
    font_family: 'DM Sans',
    description: 'Magenta y rosa palo, heladería y postres.',
  },
] as const