import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ImportStatusService } from './import-status.service';

describe('ImportStatusService', () => {
  it('run() sets importing true while pending, false and no error on success', async () => {
    const status = TestBed.inject(ImportStatusService);
    const promise = status.run(async () => {
      expect(status.importing()).toBe(true);
    });
    await promise;
    expect(status.importing()).toBe(false);
    expect(status.error()).toBeNull();
  });

  it('run() captures a thrown error message and clears importing', async () => {
    const status = TestBed.inject(ImportStatusService);
    await status.run(async () => {
      throw new Error('bad file');
    });
    expect(status.importing()).toBe(false);
    expect(status.error()).toBe('bad file');
  });

  it('a successful run() after a failed one clears the previous error', async () => {
    const status = TestBed.inject(ImportStatusService);
    await status.run(async () => {
      throw new Error('bad file');
    });
    await status.run(async () => {});
    expect(status.error()).toBeNull();
  });

  it('dismiss() clears the error', async () => {
    const status = TestBed.inject(ImportStatusService);
    await status.run(async () => {
      throw new Error('bad file');
    });
    status.dismiss();
    expect(status.error()).toBeNull();
  });
});
