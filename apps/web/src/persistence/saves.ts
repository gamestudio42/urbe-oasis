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

const store = new SaveStore<SaveSlot>('city-builder');

/** Slot of the manual save of a city: one per name and seed. */
export function manualSlotId(name: string, seed: string): string {
  return `city:${seed}:${name}`;
}

/** Download file name for a city: ASCII letters, digits and hyphens, accents dropped. */
export function saveFileName(name: string, ruleset: 'classic' | 'oasis' = 'classic'): string {
  const extension = ruleset === 'oasis' ? OASIS_SAVE_FILE_EXTENSION : SAVE_FILE_EXTENSION;
  return slugFileName(name, extension, ruleset === 'oasis' ? 'urbe-oasis' : 'cidade');
}

export const listSaves = (): Promise<SaveSlot[]> => store.list();
export const writeSave = (slot: SaveSlot, text: string): Promise<void> => store.write(slot, text);
export const readSave = (id: string): Promise<string> => store.read(id);
export const deleteSave = (id: string): Promise<void> => store.delete(id);
