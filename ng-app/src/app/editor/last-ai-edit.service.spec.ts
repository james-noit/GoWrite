import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestEditor } from '../core/formats/testing/create-test-editor';
import { LastAiEditService } from './last-ai-edit.service';

describe('LastAiEditService', () => {
  let service: LastAiEditService;
  let editor: ReturnType<typeof createTestEditor>;
  let detach: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new LastAiEditService();
    editor = createTestEditor();
    editor.commands.setContent('<p>Hola mundo generado por IA</p>');
    detach = service.attach(editor);
  });

  afterEach(() => {
    detach();
    editor.destroy();
    vi.useRealTimers();
  });

  it('starts with no undo available', () => {
    expect(service.hasUndo()).toBe(false);
  });

  it('record() makes undo available', () => {
    service.record(5, 10);
    expect(service.hasUndo()).toBe(true);
  });

  it('the affordance auto-clears after 8 seconds', () => {
    service.record(5, 10);
    vi.advanceTimersByTime(8000);
    expect(service.hasUndo()).toBe(false);
  });

  it('any further document edit clears the affordance immediately', () => {
    service.record(5, 10);
    editor.commands.insertContentAt(0, '!');
    expect(service.hasUndo()).toBe(false);
  });

  it('undo() deletes exactly the recorded range and clears the affordance', () => {
    // "Hola " is chars 1-6 in the doc (1-indexed ProseMirror positions)
    editor.commands.setContent('<p>Hola mundo</p>');
    service.record(1, 6);
    service.undo();
    expect(editor.getText()).toBe('mundo');
    expect(service.hasUndo()).toBe(false);
  });

  it('undo() does nothing when there is nothing recorded', () => {
    const before = editor.getText();
    service.undo();
    expect(editor.getText()).toBe(before);
  });

  it('a second record() call replaces the first (only one pending affordance at a time)', () => {
    service.record(1, 3);
    service.record(4, 6);
    vi.advanceTimersByTime(8000);
    // no stray listener from the first record() firing after the second's timer already cleared it
    expect(service.hasUndo()).toBe(false);
  });
});
