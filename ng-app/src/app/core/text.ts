export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function textToHtml(text: string): string {
  return text
    .split(/\r?\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\r?\n/g, '<br>') || '<br>'}</p>`)
    .join('');
}
