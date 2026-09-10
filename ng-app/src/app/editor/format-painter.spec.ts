import { afterEach, describe, expect, it } from 'vitest';
import { createTestEditor } from '../core/formats/testing/create-test-editor';
import { formatPainter } from './format-painter';

describe('formatPainter', () => {
  afterEach(() => {
    formatPainter.clear();
  });

  it('starts inactive', () => {
    expect(formatPainter.isActive()).toBe(false);
  });

  it('copyFormat captures the current selection formatting and activates the painter', () => {
    const editor = createTestEditor();
    editor.commands.setContent('<p><strong>negrita</strong></p>');
    editor.commands.setTextSelection({ from: 1, to: 8 });

    formatPainter.copyFormat(editor);
    expect(formatPainter.isActive()).toBe(true);
    editor.destroy();
  });

  it('applies the copied format to the next non-empty selection', () => {
    const editor = createTestEditor();
    editor.commands.setContent('<p><strong>negrita</strong> normal</p>');
    editor.commands.setTextSelection({ from: 1, to: 8 }); // "negrita" (bold)
    formatPainter.copyFormat(editor);

    editor.commands.setTextSelection({ from: 9, to: 15 });
    expect(editor.isActive('bold')).toBe(true);
    editor.destroy();
  });

  it('does not apply formatting on an empty (collapsed) selection', () => {
    const editor = createTestEditor();
    editor.commands.setContent('<p><strong>negrita</strong> normal</p>');
    editor.commands.setTextSelection({ from: 1, to: 8 });
    formatPainter.copyFormat(editor);

    editor.commands.setTextSelection(10);
    expect(editor.isActive('bold')).toBe(false);
    editor.destroy();
  });

  it('clear deactivates the painter and stops applying formatting on further selections', () => {
    const editor = createTestEditor();
    editor.commands.setContent('<p><strong>negrita</strong> normal</p>');
    editor.commands.setTextSelection({ from: 1, to: 8 });
    formatPainter.copyFormat(editor);
    formatPainter.clear();
    expect(formatPainter.isActive()).toBe(false);

    editor.commands.setTextSelection({ from: 9, to: 15 });
    expect(editor.isActive('bold')).toBe(false);
    editor.destroy();
  });

  it('notifies subscribers when the active state changes', () => {
    const editor = createTestEditor();
    editor.commands.setContent('<p><strong>negrita</strong></p>');
    editor.commands.setTextSelection({ from: 1, to: 8 });

    let notifications = 0;
    const unsubscribe = formatPainter.subscribe(() => {
      notifications += 1;
    });

    formatPainter.copyFormat(editor);
    formatPainter.clear();
    expect(notifications).toBe(2);

    unsubscribe();
    editor.destroy();
  });
});
