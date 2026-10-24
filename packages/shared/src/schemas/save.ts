import {
  base64ToBytes,
  bytesToBase64,
  decodeEnvelope,
  encodeEnvelope,
  isRecord,
  type SaveEnvelope,
  type SaveError,
  type SaveMigration,
} from '@shell/kernel';
import { BALANCE, DEPARTMENTS, TICKS_PER_MONTH } from '../balance/balance';
import { JOURNEY_CHAPTERS, OASIS_JOURNEY, OASIS_SAVE_MAX_LEVEL } from '../balance/oasis';
import type { DisasterKind } from '../commands/commands';
import { PLACEABLE_KINDS, ZONE_BUILDING_KINDS, type BuildingRecord } from '../types/buildings';
import type { JourneyState, OasisState } from '../types/oasis';
import { isRuleset } from '../types/ruleset';
import { EXPENSE_CATEGORIES } from '../types/stats';
import { INFLUENCE_LAYERS, STRUCTURE_LAYERS } from '../types/tiles';
import type { EngineSnapshot, SnapshotLayer } from './snapshot';

export {
  canonicalJson,
  saveChecksum,
  stringifySave,
  type SaveError,
  type SaveErrorCode,
  type SaveMigration,
} from '@shell/kernel';

export const SAVE_FORMAT = 'city-builder-save';
/**
 * Bump when the layout of `SaveState` changes, and register a migration from the old version.
 * v2 adds `ruleset` (absent in v1 saves, which were all classic).
 */
export const SAVE_VERSION = 2;
export const SAVE_FILE_EXTENSION = '.city.json';
/** Urbe Oasis envelope: same schema, its own format and extension. */
export const OASIS_SAVE_FORMAT = 'oasis-city-save';
export const OASIS_SAVE_FILE_EXTENSION = '.oasis.json';

/** Every city envelope this project writes. A file is accepted if its format is in this list. */
export const KNOWN_SAVE_FORMATS: readonly string[] = [SAVE_FORMAT, OASIS_SAVE_FORMAT];

/** Summary stored next to the state so save lists do not need to decode the whole file. */
export interface SaveMeta {
  name: string;
  seed: string;
  size: number;
  tick: number;
  population: number;
  funds: number;
  /** ISO 8601 timestamp supplied by the host (the simulation has no clock). */
  savedAt: string;
}

/** JSON form of `EngineSnapshot`: byte layers are base64 strings. */
export type SaveState = Omit<EngineSnapshot, 'heights' | 'layers'> & {
  heights: string;
  /** `linked` is optional: classic cities omit it, and older neon saves load without it. */
  layers: Record<SnapshotLayer, string> & { linked?: string };
};

export type SaveFile = SaveEnvelope<typeof SAVE_FORMAT, SaveMeta, SaveState>;

export type DecodeResult =
  | { ok: true; snapshot: EngineSnapshot; meta: SaveMeta; migratedFrom: number | null }
  | { ok: false; errors: SaveError[] };

/**
 * v1 → v2: every pre-ruleset city is classic. The checksum is recomputed by the envelope decoder
 * before this runs, so the migration only fills the new field.
 */
export const SAVE_MIGRATIONS: Readonly<Record<number, SaveMigration>> = {
  1: (file) => {
    const state = isRecord(file.state) ? file.state : {};
    return { ...file, state: { ...state, ruleset: 'classic' } };
  },
};

export interface DecodeOptions {
  /** Defaults to `SAVE_MIGRATIONS` and `SAVE_VERSION`; tests inject their own. */
  migrations?: Readonly<Record<number, SaveMigration>>;
  currentVersion?: number;
  /** Envelope format. Urbe Oasis passes `OASIS_SAVE_FORMAT` for its exported files. */
  format?: string;
  /**
   * Formats the decoder accepts. Defaults to every known city format, so a classic city opens
   * in Urbe Oasis and vice versa; the `ruleset` inside the file decides the rules it runs under.
   */
  acceptFormats?: readonly string[];
}

export const SNAPSHOT_LAYERS: readonly SnapshotLayer[] = [...STRUCTURE_LAYERS, ...INFLUENCE_LAYERS];

