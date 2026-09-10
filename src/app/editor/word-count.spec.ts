import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { EditorService } from './editor.service';
import { countOf } from './word-count';

describe('countOf', () => {
  let service: EditorService;
  let container: HTMLDivElement;

  afterEach(() => {
    service?.destroy();
    container?.remove();
  });

  function editorWith(html: string) {
    service = TestBed.inject(EditorService);
    container = document.createElement('div');
    document.body.appendChild(container);
    const editor = service.mount(container, { placeholder: '' });
    editor.commands.setContent(html);
    return editor;
  }

  it('counts 0 words/chars for an empty document', () => {
    const editor = editorWith('<p></p>');
    expect(countOf(editor)).toEqual({ words: 0, chars: 0 });
  });

  it('counts words split on whitespace and total characters', () => {
    const editor = editorWith('<p>hola mundo</p>');
    expect(countOf(editor)).toEqual({ words: 2, chars: 10 });
  });

  it('does not count leading/trailing whitespace as a word', () => {
    const editor = editorWith('<p>  hola  </p>');
    expect(countOf(editor).words).toBe(1);
  });
});
