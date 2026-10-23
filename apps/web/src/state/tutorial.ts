import { ZoneType } from '@city/shared';
import type { GameSession } from './session';

const STORAGE_KEY = 'cityBuilder.tutorialDone';

function countZones(session: GameSession, match: (zone: number) => boolean): number {
  const w = session.client.world;
  if (!w) return 0;
  let n = 0;
  for (let i = 0; i < w.tileCount; i++) if (match(w.zone[i] as number)) n++;
  return n;
}

function anyPoweredZone(session: GameSession): boolean {
  const w = session.client.world;
  if (!w) return false;
  for (let i = 0; i < w.tileCount; i++) {
    if ((w.zone[i] as number) !== ZoneType.None && w.powered[i] === 1) return true;
  }
  return false;
}

/**
 * Completion check per tutorial step (same order as `t.tutorial.steps`). `null` means the
 * player advances manually.
 */
export const TUTORIAL_CHECKS: ReadonlyArray<((session: GameSession) => boolean) | null> = [
  null,
  (s) => s.client.stats?.edgeConnected === true,
  (s) => countZones(s, (z) => z === ZoneType.Residential) > 0,
  (s) => countZones(s, (z) => z === ZoneType.Commercial || z === ZoneType.Industrial) > 0,
  (s) => anyPoweredZone(s),
  (s) => (s.client.stats?.population ?? 0) > 0,
  (s) => s.ui.get().panel === 'budget',
];

export function tutorialDone(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markTutorialDone(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Storage may be unavailable (private mode); the tutorial just shows again next time.
  }
}
