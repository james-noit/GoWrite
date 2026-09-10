import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { EditorService } from './editor.service';

describe('FontSize extension', () => {
  let service: EditorService;
  let container: HTMLDivElement;

  afterEach(() => {
    service?.destroy();
    container?.remove();
  });

  function mount() {
    service = TestBed.inject(EditorService);
    container = document.createElement('div');
    document.body.appendChild(container);
    const editor = service.mount(container, { placeholder: '' });
    editor.commands.setContent('<p>hola</p>');
    editor.commands.selectAll();
    return editor;
  }

  it('setFontSize applies a fontSize attribute on the textStyle mark', () => {
    const editor = mount();
    editor.commands.setFontSize('20px');
    expect(editor.getAttributes('textStyle')['fontSize']).toBe('20px');
    expect(editor.getHTML()).toContain('font-size: 20px');
  });

  it('unsetFontSize clears it', () => {
    const editor = mount();
    editor.commands.setFontSize('20px');
    editor.commands.unsetFontSize();
    expect(editor.getAttributes('textStyle')['fontSize']).toBeFalsy();
  });
});
