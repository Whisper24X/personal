import type { MenuItem } from './use-layout-types'

/** SVG path segments per sidebar menu id (lucide-style paths for inline SVG). */
export const LAYOUT_MENU_ICON_PATHS: Record<MenuItem['id'], string[]> = {
  dashboard: ['M3 3h8v8H3z', 'M13 3h8v5h-8z', 'M13 10h8v11h-8z', 'M3 13h8v8H3z'],
  workflow: ['M5 6h14', 'M5 18h14', 'M12 6v12', 'm8 10 4-4 4 4', 'm8 14 4 4 4-4'],
  tasks: ['m9 11 2 2 4-4', 'M5 11h.01', 'M5 18h.01', 'm9 18 2 2 4-4', 'M14 11h5', 'M14 18h5', 'M3 6h18'],
  goals: ['M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2', 'M12 8v8', 'M8 12h8'],
  knowledge: [
    'M4 19.5A2.5 2.5 0 0 1 6.5 17H20',
    'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
    'M8 7h8',
    'M8 11h8',
  ],
  kanban: ['M4 5h6v14H4z', 'M14 5h6v8h-6z', 'M14 15h6v4h-6z'],
  automations: ['M12 7v5l3 3', 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z'],
  skills: [
    'M12 3v4',
    'M12 17v4',
    'M4.93 4.93l2.83 2.83',
    'M16.24 16.24l2.83 2.83',
    'M3 12h4',
    'M17 12h4',
    'M4.93 19.07l2.83-2.83',
    'M16.24 7.76l2.83-2.83',
  ],
  mcp: [
    'M5 3h14a2 2 0 0 1 2 2v3H3V5a2 2 0 0 1 2-2z',
    'M3 10h18v4H3z',
    'M3 16h18v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    'M7 6h.01',
    'M7 12h.01',
    'M7 18h.01',
  ],
  git: ['M4 12h9', 'M8 8l-4 4 4 4', 'M12 6h8', 'M16 2l4 4-4 4', 'M12 18h8', 'M16 14l4 4-4 4'],
}
