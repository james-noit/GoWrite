import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { EditorService } from './editor.service';

describe('CodeBlockWithLanguageInput node view', () => {
  let service: EditorService;
  let container: HTMLDivElement;

  function mount() {
    service = TestBed.inject(EditorService);
    container = document.createElement('div');
    document.body.appendChild(container);
    const editor = service.mount(container, { placeholder: '' });
    editor.commands.setContent('<pre><code>const x = 1;</code></pre>');
    return editor;
  }

  afterEach(() => {
    service?.destroy();
    container?.remove();
  });

  it('renders a language input alongside the code content', () => {
    mount();
    const langInput = container.querySelector<HTMLInputElement>('.code-block-lang');
    expect(langInput).toBeTruthy();
    expect(langInput!.value).toBe('');
    expect(container.querySelector('pre code')?.textContent).toBe('const x = 1;');
  });

  it('typing into the language input sets the node\'s language attribute', () => {
    const editor = mount();
    const langInput = container.querySelector<HTMLInputElement>('.code-block-lang')!;
    langInput.value = 'js';
    langInput.dispatchEvent(new Event('input', { bubbles: true }));

    let attrs: Record<string, unknown> | null = null;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'codeBlock') attrs = node.attrs;
    });
    expect(attrs).toMatchObject({ language: 'js' });
  });

  it('clearing the language input unsets the attribute (empty string becomes null)', () => {
    const editor = mount();
    const langInput = container.querySelector<HTMLInputElement>('.code-block-lang')!;
    langInput.value = 'js';
    langInput.dispatchEvent(new Event('input', { bubbles: true }));
    langInput.value = '';
    langInput.dispatchEvent(new Event('input', { bubbles: true }));

    let attrs: Record<string, unknown> | null = null;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'codeBlock') attrs = node.attrs;
    });
    expect(attrs).toMatchObject({ language: null });
  });

  it('the language attribute round-trips into the markdown fence', () => {
    const editor = mount();
    const langInput = container.querySelector<HTMLInputElement>('.code-block-lang')!;
    langInput.value = 'js';
    langInput.dispatchEvent(new Event('input', { bubbles: true }));

    const markdownStorage = editor.storage as unknown as { markdown: { getMarkdown: () => string } };
    expect(markdownStorage.markdown.getMarkdown()).toContain('```js');
  });

  it('editing the code content updates the node text (contentDOM wiring)', () => {
    const editor = mount();
    editor.commands.selectAll();
    editor.commands.insertContent('const y = 2;');
    expect(editor.getText()).toBe('const y = 2;');
  });
});
