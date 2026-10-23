import {
  decodeSave,
  encodeSave,
  saveChecksum,
  SAVE_VERSION,
  stringifySave,
  type SaveFile,
} from '@city/shared';
import { buildTown, flatCity, hashState, SimulationEngine } from '@city/simulation';
import { describe, expect, it } from 'vitest';
import { saveFileName } from '../../apps/web/src/persistence/saves';

const META = { population: 0, funds: 0, savedAt: '2026-01-01T00:00:00.000Z' };

function town(): SimulationEngine {
  const e = flatCity('save-codec', 48);
  buildTown(e);
  e.runMonths(6);
  e.runTicks(37);
  e.triggerDisaster('fire', 8, 13);
  return e;
}

function saveText(e: SimulationEngine): string {
  return stringifySave(encodeSave(e.serialize(), META));
}

/** Re-signs a modified file so only the validator can catch the problem. */
function tamper(text: string, edit: (file: SaveFile) => void): string {
  const file = JSON.parse(text) as SaveFile;
  edit(file);
  file.checksum = saveChecksum(file.state);
  return JSON.stringify(file);
}

function errorCodes(text: string): string[] {
  const result = decodeSave(text);
  return result.ok ? [] : result.errors.map((e) => e.code);
}

describe('save codec', () => {
  it('round-trips the exact engine state, mid-month and mid-fire', () => {
    const a = town();
    const result = decodeSave(saveText(a));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.migratedFrom).toBeNull();
    expect(result.meta).toMatchObject({ name: a.name, seed: a.seed, size: 48, tick: a.tick });
    const b = SimulationEngine.fromSnapshot(result.snapshot);
    expect(hashState(b)).toBe(hashState(a));
    a.runMonths(3);
    b.runMonths(3);
    expect(hashState(b)).toBe(hashState(a));
  });

  it('accepts reformatted files (the checksum is over canonical JSON)', () => {
    const text = saveText(town());
    const pretty = JSON.stringify(JSON.parse(text), null, 2);
    expect(decodeSave(pretty).ok).toBe(true);
  });

  it('rejects files that are not saves', () => {
    expect(errorCodes('{"oops"')).toEqual(['NOT_JSON']);
    expect(errorCodes('[1, 2, 3]')).toEqual(['NOT_A_SAVE']);
    expect(errorCodes('{"format": "other", "state": {}}')).toEqual(['NOT_A_SAVE']);
  });

  it('detects corruption through the checksum', () => {
    const text = saveText(town());
    const file = JSON.parse(text) as SaveFile;
    file.state.economy.funds += 1_000_000;
    expect(errorCodes(JSON.stringify(file))).toEqual(['CHECKSUM']);
    const cut = text.replace(/"terrain":"(.{40})/, '"terrain":"AAAA$1');
    expect(errorCodes(cut)).toEqual(['CHECKSUM']);
  });

  it('refuses saves from a newer version', () => {
    const text = tamper(saveText(town()), (f) => {
      f.version = SAVE_VERSION + 1;
    });
    expect(errorCodes(text)).toEqual(['NEWER_VERSION']);
  });

  it('reports every structural problem with its path', () => {
    const text = tamper(saveText(town()), (f) => {
      f.state.layers.terrain = f.state.layers.terrain.slice(0, 100);
      const [first, second] = f.state.buildings;
      if (first && second) {
        second.x = first.x;
        second.y = first.y;
      }
      f.state.economy.taxes.residential = 99;
      (f.state.disasters as unknown[]).push({
        kind: 'meteor',
        remainingTicks: 1,
        x: 0,
        y: 0,
        targetId: 0,
      });
    });
    const result = decodeSave(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const details = result.errors.map((e) => e.detail ?? '');
    expect(result.errors.every((e) => e.code === 'INVALID')).toBe(true);
    expect(details.some((d) => d.startsWith('state.layers.terrain'))).toBe(true);
    expect(details.some((d) => d.includes('overlaps building'))).toBe(true);
    expect(details.some((d) => d.startsWith('state.economy.taxes.residential'))).toBe(true);
    expect(details.some((d) => d.startsWith('state.disasters[0].kind'))).toBe(true);
  });

  it('upgrades old files through the registered migrations', () => {
    // Rewind the envelope to version 1; the checksum covers only `state`, so it stays valid.
    const text = tamper(saveText(town()), (f) => {
      f.version = 1;
    });
    const migrations = {
      1: (f: Record<string, unknown>) => ({ ...f, upgradedTo2: true }),
      2: (f: Record<string, unknown>) => {
        if (f.upgradedTo2 !== true) throw new Error('migrations ran out of order');
        const state = { ...(f.state as Record<string, unknown>) };
        state.name = `${String(state.name)} (migrada)`;
        return { ...f, state };
      },
    };
    const result = decodeSave(text, { migrations, currentVersion: 3 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.migratedFrom).toBe(1);
    expect(result.snapshot.name).toMatch(/\(migrada\)$/);

    const missing = decodeSave(text, { migrations: { 1: migrations[1] }, currentVersion: 3 });
    expect(missing.ok ? [] : missing.errors.map((e) => e.code)).toEqual(['UNSUPPORTED_VERSION']);
    const broken = decodeSave(text, {
      migrations: {
        1: () => {
          throw new Error('boom');
        },
      },
      currentVersion: 2,
    });
    expect(broken.ok ? [] : broken.errors.map((e) => e.code)).toEqual(['MIGRATION_FAILED']);
  });
});

describe('save file name', () => {
  it('keeps the city name readable, dropping accents and symbols', () => {
    expect(saveFileName('Cenário')).toBe('Cenario.city.json');
    expect(saveFileName('São Paulo')).toBe('Sao-Paulo.city.json');
    expect(saveFileName('Vila E2E')).toBe('Vila-E2E.city.json');
    expect(saveFileName('  Ação & Cia! ')).toBe('Acao-Cia.city.json');
    expect(saveFileName('***')).toBe('cidade.city.json');
  });
});
