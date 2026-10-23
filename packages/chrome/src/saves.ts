export const AUTOSAVE_ID = 'autosave';

export type StorageErrorKind = 'quota' | 'unavailable' | 'missing' | 'unknown';

export class SaveStorageError extends Error {
  constructor(
    readonly kind: StorageErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'SaveStorageError';
  }
}

export interface StoredSave {
  id: string;
  savedAt: string;
}

function toStorageError(error: unknown): SaveStorageError {
  if (error instanceof SaveStorageError) return error;
  const name = error instanceof DOMException ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  if (name === 'QuotaExceededError') return new SaveStorageError('quota', message);
  if (name === 'InvalidStateError' || name === 'SecurityError') {
    return new SaveStorageError('unavailable', message);
  }
  return new SaveStorageError('unknown', message);
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(toStorageError(tx.error));
    tx.onerror = () => reject(toStorageError(tx.error));
  });
}

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(toStorageError(request.error));
  });
}

/** Download file name: ASCII letters, digits and hyphens, accents dropped. */
export function slugFileName(name: string, extension: string, emptyFallback: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || emptyFallback}${extension}`;
}

/**
 * IndexedDB save slots. `dbName` is per game so two titles can share a browser profile.
 */
export class SaveStore<TSlot extends StoredSave> {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(
    private readonly dbName: string,
    private readonly version = 1,
    private readonly metaStore = 'meta',
    private readonly dataStore = 'data',
  ) {}

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    const metaStore = this.metaStore;
    const dataStore = this.dataStore;
    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new SaveStorageError('unavailable', 'IndexedDB is not available'));
        return;
      }
      const request = indexedDB.open(this.dbName, this.version);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(metaStore))
          db.createObjectStore(metaStore, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(dataStore))
          db.createObjectStore(dataStore, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(toStorageError(request.error));
      request.onblocked = () => reject(new SaveStorageError('unavailable', 'database blocked'));
    }).catch((error: unknown) => {
      this.dbPromise = null;
      throw toStorageError(error);
    });
    return this.dbPromise;
  }

  /** Saves, most recent first. */
  async list(): Promise<TSlot[]> {
    const db = await this.openDb();
    const tx = db.transaction(this.metaStore, 'readonly');
    const slots = await result(tx.objectStore(this.metaStore).getAll() as IDBRequest<TSlot[]>);
    return slots.sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0));
  }

  async write(slot: TSlot, text: string): Promise<void> {
    try {
      const db = await this.openDb();
      const tx = db.transaction([this.metaStore, this.dataStore], 'readwrite');
      tx.objectStore(this.dataStore).put({ id: slot.id, text });
      tx.objectStore(this.metaStore).put(slot);
      await done(tx);
    } catch (error) {
      throw toStorageError(error);
    }
  }

  async read(id: string): Promise<string> {
    const db = await this.openDb();
    const tx = db.transaction(this.dataStore, 'readonly');
    const record = await result(
      tx.objectStore(this.dataStore).get(id) as IDBRequest<{ id: string; text: string } | undefined>,
    );
    if (!record || typeof record.text !== 'string') {
      throw new SaveStorageError('missing', `save ${id} has no data`);
    }
    return record.text;
  }

  async delete(id: string): Promise<void> {
    const db = await this.openDb();
    const tx = db.transaction([this.metaStore, this.dataStore], 'readwrite');
    tx.objectStore(this.metaStore).delete(id);
    tx.objectStore(this.dataStore).delete(id);
    await done(tx);
  }
}
