import { TestBed } from '@angular/core/testing';
import { DbService } from '../../core/db.service';

/** `fake-indexeddb`'s store is a genuine global, shared across every spec file in the same
 * Vitest worker (not just within one file, as its own store might suggest) — any spec that
 * touches `DocumentsService`/`DbService` needs to start from a clean slate or it'll see leftover
 * documents a previous spec file created. Call from `beforeEach`, before injecting
 * `DocumentsService` (so its migrate-if-empty check sees the store actually empty). */
export async function clearDocumentsDb(): Promise<void> {
  const db = TestBed.inject(DbService);
  for (const doc of await db.listDocuments()) {
    await db.deleteDocument(doc.id);
  }
}
