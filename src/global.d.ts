// __APP_VERSION__ is replaced at build time by angular.json's build.options.define — must be
// referenced as a bare identifier (not a property access like `globalThis.__APP_VERSION__`) for
// esbuild's `define` to actually rewrite it; a property-access reference silently looks up a
// real (never-set) global property instead and evaluates to `undefined`.
declare const __APP_VERSION__: string;
