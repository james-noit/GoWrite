import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestEditor } from '../core/formats/testing/create-test-editor';
import { formatPainter } from './format-painter';
import type { ToolbarButton } from './format-groups';
import { ToolbarButtons } from './toolbar-buttons';

describe('ToolbarButtons', () => {
  let fixture: ComponentFixture<ToolbarButtons>;
  let editor: ReturnType<typeof createTestEditor>;

  const buttons: ToolbarButton[] = [
    {
      label: 'B',
      titleKey: 'toolbar.bold',
      isActive: (e) => e.isActive('bold'),
      run: (e) => e.chain().focus().toggleBold().run(),
    },
  ];

  beforeEach(() => {
    editor = createTestEditor();
    editor.commands.setContent('<p>hola</p>');
    editor.commands.selectAll();
    fixture = TestBed.createComponent(ToolbarButtons);
    fixture.componentRef.setInput('editor', editor);
    fixture.componentRef.setInput('buttons', buttons);
    fixture.detectChanges();
  });

  afterEach(() => {
    editor.destroy();
    formatPainter.clear();
  });

  it('renders one button per entry, labeled from `label`', () => {
    const btn = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    expect(btn.textContent?.trim()).toBe('B');
  });

  it('clicking a button runs its command and updates the active state on the next transaction', () => {
    const btn = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    btn.click();
    fixture.detectChanges();
    expect(btn.classList.contains('is-active')).toBe(true);
  });

  it('re-renders active state when formatPainter toggles, even without an editor transaction', () => {
    const painterButtons: ToolbarButton[] = [
      {
        icon: 'brush',
        titleKey: 'toolbar.copyPasteFormat',
        isActive: () => formatPainter.isActive(),
        run: () => {},
      },
    ];
    fixture.componentRef.setInput('buttons', painterButtons);
    fixture.detectChanges();
    const btn = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    expect(btn.classList.contains('is-active')).toBe(false);

    formatPainter.copyFormat(editor);
    fixture.detectChanges();
    expect(btn.classList.contains('is-active')).toBe(true);
  });
});
