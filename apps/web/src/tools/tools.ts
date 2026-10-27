import {
  PLACEABLE_SPECS,
  isOasisPlaceable,
  ZoneDensity,
  ZoneType,
  type Area,
  type PlaceableKind,
  type ToolCommand,
} from '@city/shared';

export type ToolGroup = 'inspect' | 'transport' | 'zones' | 'utilities' | 'services' | 'terrain';

export type ToolId =
  | 'select'
  | 'road'
  | 'powerLine'
  | 'pipe'
  | 'canal'
  | 'zoneResLight'
  | 'zoneResDense'
  | 'zoneComLight'
  | 'zoneComDense'
  | 'zoneIndLight'
  | 'zoneIndDense'
  | 'dezone'
  | 'demolish'
  | 'level'
  | 'raise'
  | 'lower'
  | 'trees'
  | PlaceableKind;

/** `path` = L-shaped drag, `rect` = rectangle drag, `footprint` = single click placement. */
export type ToolShape = 'none' | 'path' | 'rect' | 'footprint';

export interface ToolDef {
  id: ToolId;
  group: ToolGroup;
  shape: ToolShape;
  hotkey?: string;
  /** Footprint size for placement tools. */
  size: number;
  /** Shows the underground (pipes) view while active. */
  underground?: boolean;
  /** Only offered when the city runs this ruleset; absent means both. */
  only?: 'oasis';
  command(area: Area): ToolCommand | null;
}

const zone =
  (type: ZoneType, density: ZoneDensity) =>
  (area: Area): ToolCommand => ({ type: 'zone', zone: type, density, ...area });

const place =
  (kind: PlaceableKind) =>
  (area: Area): ToolCommand => {
    const offset = Math.floor((PLACEABLE_SPECS[kind].size - 1) / 2);
    return { type: 'place', kind, x: area.x1 - offset, y: area.y1 - offset };
  };

function def(
  id: ToolId,
  group: ToolGroup,
  shape: ToolShape,
  command: (area: Area) => ToolCommand | null,
  extra: Partial<ToolDef> = {},
): ToolDef {
  return { id, group, shape, size: 1, command, ...extra };
}

const placeDef = (kind: PlaceableKind, group: ToolGroup, hotkey?: string): ToolDef =>
  def(kind, group, 'footprint', place(kind), {
    size: PLACEABLE_SPECS[kind].size,
    ...(hotkey ? { hotkey } : {}),
    ...(isOasisPlaceable(kind) ? { only: 'oasis' as const } : {}),
  });

export const TOOLS: readonly ToolDef[] = [
  def('select', 'inspect', 'none', () => null, { hotkey: 'q' }),
  def('road', 'transport', 'path', (a) => ({ type: 'road', ...a }), { hotkey: 'r' }),
  placeDef('marina', 'transport'),
  placeDef('airport', 'transport'),
  def('zoneResLight', 'zones', 'rect', zone(ZoneType.Residential, ZoneDensity.Light), {
    hotkey: '1',
  }),
  def('zoneResDense', 'zones', 'rect', zone(ZoneType.Residential, ZoneDensity.Dense), {
    hotkey: '2',
  }),
  def('zoneComLight', 'zones', 'rect', zone(ZoneType.Commercial, ZoneDensity.Light), {
    hotkey: '3',
  }),
  def('zoneComDense', 'zones', 'rect', zone(ZoneType.Commercial, ZoneDensity.Dense), {
    hotkey: '4',
  }),
  def('zoneIndLight', 'zones', 'rect', zone(ZoneType.Industrial, ZoneDensity.Light), {
    hotkey: '5',
  }),
  def('zoneIndDense', 'zones', 'rect', zone(ZoneType.Industrial, ZoneDensity.Dense), {
    hotkey: '6',
  }),
  def('dezone', 'zones', 'rect', zone(ZoneType.None, ZoneDensity.None), { hotkey: '0' }),
  def('powerLine', 'utilities', 'path', (a) => ({ type: 'powerLine', ...a }), { hotkey: 'e' }),
  placeDef('coalPlant', 'utilities'),
  placeDef('gasPlant', 'utilities'),
  placeDef('windTurbine', 'utilities'),
  def('pipe', 'utilities', 'path', (a) => ({ type: 'pipe', ...a }), {
    hotkey: 't',
    underground: true,
  }),
  def('canal', 'utilities', 'path', (a) => ({ type: 'canal', ...a }), {
    hotkey: 'y',
    only: 'oasis',
  }),
  placeDef('waterPump', 'utilities'),
  placeDef('well', 'utilities'),
  placeDef('policeStation', 'services'),
  placeDef('fireStation', 'services'),
  placeDef('school', 'services'),
  placeDef('hospital', 'services'),
  placeDef('park', 'services'),
  // Oasis-only infrastructure; hidden from the classic Urbe toolbar.
  placeDef('qanat', 'utilities'),
  placeDef('cistern', 'utilities'),
  placeDef('windbreak', 'services'),
  placeDef('arcade', 'transport'),
  placeDef('caravanserai', 'services'),
  placeDef('caravanStop', 'transport'),
  placeDef('springHouse', 'utilities'),
  placeDef('palm', 'utilities'),
  // Oasis era works, one of each per city, unlocked by era titles.
  placeDef('rechargeBasin', 'utilities'),
  placeDef('grandBazaar', 'services'),
  placeDef('palaceGarden', 'services'),
  def('demolish', 'terrain', 'rect', (a) => ({ type: 'demolish', ...a }), { hotkey: 'b' }),
  def('level', 'terrain', 'rect', (a) => ({ type: 'level', ...a }), { hotkey: 'n' }),
  def('raise', 'terrain', 'rect', (a) => ({ type: 'raise', ...a }), { hotkey: 'h' }),
  def('lower', 'terrain', 'rect', (a) => ({ type: 'lower', ...a })),
  def('trees', 'terrain', 'rect', (a) => ({ type: 'plantTrees', ...a }), { hotkey: 'f' }),
];

export const TOOL_GROUPS: readonly ToolGroup[] = [
  'inspect',
  'transport',
  'zones',
  'utilities',
  'services',
  'terrain',
];

const BY_ID = new Map(TOOLS.map((tool) => [tool.id, tool]));

export function toolById(id: ToolId): ToolDef {
  const tool = BY_ID.get(id);
  if (!tool) throw new Error(`Unknown tool ${id}`);
  return tool;
}

export function toolByHotkey(key: string, ruleset: 'classic' | 'oasis' = 'classic'): ToolDef | undefined {
  return toolsFor(ruleset).find((tool) => tool.hotkey === key);
}

/** Tools offered by a ruleset: `oasis` sees every tool, `classic` hides the Oasis-only ones. */
export function toolsFor(ruleset: 'classic' | 'oasis'): readonly ToolDef[] {
  return ruleset === 'oasis' ? TOOLS : TOOLS.filter((tool) => tool.only !== 'oasis');
}
