import { Component, inject, signal } from '@angular/core';
import { ViewportInsetsService } from './core/viewport-insets.service';
import { EditorHost } from './editor/editor-host';
import { Header } from './header/header';
import { MobileSupportButton } from './header/mobile-support-button';
import { SettingsModal, type SettingsTab } from './settings/settings-modal';
import { SummaryModal, type SummaryRequest } from './summary/summary-modal';

/**
 * Composition root — ported from src/App.tsx. `SettingsModal`/`SummaryModal`'s open state lives
 * here (mirroring the React original's `useState` in `App`), but unlike the original neither
 * modal needs its data passed down as props: `AiConnectionService`/`AiToolsService`/
 * `EditorService` are app-root singletons any component can inject directly, so there's no prop
 * chain to thread through — Angular's DI does what the React version needed `docs`/`ai`/`tools`
 * props for. `Header` still emits `openSettings`/`openAiSettings` up to here, since *which* modal
 * is open is state only one place should own — `EditorHost` (housing `ContextMenu`, Phase 7) does
 * the same for `openSummary`.
 */
@Component({
  imports: [EditorHost, Header, MobileSupportButton, SettingsModal, SummaryModal],
  selector: 'gowrite-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  // Side-effect-only service (sets --kb-inset on the root element) — injecting it once here
  // activates it for the app's lifetime, mirroring the original calling useViewportInsets() once
  // at the top of `App`.
  private readonly _viewportInsets = inject(ViewportInsetsService);

  protected readonly settingsOpen = signal(false);
  protected readonly settingsTab = signal<SettingsTab>('general');
  protected readonly summaryRequest = signal<SummaryRequest | null>(null);

  protected openSettings(tab: SettingsTab): void {
    this.settingsTab.set(tab);
    this.settingsOpen.set(true);
  }

  protected closeSettings(): void {
    this.settingsOpen.set(false);
  }

  protected closeSummary(): void {
    this.summaryRequest.set(null);
  }
}
