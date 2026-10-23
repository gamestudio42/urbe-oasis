import { Fnv1a } from './hash';

export type SaveErrorCode =
  | 'NOT_JSON'
  | 'NOT_A_SAVE'
  | 'NEWER_VERSION'
  | 'UNSUPPORTED_VERSION'
  | 'CHECKSUM'
  | 'MIGRATION_FAILED'
  | 'INVALID';

export interface SaveError {
  code: SaveErrorCode;
  /** Field path or extra information, in English (for logs and bug reports). */
  detail?: string;
}

/** Upgrades a raw file object from version `n` to `n + 1`; registered under key `n`. */
export type SaveMigration = (file: Record<string, unknown>) => Record<string, unknown>;

export interface SaveEnvelope<TFormat extends string, TMeta, TState> {
  format: TFormat;
  version: number;
  meta: TMeta;
  state: TState;
  /** FNV-1a of the canonical JSON of `state`, as written by `version`. */
  checksum: string;
}

export interface DecodeEnvelopeOptions {
  format: string;
  currentVersion: number;
  migrations?: Readonly<Record<number, SaveMigration>>;
  /**
   * Additional envelope formats the decoder accepts. A file whose format is in this list is
   * decoded even when it differs from `format`, so one game can open the other's saves.
   */
  acceptFormats?: readonly string[];
}

export type DecodeEnvelopeResult =
  | { ok: true; file: Record<string, unknown>; version: number; migratedFrom: number | null }
  | { ok: false; errors: SaveError[] };

/** JSON with object keys sorted, so the checksum ignores formatting and key order. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((k) => record[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(',')}}`;
}

export function saveChecksum(state: unknown): string {
  return new Fnv1a().string(canonicalJson(state)).hex();
}

export function stringifySave(file: unknown): string {
  return JSON.stringify(file);
}

export function encodeEnvelope<TFormat extends string, TMeta, TState>(
  format: TFormat,
  version: number,
  meta: TMeta,
  state: TState,
): SaveEnvelope<TFormat, TMeta, TState> {
  return {
    format,
    version,
    meta,
    state,
    checksum: saveChecksum(state),
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function saveFail(code: SaveErrorCode, detail?: string): { ok: false; errors: SaveError[] } {
  return { ok: false, errors: [detail === undefined ? { code } : { code, detail }] };
}

/**
 * Parses, verifies the checksum and applies migrations. Game-specific field validation
 * runs afterwards on `file.state`.
 */
export function decodeEnvelope(text: string, options: DecodeEnvelopeOptions): DecodeEnvelopeResult {
  const migrations = options.migrations ?? {};
  const current = options.currentVersion;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return saveFail('NOT_JSON', error instanceof Error ? error.message : undefined);
  }
  if (!isRecord(raw) || !isRecord(raw.state)) {
    return saveFail('NOT_A_SAVE');
  }
  const accepted = options.acceptFormats ?? [];
  if (raw.format !== options.format && !accepted.includes(raw.format as string)) {
    return saveFail('NOT_A_SAVE');
  }
  const version = raw.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return saveFail('UNSUPPORTED_VERSION', String(version));
  }
  if (version > current) return saveFail('NEWER_VERSION', `${version} > ${current}`);
  if (typeof raw.checksum !== 'string' || raw.checksum !== saveChecksum(raw.state)) {
    return saveFail('CHECKSUM');
  }

  let file: Record<string, unknown> = raw;
  for (let v = version; v < current; v++) {
    const migrate = migrations[v];
    if (!migrate) return saveFail('UNSUPPORTED_VERSION', `no migration from version ${v}`);
    try {
      file = { ...migrate(file), version: v + 1 };
    } catch (error) {
      return saveFail('MIGRATION_FAILED', `${v} -> ${v + 1}: ${String(error)}`);
    }
  }

  return {
    ok: true,
    file,
    version,
    migratedFrom: version === current ? null : version,
  };
}
