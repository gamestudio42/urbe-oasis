import { ZoneType } from '@city/shared';
import type { GameSession } from './session';
import type { ToolId } from '../tools/tools';

const STORAGE_KEY = 'cityBuilder.tutorialDone';
const OASIS_STORAGE_KEY = 'oasis.tutorial.founding.v1';

type TutorialCheck = ((session: GameSession) => boolean) | null;

/** Observe the mirror's service flags; economic rules remain in the simulation. */
function servedHome(session: GameSession, service: 'power' | 'water' | 'shade'): boolean {
  const w = session.client.world;
  if (!w) return false;
  for (let i = 0; i < w.tileCount; i++) {
    if (w.zone[i] !== ZoneType.Residential) continue;
    if (service === 'power' && w.powered[i] === 1) return true;
    if (service === 'water' && w.watered[i] === 1) return true;
    if (service === 'shade' && w.watered[i] === 1 && w.linked[i] === 1) return true;
  }
  return false;
}

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
export const TUTORIAL_CHECKS: readonly TutorialCheck[] = [
  null,
  (s) => s.client.stats?.edgeConnected === true,
  (s) => countZones(s, (z) => z === ZoneType.Residential) > 0,
  (s) => countZones(s, (z) => z === ZoneType.Commercial || z === ZoneType.Industrial) > 0,
  (s) => anyPoweredZone(s),
  (s) => (s.client.stats?.population ?? 0) > 0,
  (s) => s.ui.get().panel === 'budget',
];

export const OASIS_TUTORIAL_CHECKS: readonly TutorialCheck[] = [
  null,
  (s) => s.client.stats?.edgeConnected === true,
  (s) => countZones(s, (z) => z === ZoneType.Residential) > 0,
  (s) => countZones(s, (z) => z === ZoneType.Commercial || z === ZoneType.Industrial) > 0,
  (s) => servedHome(s, 'power'),
  (s) => servedHome(s, 'water'),
  (s) => servedHome(s, 'shade'),
  (s) => (s.client.stats?.population ?? 0) > 0,
  (s) =>
    (s.client.stats?.oasis?.cisterns.banks ?? 0) > 0 &&
    (s.client.stats?.oasis?.cisterns.charge ?? 0) > 0,
  null,
];

export const OASIS_TUTORIAL_TOOLS: readonly (readonly ToolId[])[] = [
  [],
  ['road'],
  ['zoneResLight'],
  ['zoneIndLight', 'zoneComLight'],
  ['gasPlant', 'powerLine'],
  ['qanat', 'pipe'],
  ['palm', 'canal'],
  [],
  ['cistern', 'pipe', 'powerLine'],
  [],
];

export function tutorialChecks(ruleset: 'classic' | 'oasis'): readonly TutorialCheck[] {
  return ruleset === 'oasis' ? OASIS_TUTORIAL_CHECKS : TUTORIAL_CHECKS;
}

export function tutorialDone(ruleset: 'classic' | 'oasis' = 'classic'): boolean {
  try {
    return localStorage.getItem(ruleset === 'oasis' ? OASIS_STORAGE_KEY : STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markTutorialDone(ruleset: 'classic' | 'oasis' = 'classic'): void {
  try {
    localStorage.setItem(ruleset === 'oasis' ? OASIS_STORAGE_KEY : STORAGE_KEY, '1');
  } catch {
    // Storage may be unavailable (private mode); the tutorial just shows again next time.
  }
}
