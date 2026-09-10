import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { EditorService } from './editor.service';

describe('EditorService', () => {
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
    const editor = service.mount(container, { placeholder: 'Empieza a escribir…' });
    return editor;
  }

  it('mounts without an onUpdate callback (regression: an explicit onUpdate:undefined used to override Tiptap\'s own default and crash every update dispatch)', () => {
    const editor = mount();
    expect(() => editor.commands.setContent('<p>hola</p>')).not.toThrow();
  });

  it('mounts with an onUpdate callback and calls it on content changes', () => {
    let calls = 0;
    service = TestBed.inject(EditorService);
    container = document.createElement('div');
    document.body.appendChild(container);
    const editor = service.mount(container, { placeholder: '', onUpdate: () => calls++ });

    editor.commands.setContent('<p>hola</p>');
    expect(calls).toBeGreaterThan(0);
  });

  it('exposes the mounted editor via the editor() signal', () => {
    const editor = mount();
    expect(service.editor()).toBe(editor);
  });

  it('destroy() tears down the editor and clears the signal', () => {
    mount();
    service.destroy();
    expect(service.editor()).toBeNull();
  });

  it('mounting again destroys the previous editor first', () => {
    const first = mount();
    const secondContainer = document.createElement('div');
    document.body.appendChild(secondContainer);
    const second = service.mount(secondContainer, { placeholder: '' });

    expect(first.isDestroyed).toBe(true);
    expect(service.editor()).toBe(second);
    secondContainer.remove();
  });

  it('revision increments on every transaction (selection or content change)', () => {
    const editor = mount();
    const before = service.revision();
    editor.commands.setContent('<p>hola</p>');
    expect(service.revision()).toBeGreaterThan(before);
  });

  it('loads the full extension set: headings, lists, tables, and markdown all work', () => {
    const editor = mount();
    editor.commands.setContent(
      '<h1>Título</h1><ul><li><p>uno</p></li></ul><table><tbody><tr><td><p>celda</p></td></tr></tbody></table>',
    );
    const json = editor.getJSON();
    const types = json.content?.map((n) => n.type);
    expect(types).toContain('heading');
    expect(types).toContain('bulletList');
    expect(types).toContain('table');
    const markdownStorage = editor.storage as unknown as { markdown: { getMarkdown: () => string } };
    expect(markdownStorage.markdown.getMarkdown()).toContain('# Título');
  });

  it('the clipboard text serializer joins blocks with a single newline, not a blank line', () => {
    const editor = mount();
    editor.commands.setContent('<p>Primero</p><p>Segundo</p>');
    const slice = editor.state.doc.slice(0, editor.state.doc.content.size);
    const serialize = editor.view.someProp('clipboardTextSerializer');
    expect(serialize?.(slice, editor.view)).toBe('Primero\nSegundo');
  });

  it('code blocks render through the vanilla CodeBlockView node view (language input + pre/code)', () => {
    const editor = mount();
    editor.commands.setContent('<pre><code>const x = 1;</code></pre>');
    const view = container.querySelector('.code-block-view');
    expect(view).toBeTruthy();
    expect(view?.querySelector('input.code-block-lang')).toBeTruthy();
    expect(view?.querySelector('pre code')?.textContent).toBe('const x = 1;');
  });

  it('images render through the vanilla ImageView node view', () => {
    const editor = mount();
    editor.commands.setContent(
      '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=">',
    );
    expect(container.querySelector('figure.gw-image')).toBeTruthy();
    expect(container.querySelector('.gw-image-caption')).toBeTruthy();
  });
});