export function encodeSave(
  snapshot: EngineSnapshot,
  extra: Pick<SaveMeta, 'population' | 'funds' | 'savedAt'>,
  options: { format?: string } = {},
): SaveEnvelope<string, SaveMeta, SaveState> {
  const layers = {} as SaveState['layers'];
  for (const name of SNAPSHOT_LAYERS) layers[name] = bytesToBase64(snapshot.layers[name]);
  if (snapshot.layers.linked) layers.linked = bytesToBase64(snapshot.layers.linked);
  const state: SaveState = {
    name: snapshot.name,
    ruleset: snapshot.ruleset ?? 'classic',
    seed: snapshot.seed,
    size: snapshot.size,
    tick: snapshot.tick,
    rng: [...snapshot.rng],
    heights: bytesToBase64(snapshot.heights),
    layers,
    buildings: snapshot.buildings.map((b) => ({ ...b })),
    nextBuildingId: snapshot.nextBuildingId,
    economy: JSON.parse(JSON.stringify(snapshot.economy)) as SaveState['economy'],
    demand: { ...snapshot.demand },
    history: snapshot.history.map((h) => ({ ...h })),
    disasters: snapshot.disasters.map((d) => ({ ...d })),
    disastersEnabled: snapshot.disastersEnabled,
    networksDirty: snapshot.networksDirty,
    lastMilestone: snapshot.lastMilestone,
    ...(snapshot.oasis ? { oasis: JSON.parse(JSON.stringify(snapshot.oasis)) as OasisState } : {}),
  };
  return encodeEnvelope(
    options.format ?? SAVE_FORMAT,
    SAVE_VERSION,
    {
      name: snapshot.name,
      seed: snapshot.seed,
      size: snapshot.size,
      tick: snapshot.tick,
      ...extra,
    },
    state,
  );
}

/**
 * Parses, verifies, migrates and validates a save. A failed decode never throws.
 *
 * The envelope format is checked against `options.format` only when the caller demands a strict
 * match. By default any known city format is accepted, because a classic city is a perfectly
 * valid city to open in Urbe Oasis: the `ruleset` stored inside the file decides which rules it runs
 * under, not the app that happens to open it.
 */
export function decodeSave(text: string, options: DecodeOptions = {}): DecodeResult {
  const decoded = decodeEnvelope(text, {
    format: options.format ?? SAVE_FORMAT,
    currentVersion: options.currentVersion ?? SAVE_VERSION,
    migrations: options.migrations ?? SAVE_MIGRATIONS,
    acceptFormats: options.acceptFormats ?? KNOWN_SAVE_FORMATS,
  });
  if (!decoded.ok) return decoded;
  const v = new Validator();
  const snapshot = v.state(decoded.file.state);
  if (!snapshot || v.errors.length > 0) return { ok: false, errors: v.errors };
  return {
    ok: true,
    snapshot,
    meta: metaOf(decoded.file.meta, snapshot),
    migratedFrom: decoded.migratedFrom,
  };
}

function metaOf(raw: unknown, snapshot: EngineSnapshot): SaveMeta {
  const m = isRecord(raw) ? raw : {};
  const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
  return {
    name: snapshot.name,
    seed: snapshot.seed,
    size: snapshot.size,
    tick: snapshot.tick,
    population: num(m.population),
    funds: typeof m.funds === 'number' ? m.funds : snapshot.economy.funds,
    savedAt: typeof m.savedAt === 'string' ? m.savedAt : '',
  };
}

const BUILDING_KINDS = new Set<string>([...ZONE_BUILDING_KINDS, ...PLACEABLE_KINDS]);
const DISASTER_KINDS = new Set<DisasterKind>([
  'fire',
  'flood',
  'earthquake',
  'crisis',
  'blackout',
  'epidemic',
]);
const MAX_ERRORS = 20;
const MAX_SIZE = 512;

/** Structural validation of a `SaveState`, collecting every problem (up to a limit). */
class Validator {
  readonly errors: SaveError[] = [];

  error(path: string, problem: string): void {
    if (this.errors.length < MAX_ERRORS) {
      this.errors.push({ code: 'INVALID', detail: `${path}: ${problem}` });
    }
  }

