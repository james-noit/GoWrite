import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { EditorService } from './editor.service';
import { getGhost, hideGhost, showGhost } from './ghost-suggestion';

describe('GhostSuggestion', () => {
  let service: EditorService;
  let container: HTMLDivElement;

  function mount() {
    service = TestBed.inject(EditorService);
    container = document.createElement('div');
    document.body.appendChild(container);
    const editor = service.mount(container, { placeholder: '' });
    editor.commands.setContent('<p>hola</p>');
    editor.commands.setTextSelection(5); // end of "hola"
    return editor;
  }

  afterEach(() => {
    service?.destroy();
    container?.remove();
  });

  it('starts with no ghost suggestion', () => {
    const editor = mount();
    expect(getGhost(editor)).toBeNull();
  });

  it('showGhost sets the suggestion at the current cursor position', () => {
    const editor = mount();
    showGhost(editor, ' mundo');
    expect(getGhost(editor)).toEqual({ text: ' mundo', pos: 5 });
  });

  it('renders a decoration widget with the suggestion text and accept/reject buttons', () => {
    const editor = mount();
    showGhost(editor, ' mundo');
    const widget = container.querySelector('.ghost-suggestion');
    expect(widget).toBeTruthy();
    expect(widget?.querySelector('.ghost-suggestion-text')?.textContent).toBe(' mundo');
    expect(widget?.querySelectorAll('button')).toHaveLength(2);
  });

  it('hideGhost clears the suggestion', () => {
    const editor = mount();
    showGhost(editor, ' mundo');
    hideGhost(editor);
    expect(getGhost(editor)).toBeNull();
  });

  it('any document change clears the suggestion automatically', () => {
    const editor = mount();
    showGhost(editor, ' mundo');
    editor.commands.insertContent('!');
    expect(getGhost(editor)).toBeNull();
  });

  it('clicking accept invokes the storage.onAccept callback', () => {
    const editor = mount();
    let accepted = false;
    editor.storage['ghostSuggestion'].onAccept = () => {
      accepted = true;
    };
    showGhost(editor, ' mundo');
    container.querySelector<HTMLButtonElement>('.ghost-btn--accept')!.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true }),
    );
    expect(accepted).toBe(true);
  });

  it('clicking reject invokes the storage.onReject callback', () => {
    const editor = mount();
    let rejected = false;
    editor.storage['ghostSuggestion'].onReject = () => {
      rejected = true;
    };
    showGhost(editor, ' mundo');
    container.querySelector<HTMLButtonElement>('.ghost-btn--reject')!.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true }),
    );
    expect(rejected).toBe(true);
  });

  it('Tab accepts the suggestion when one is showing', () => {
    const editor = mount();
    let accepted = false;
    editor.storage['ghostSuggestion'].onAccept = () => {
      accepted = true;
    };
    showGhost(editor, ' mundo');
    const handled = editor.commands.keyboardShortcut('Tab');
    expect(handled).toBe(true);
    expect(accepted).toBe(true);
  });

  it('Escape rejects the suggestion when one is showing', () => {
    const editor = mount();
    let rejected = false;
    editor.storage['ghostSuggestion'].onReject = () => {
      rejected = true;
    };
    showGhost(editor, ' mundo');
    const handled = editor.commands.keyboardShortcut('Escape');
    expect(handled).toBe(true);
    expect(rejected).toBe(true);
  });

});
