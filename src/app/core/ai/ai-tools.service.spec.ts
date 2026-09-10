import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AiToolsService } from './ai-tools.service';

describe('AiToolsService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to autocomplete disabled with sensible defaults', () => {
    const tools = TestBed.inject(AiToolsService);
    expect(tools.config()).toEqual({
      autocomplete: { enabled: false, waitSeconds: 3, minWords: 5, maxWords: 30 },
    });
  });

  it('merges a stored partial config with defaults (missing fields fall back)', () => {
    localStorage.setItem('gowrite:ai-tools', JSON.stringify({ autocomplete: { enabled: true } }));
    const tools = TestBed.inject(AiToolsService);
    expect(tools.config().autocomplete).toEqual({ enabled: true, waitSeconds: 3, minWords: 5, maxWords: 30 });
  });

  it('updateTool merges a patch and persists it', () => {
    const tools = TestBed.inject(AiToolsService);
    tools.updateTool('autocomplete', { enabled: true, waitSeconds: 5 });
    expect(tools.config().autocomplete).toMatchObject({ enabled: true, waitSeconds: 5 });

    const persisted = JSON.parse(localStorage.getItem('gowrite:ai-tools')!);
    expect(persisted.autocomplete).toMatchObject({ enabled: true, waitSeconds: 5 });
  });
});
