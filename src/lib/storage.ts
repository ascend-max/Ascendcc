import type { AppState } from '../types';
import { initialState } from './factory';

const STORAGE_KEY = 'ascendcc.state.v1';
const ACTIVE_PROJECT_KEY = 'ascendcc.activeProject.v1';

/**
 * Browser storage is a working surface, not a backup. The UI warns about this
 * explicitly. Everything the app persists is plain JSON so the whole state can
 * be exported and imported, and a hosted database can replace this later.
 */
export function loadState(): AppState {
  const base = initialState();
  if (typeof window === 'undefined') return base;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (!parsed || typeof parsed !== 'object') return base;
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings ?? {}), ai: { ...base.settings.ai, ...(parsed.settings?.ai ?? {}) } },
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      characters: Array.isArray(parsed.characters) ? parsed.characters : [],
      assets: Array.isArray(parsed.assets) ? parsed.assets : [],
      ideas: Array.isArray(parsed.ideas) ? parsed.ideas : [],
      calendar: Array.isArray(parsed.calendar) ? parsed.calendar : [],
      metrics: Array.isArray(parsed.metrics) ? parsed.metrics : [],
    };
  } catch (error) {
    console.warn('AscendCC could not read saved state.', error);
    return base;
  }
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export function saveState(state: AppState): SaveResult {
  if (typeof window === 'undefined') return { ok: true };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'QuotaExceededError'
        ? 'Browser storage is full. Export your work and remove large assets.'
        : 'Could not save to browser storage.';
    console.warn(message, error);
    return { ok: false, error: message };
  }
}

export function clearStoredState(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function loadActiveProjectId(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(ACTIVE_PROJECT_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveActiveProjectId(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  } catch {
    /* non-critical */
  }
}

/* ------------------------------------------------------------------ */
/* Binary blob store (IndexedDB)                                       */
/* ------------------------------------------------------------------ */

const DB_NAME = 'ascendcc.blobs.v1';
const STORE_NAME = 'blobs';
const urlCache = new Map<string, string>();

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      reject(new Error('IndexedDB is unavailable, so files cannot be stored in this browser.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the asset database.'));
  });
}

export async function putBlob(blob: Blob): Promise<string> {
  const id = `blob_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Could not store the file.'));
  });
  db.close();
  return id;
}

export async function getBlob(id: string): Promise<Blob | undefined> {
  if (!hasIndexedDb() || !id) return undefined;
  try {
    const db = await openDb();
    const blob = await new Promise<Blob | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result as Blob | undefined);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return blob;
  } catch (error) {
    console.warn('Could not read stored file', id, error);
    return undefined;
  }
}

export async function getBlobUrl(id: string): Promise<string | undefined> {
  if (!id) return undefined;
  const cached = urlCache.get(id);
  if (cached) return cached;
  const blob = await getBlob(id);
  if (!blob) return undefined;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

export async function deleteBlob(id: string): Promise<void> {
  const cached = urlCache.get(id);
  if (cached) {
    URL.revokeObjectURL(cached);
    urlCache.delete(id);
  }
  if (!hasIndexedDb() || !id) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (error) {
    console.warn('Could not delete stored file', id, error);
  }
}

/* ------------------------------------------------------------------ */
/* Project + state portability                                         */
/* ------------------------------------------------------------------ */

export function downloadText(filename: string, content: string, mime = 'text/plain'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  downloadBlob(filename, blob);
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function exportStateJson(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function parseStateJson(text: string): AppState {
  const parsed = JSON.parse(text) as Partial<AppState>;
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.projects)) {
    throw new Error('That file is not an AscendCC project export.');
  }
  const base = initialState();
  return {
    ...base,
    ...parsed,
    settings: { ...base.settings, ...(parsed.settings ?? {}) },
    characters: Array.isArray(parsed.characters) && parsed.characters.length ? parsed.characters : base.characters,
  } as AppState;
}
