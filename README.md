# GoWrite

A Tiptap/ProseMirror rich-text editor with IndexedDB-backed multi-document storage, five import/export formats (Markdown, plain text, HTML, Word, OpenDocument), a multi-provider AI layer (OpenAI, Anthropic, Google Gemini, Mistral, Cohere, or any OpenAI-compatible local server) for autocomplete/summarize/edit/generate/describe-image/generate-image, and a responsive mobile+desktop UI with i18n (es/en) and light/dark theming.

Built with Angular 22 (standalone components, signals, zoneless change detection). Originally written in React; migrated to Angular in a fully-tested, phased rewrite — see [docs/angular-migration-plan.md](docs/angular-migration-plan.md) for the history, including every bug found and fixed along the way.

## Development

```bash
npm install
npm start
```

Open `http://localhost:4200`. The app reloads automatically on source changes.

## Testing

```bash
npm test           # Vitest unit/component tests (ng test)
npm run test:e2e   # Playwright end-to-end tests (needs the dev server; started automatically)
```

## Building

```bash
npm run build
```

Production output goes to `dist/gowrite/`.

## Third-party notices

`THIRD-PARTY-NOTICES.md` is generated from the licenses actually present in `node_modules`:

```bash
npm run notices
```

Regenerate it whenever dependencies change before a release.