  int(value: unknown, path: string, min: number, max = Number.MAX_SAFE_INTEGER): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
      this.error(path, `expected an integer in [${min}, ${max}]`);
      return min;
    }
    return value;
  }

  num(value: unknown, path: string, min = -Infinity, max = Infinity): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      this.error(path, `expected a number in [${min}, ${max}]`);
      return 0;
    }
    return value;
  }

  bool(value: unknown, path: string): boolean {
    if (typeof value !== 'boolean') this.error(path, 'expected a boolean');
    return value === true;
  }

  str(value: unknown, path: string): string {
    if (typeof value !== 'string') {
      this.error(path, 'expected a string');
      return '';
    }
    return value;
  }

  record(value: unknown, path: string): Record<string, unknown> {
    if (!isRecord(value)) {
      this.error(path, 'expected an object');
      return {};
    }
    return value;
  }

  array(value: unknown, path: string): unknown[] {
    if (!Array.isArray(value)) {
      this.error(path, 'expected an array');
      return [];
    }
    return value;
  }

  bytes(value: unknown, path: string, length: number): Uint8Array {
    if (typeof value !== 'string') {
      this.error(path, 'expected base64 data');
      return new Uint8Array(length);
    }
    try {
      const out = base64ToBytes(value);
      if (out.length !== length) this.error(path, `expected ${length} bytes, got ${out.length}`);
      return out.length === length ? out : new Uint8Array(length);
    } catch {
      this.error(path, 'invalid base64 data');
      return new Uint8Array(length);
    }
  }

  numbers<K extends string>(
    value: unknown,
    path: string,
    keys: readonly K[],
    min = -Infinity,
    max = Infinity,
  ) {
    const r = this.record(value, path);
    const out = {} as Record<K, number>;
    for (const k of keys) out[k] = this.num(r[k], `${path}.${k}`, min, max);
    return out;
  }

  state(value: unknown): EngineSnapshot | null {
    const s = this.record(value, 'state');
    const size = this.int(s.size, 'state.size', 8, MAX_SIZE);
    if (this.errors.length > 0) return null;
    const tiles = size * size;

    const rng = this.array(s.rng, 'state.rng');
    if (rng.length !== 4) this.error('state.rng', 'expected 4 integers');
    const rngState = [0, 1, 2, 3].map((k) =>
      this.int(rng[k], `state.rng[${k}]`, 0, 0xffffffff),
    ) as EngineSnapshot['rng'];
    if (rngState.every((x) => x === 0)) this.error('state.rng', 'all-zero generator state');

    const layersRaw = this.record(s.layers, 'state.layers');
    const layers = {} as EngineSnapshot['layers'];
    for (const name of SNAPSHOT_LAYERS) {
      layers[name] = this.bytes(layersRaw[name], `state.layers.${name}`, tiles);
    }
    if (layersRaw.linked !== undefined) {
      layers.linked = this.bytes(layersRaw.linked, 'state.layers.linked', tiles);
    }
    for (const name of Object.keys(layersRaw)) {
      if (name === 'linked') continue;
      if (!(SNAPSHOT_LAYERS as readonly string[]).includes(name)) {
        this.error(`state.layers.${name}`, 'unknown layer');
      }
    }

    const nextBuildingId = this.int(s.nextBuildingId, 'state.nextBuildingId', 1);
    const buildings = this.buildings(s.buildings, size, nextBuildingId);

    const e = this.record(s.economy, 'state.economy');
    const zones = ZONE_BUILDING_KINDS;
    const lastMonth = this.record(e.lastMonth, 'state.economy.lastMonth');
    const economy: EngineSnapshot['economy'] = {
      funds: this.num(e.funds, 'state.economy.funds'),
      constructionThisMonth: this.num(
        e.constructionThisMonth,
        'state.economy.constructionThisMonth',
        0,
      ),
      taxes: this.numbers(e.taxes, 'state.economy.taxes', zones, 0, BALANCE.economy.taxMax),
      funding: this.numbers(e.funding, 'state.economy.funding', DEPARTMENTS, 0, 100),
      lastMonth: {
        revenue: this.numbers(lastMonth.revenue, 'state.economy.lastMonth.revenue', zones),
        expenses: this.numbers(
          lastMonth.expenses,
          'state.economy.lastMonth.expenses',
          EXPENSE_CATEGORIES,
        ),
        construction: this.num(lastMonth.construction, 'state.economy.lastMonth.construction'),
        net: this.num(lastMonth.net, 'state.economy.lastMonth.net'),
      },
      monthsInDebt: this.int(e.monthsInDebt, 'state.economy.monthsInDebt', 0),
      bankrupt: this.bool(e.bankrupt, 'state.economy.bankrupt'),
    };

    const history = this.array(s.history, 'state.history').map((entry, k) =>
      this.numbers(entry, `state.history[${k}]`, HISTORY_KEYS),
    );
    const disasters = this.array(s.disasters, 'state.disasters').map((entry, k) => {
      const d = this.record(entry, `state.disasters[${k}]`);
      const kind = d.kind as DisasterKind;
      if (!DISASTER_KINDS.has(kind)) this.error(`state.disasters[${k}].kind`, 'unknown disaster');
      return {
        kind,
        remainingTicks: this.int(d.remainingTicks, `state.disasters[${k}].remainingTicks`, 0),
        x: this.int(d.x, `state.disasters[${k}].x`, 0, size - 1),
        y: this.int(d.y, `state.disasters[${k}].y`, 0, size - 1),
        targetId: this.int(d.targetId, `state.disasters[${k}].targetId`, 0),
      };
    });

    const ruleset = isRuleset(s.ruleset) ? s.ruleset : 'classic';
    if (s.ruleset !== undefined && !isRuleset(s.ruleset)) {
      this.error('state.ruleset', 'expected "classic" or "oasis"');
    }
    const snapshot: EngineSnapshot = {
      name: this.str(s.name, 'state.name'),
      ruleset,
      seed: this.str(s.seed, 'state.seed'),
      size,
      tick: this.int(s.tick, 'state.tick', 0),
      rng: rngState,
      heights: this.bytes(s.heights, 'state.heights', (size + 1) * (size + 1)),
      layers,
      buildings,
      nextBuildingId,
      economy,
      demand: this.numbers(s.demand, 'state.demand', zones, -10, 10),
      history: history as unknown as EngineSnapshot['history'],
      disasters,
      disastersEnabled: this.bool(s.disastersEnabled, 'state.disastersEnabled'),
      networksDirty: this.bool(s.networksDirty, 'state.networksDirty'),
      lastMilestone: this.int(s.lastMilestone, 'state.lastMilestone', 0),
      ...(s.oasis === undefined ? {} : { oasis: this.oasisState(s.oasis, size) }),
    };
    if ((snapshot.oasis?.waterPolicy?.rationedTicks ?? 0) > snapshot.tick % TICKS_PER_MONTH) {
      this.error(
        'state.oasis.waterPolicy.rationedTicks',
        'cannot exceed elapsed ticks in the current month',
      );
    }
    return this.errors.length > 0 ? null : snapshot;
  }

  /** Structural validation of the neon systems state. */
  oasisState(value: unknown, size: number): OasisState {
    const n = this.record(value, 'state.oasis');
    const caravans = this.array(n.caravans, 'state.oasis.caravans').map((entry, k) => {
      const c = this.record(entry, `state.oasis.caravans[${k}]`);
      return {
        id: this.int(c.id, `state.oasis.caravans[${k}].id`, 1),
        name: this.str(c.name, `state.oasis.caravans[${k}].name`),
        capital: this.num(c.capital, `state.oasis.caravans[${k}].capital`, 0),
        quadrant: this.int(c.quadrant, `state.oasis.caravans[${k}].quadrant`, 0, 3),
        holdings: this.int(c.holdings, `state.oasis.caravans[${k}].holdings`, 0),
      };
    });
    const cisterns = this.array(n.cisterns, 'state.oasis.cisterns').map((entry, k) => {
      const b = this.record(entry, `state.oasis.cisterns[${k}]`);
      return {
        buildingId: this.int(b.buildingId, `state.oasis.cisterns[${k}].buildingId`, 1),
        charge: this.num(b.charge, `state.oasis.cisterns[${k}].charge`, 0, 1),
      };
    });
    const storms = this.array(n.storms, 'state.oasis.storms').map((entry, k) => {
      const i = this.record(entry, `state.oasis.storms[${k}]`);
      return {
        buildingId: this.int(i.buildingId, `state.oasis.storms[${k}].buildingId`, 1),
        ticks: this.int(i.ticks, `state.oasis.storms[${k}].ticks`, 0),
        windbreak: this.num(i.windbreak, `state.oasis.storms[${k}].windbreak`, 0, 1),
        kind: this.str(i.kind, `state.oasis.storms[${k}].kind`),
      };
    });
    const journey =
      n.journey === undefined ? undefined : this.journey(n.journey, 'state.oasis.journey');
    const policy =
      n.waterPolicy === undefined
        ? undefined
        : this.record(n.waterPolicy, 'state.oasis.waterPolicy');
    return {
      ...(policy
        ? {
            waterPolicy: {
              rationing: this.bool(policy.rationing, 'state.oasis.waterPolicy.rationing'),
              rationedTicks: this.int(
                policy.rationedTicks,
                'state.oasis.waterPolicy.rationedTicks',
                0,
                TICKS_PER_MONTH,
              ),
            },
          }
        : {}),
      ...(journey ? { journey } : {}),
      caravans,
      cisterns,
      storms,
      parched: this.array(n.parched, 'state.oasis.parched').map((tile, k) =>
        this.int(tile, `state.oasis.parched[${k}]`, 0, size * size - 1),
      ),
      lastCaravanMonth: this.int(n.lastCaravanMonth, 'state.oasis.lastCaravanMonth', -1),
      lastStormMonth: this.int(n.lastStormMonth, 'state.oasis.lastStormMonth', -1),
      trade: this.num(n.trade, 'state.oasis.trade', 0),
      blocked: this.int(n.blocked, 'state.oasis.blocked', 0),
      springX:
        n.springX === undefined ? -1 : this.int(n.springX, 'state.oasis.springX', -1, size - 1),
      springY:
        n.springY === undefined ? -1 : this.int(n.springY, 'state.oasis.springY', -1, size - 1),
      lastSpringMonth:
        n.lastSpringMonth === undefined
          ? -1
          : this.int(n.lastSpringMonth, 'state.oasis.lastSpringMonth', -1),
    };
  }

  journey(value: unknown, path: string): JourneyState {
    const j = this.record(value, path);
    const chapter = this.int(j.chapter, `${path}.chapter`, 0, JOURNEY_CHAPTERS);
    const completedMonths = this.array(j.completedMonths, `${path}.completedMonths`).map(
      (month, k) => this.int(month, `${path}.completedMonths[${k}]`, 0),
    );
    if (completedMonths.length !== chapter)
      this.error(`${path}.completedMonths`, 'expected one month per completed chapter');
    const droughtMonthsLeft = this.int(
      j.droughtMonthsLeft,
      `${path}.droughtMonthsLeft`,
      0,
      OASIS_JOURNEY.droughtMonths,
    );
    return {
      chapter,
      completedMonths,
      droughtStart: this.int(j.droughtStart, `${path}.droughtStart`, -1),
      droughtMonthsLeft,
      droughtServed: this.int(
        j.droughtServed,
        `${path}.droughtServed`,
        0,
        1000 * OASIS_JOURNEY.droughtMonths,
      ),
      droughtOutcome: this.int(j.droughtOutcome, `${path}.droughtOutcome`, -1, 1),
    };
  }

  buildings(value: unknown, size: number, nextId: number): BuildingRecord[] {
    const occupied = new Int32Array(size * size);
    const ids = new Set<number>();
    return this.array(value, 'state.buildings').map((entry, k) => {
      const path = `state.buildings[${k}]`;
      const b = this.record(entry, path);
      const kind = b.kind as BuildingRecord['kind'];
      if (!BUILDING_KINDS.has(kind)) this.error(`${path}.kind`, 'unknown building kind');
      const id = this.int(b.id, `${path}.id`, 1, nextId - 1);
      if (ids.has(id)) this.error(`${path}.id`, 'duplicate id');
      ids.add(id);
      const w = this.int(b.w, `${path}.w`, 1, 8);
      const h = this.int(b.h, `${path}.h`, 1, 8);
      const x = this.int(b.x, `${path}.x`, 0, size - w);
      const y = this.int(b.y, `${path}.y`, 0, size - h);
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          const i = (y + dy) * size + x + dx;
          if (occupied[i] !== 0) this.error(path, `overlaps building ${occupied[i]}`);
          occupied[i] = id;
        }
      }
      return {
        id,
        kind,
        x,
        y,
        w,
        h,
        level: this.int(b.level, `${path}.level`, 0, OASIS_SAVE_MAX_LEVEL),
        capacity: this.num(b.capacity, `${path}.capacity`, 0),
        occupancy: this.num(b.occupancy, `${path}.occupancy`, 0),
        condition: this.num(b.condition, `${path}.condition`, 0, 100),
        age: this.int(b.age, `${path}.age`, 0),
        abandoned: this.bool(b.abandoned, `${path}.abandoned`),
        emptyMonths: this.int(b.emptyMonths, `${path}.emptyMonths`, 0),
        variant: this.int(b.variant, `${path}.variant`, 0),
        powered: this.bool(b.powered, `${path}.powered`),
        watered: this.bool(b.watered, `${path}.watered`),
        ...(b.linked === undefined ? {} : { linked: this.bool(b.linked, `${path}.linked`) }),
        offline: this.int(b.offline, `${path}.offline`, 0),
        attractiveness: this.num(b.attractiveness, `${path}.attractiveness`, 0, 1),
        ...(b.owner === undefined ? {} : { owner: this.int(b.owner, `${path}.owner`, 1) }),
      };
    });
  }
}

const HISTORY_KEYS = [
  'month',
  'population',
  'funds',
  'jobs',
  'demandR',
  'demandC',
  'demandI',
  'revenue',
  'expenses',
  'pollution',
  'crime',
  'landValue',
] as const;
