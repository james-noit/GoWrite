import { Injectable, signal } from '@angular/core';

/**
 * Shared import progress/error state — new in the Angular port, not a direct hook port. The
 * React original kept `importing`/`importError` as local `useState` in `App.tsx`, which could
 * pass them as props to both `Header`/`FileMenu` (the trigger) and `Editor`/the error banner (the
 * display) since both were children of the same component. Angular's `FileMenu` and
 * `EditorHost` are siblings instead (composed side-by-side under `App`, not parent/child), so a
 * small root-singleton service is the natural equivalent of "state lifted to the common parent."
 */
@Injectable({ providedIn: 'root' })
export class ImportStatusService {
  readonly importing = signal(false);
  readonly error = signal<string | null>(null);

  async run(task: () => Promise<void>): Promise<void> {
    this.importing.set(true);
    try {
      await task();
      this.error.set(null);
    } catch (err) {
      this.error.set((err as Error).message);
    } finally {
      this.importing.set(false);
    }
  }

  dismiss(): void {
    this.error.set(null);
  }
}
