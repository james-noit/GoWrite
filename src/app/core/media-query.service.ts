import { DestroyRef, Injectable, inject, signal, type Signal } from '@angular/core';

/**
 * Reactive `window.matchMedia` — ported from src/hooks/useMediaQuery.ts (which used
 * `useSyncExternalStore`; the signal here is the direct Angular equivalent).
 *
 * `observe()` must be called from an injection context (a component/service constructor, or
 * inside `runInInjectionContext`) since it registers automatic listener cleanup via `DestroyRef`.
 */
@Injectable({ providedIn: 'root' })
export class MediaQueryService {
  observe(query: string): Signal<boolean> {
    const destroyRef = inject(DestroyRef);
    const mql = window.matchMedia(query);
    const matches = signal(mql.matches);

    const listener = () => matches.set(mql.matches);
    mql.addEventListener('change', listener);
    destroyRef.onDestroy(() => mql.removeEventListener('change', listener));

    return matches.asReadonly();
  }
}
