import { OASIS_SAVE_FILE_EXTENSION, SAVE_FILE_EXTENSION, type SaveMeta } from '@city/shared';
import {
  AUTOSAVE_ID,
  SaveStorageError,
  SaveStore,
  slugFileName,
  type StorageErrorKind,
} from '@shell/chrome';

export { AUTOSAVE_ID, SaveStorageError, type StorageErrorKind };

export interface SaveSlot extends SaveMeta {
  id: string;
  autosave: boolean;
  bytes: number;
}

type SaveOwner = 'classic' | 'oasis';

const classicStore = new SaveStore<SaveSlot>('city-builder');
const oasisStore = new SaveStore<SaveSlot>('urbe-oasis');
let oasisMigration: Promise<void> | null = null;

function belongsToOasis(text: string): boolean {
  try {
    const file: unknown = JSON.parse(text);
    if (!file || typeof file !== 'object' || !('state' in file)) return false;
    const state = file.state;
    return !!state && typeof state === 'object' && 'ruleset' in state && state.ruleset === 'oasis';
  } catch {
    return false;
  }
}

/** Copy existing Oasis saves out of the old shared database without removing the originals. */
async function migrateLegacyOasisSaves(): Promise<void> {
  const current = new Map((await oasisStore.list()).map((slot) => [slot.id, slot]));
  let legacy: SaveSlot[];
  try {
    legacy = await classicStore.list();
  } catch {
    return;
  }
  for (const slot of legacy) {
    if (current.has(slot.id) && current.get(slot.id)!.savedAt >= slot.savedAt) continue;
    let text: string;
    try {
      text = await classicStore.read(slot.id);
    } catch {
      continue;
    }
    if (!belongsToOasis(text)) continue;
    await oasisStore.write(slot, text);
    current.set(slot.id, slot);
  }
}

async function storeFor(owner: SaveOwner): Promise<SaveStore<SaveSlot>> {
  if (owner === 'classic') return classicStore;
  if (!oasisMigration) {
    oasisMigration = migrateLegacyOasisSaves().catch((error: unknown) => {
      oasisMigration = null;
      throw error;
    });
  }
  await oasisMigration;
  return oasisStore;
}

/** Slot of the manual save of a city: one per name and seed. */
export function manualSlotId(name: string, seed: string): string {
  return `city:${seed}:${name}`;
}

/** Download file name for a city: ASCII letters, digits and hyphens, accents dropped. */
export function saveFileName(name: string, ruleset: 'classic' | 'oasis' = 'classic'): string {
  const extension = ruleset === 'oasis' ? OASIS_SAVE_FILE_EXTENSION : SAVE_FILE_EXTENSION;
  return slugFileName(name, extension, ruleset === 'oasis' ? 'urbe-oasis' : 'cidade');
}

export const listSaves = async (owner: SaveOwner): Promise<SaveSlot[]> =>
  (await storeFor(owner)).list();
export const writeSave = async (owner: SaveOwner, slot: SaveSlot, text: string): Promise<void> =>
  (await storeFor(owner)).write(slot, text);
export const readSave = async (owner: SaveOwner, id: string): Promise<string> =>
  (await storeFor(owner)).read(id);
export const deleteSave = async (owner: SaveOwner, id: string): Promise<void> =>
  (await storeFor(owner)).delete(id);
