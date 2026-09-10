import { Injectable } from '@angular/core';
import type { JSONContent } from '@tiptap/core';

export interface StoredDocument {
  id: string;
  filename: string;
  content: JSONContent;
  createdAt: number;
  updatedAt: number;
}

const DB_NAME = 'gowrite';
const DB_VERSION = 1;
const STORE = 'documents';

/** Thin promise-based IndexedDB wrapper — ported from src/lib/db.ts. */
@Injectable({ providedIn: 'root' })
export class DbService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('No se pudo abrir la base de datos local.'));
    });
    return this.dbPromise;
  }

  private async withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Error de base de datos local.'));
    });
  }

  async listDocuments(): Promise<StoredDocument[]> {
    const all = await this.withStore<StoredDocument[]>('readonly', (store) => store.getAll());
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getDocument(id: string): Promise<StoredDocument | undefined> {
    return this.withStore('readonly', (store) => store.get(id));
  }

  async putDocument(doc: StoredDocument): Promise<void> {
    await this.withStore('readwrite', (store) => store.put(doc));
  }

  async deleteDocument(id: string): Promise<void> {
    await this.withStore('readwrite', (store) => store.delete(id));
  }

  newDocumentId(): string {
    return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `doc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
