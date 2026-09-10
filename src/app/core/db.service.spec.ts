import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { DbService } from './db.service';

const emptyDoc = { type: 'doc', content: [{ type: 'paragraph' }] };

describe('DbService', () => {
  let db: DbService;

  beforeEach(async () => {
    db = new DbService();
    // fake-indexeddb keeps state across tests in the same process; start each test from a clean slate.
    for (const doc of await db.listDocuments()) {
      await db.deleteDocument(doc.id);
    }
  });

  it('starts empty', async () => {
    expect(await db.listDocuments()).toEqual([]);
  });

  it('stores and retrieves a document', async () => {
    const id = db.newDocumentId();
    const now = Date.now();
    await db.putDocument({ id, filename: 'a.md', content: emptyDoc, createdAt: now, updatedAt: now });

    const all = await db.listDocuments();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id, filename: 'a.md' });
  });

  it('lists documents most-recently-updated first', async () => {
    const now = Date.now();
    await db.putDocument({ id: 'older', filename: 'older.md', content: emptyDoc, createdAt: now, updatedAt: now });
    await db.putDocument({ id: 'newer', filename: 'newer.md', content: emptyDoc, createdAt: now, updatedAt: now + 1000 });

    const all = await db.listDocuments();
    expect(all.map((d) => d.id)).toEqual(['newer', 'older']);
  });

  it('overwrites a document with the same id', async () => {
    const id = db.newDocumentId();
    const now = Date.now();
    await db.putDocument({ id, filename: 'first.md', content: emptyDoc, createdAt: now, updatedAt: now });
    await db.putDocument({ id, filename: 'renamed.md', content: emptyDoc, createdAt: now, updatedAt: now + 1 });

    const all = await db.listDocuments();
    expect(all).toHaveLength(1);
    expect(all[0].filename).toBe('renamed.md');
  });

  it('deletes a document', async () => {
    const id = db.newDocumentId();
    const now = Date.now();
    await db.putDocument({ id, filename: 'gone.md', content: emptyDoc, createdAt: now, updatedAt: now });
    expect(await db.listDocuments()).toHaveLength(1);

    await db.deleteDocument(id);
    expect(await db.listDocuments()).toHaveLength(0);
  });

  it('fetches a single document by id', async () => {
    const id = db.newDocumentId();
    const now = Date.now();
    await db.putDocument({ id, filename: 'single.md', content: emptyDoc, createdAt: now, updatedAt: now });

    expect(await db.getDocument(id)).toMatchObject({ id, filename: 'single.md' });
  });

  it('returns undefined for an id that does not exist', async () => {
    expect(await db.getDocument('does-not-exist')).toBeUndefined();
  });

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => db.newDocumentId()));
    expect(ids.size).toBe(100);
  });
});
