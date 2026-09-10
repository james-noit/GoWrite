import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';
import { StorageService } from '../storage.service';
import type { AiConfig, AiProviderId, ConnectionStatus } from '../types';
import { providerRegistry } from './providers';
import { testConnection } from './test-connection';

const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000;

function defaultConfig(stored: AiConfig | null): AiConfig {
  return stored ?? { provider: 'OpenAI', apiKey: '', customEndpoint: '', model: '' };
}

/**
 * AI provider connection state — ported from src/hooks/useAiConnection.ts. Signals replace
 * React state; `connectSeq` (a plain field, not a signal — it doesn't drive any template) still
 * guards against a stale async response landing after a newer `connect()`/`setProvider()`/
 * `updateField()` call superseded it, same as the original.
 */
@Injectable({ providedIn: 'root' })
export class AiConnectionService {
  private readonly storage = inject(StorageService);
  private readonly i18n = inject(I18nService);

  private connectSeq = 0;
  private abortController: AbortController | null = null;

  readonly config = signal<AiConfig>(defaultConfig(this.storage.aiConfig.get()));
  readonly status = signal<ConnectionStatus>('idle');
  readonly error = signal<string | null>(null);
  readonly models = signal<string[]>([]);

  readonly meta = computed(() => providerRegistry[this.config().provider]);
  readonly isConnected = computed(() => this.status() === 'connected');

  constructor() {
    // While connected, re-check the provider every 5 minutes so the status stays truthful —
    // ported from useAiConnection's effect; `effect`'s cleanup callback replaces the hook's
    // returned cleanup function.
    effect((onCleanup) => {
      if (this.status() !== 'connected') return;
      const seq = this.connectSeq;
      const id = window.setInterval(() => {
        void (async () => {
          try {
            const fetchedModels = await testConnection(this.config());
            if (this.connectSeq !== seq) return;
            this.models.set(fetchedModels);
          } catch (err) {
            if (this.connectSeq !== seq) return;
            this.status.set('error');
            this.error.set(`${this.i18n.t('ai.errorConnectionLostPrefix')}${(err as Error).message}`);
          }
        })();
      }, HEALTH_CHECK_INTERVAL_MS);
      onCleanup(() => window.clearInterval(id));
    });
  }

  setProvider(provider: AiProviderId): void {
    this.connectSeq += 1;
    this.config.update((prev) => ({ ...prev, provider }));
    this.status.set('idle');
    this.error.set(null);
    this.models.set([]);
  }

  updateField(field: 'apiKey' | 'customEndpoint' | 'model', value: string): void {
    // Picking a different already-fetched model doesn't invalidate the live connection;
    // changing the key/endpoint does, since it means talking to a different account/server.
    if (field === 'model') {
      const next = { ...this.config(), model: value };
      this.storage.aiConfig.set(next);
      this.config.set(next);
      return;
    }
    this.connectSeq += 1;
    this.config.update((prev) => ({ ...prev, [field]: value }));
    this.status.set('idle');
    this.error.set(null);
  }

  async connect(): Promise<void> {
    this.error.set(null);
    const current = this.config();
    const providerMeta = providerRegistry[current.provider];

    if (providerMeta.endpointEditable) {
      const endpoint = current.customEndpoint.trim() || providerMeta.defaultEndpoint;
      try {
        new URL(endpoint);
      } catch {
        this.status.set('error');
        this.error.set(this.i18n.t('ai.errorInvalidEndpoint'));
        return;
      }
    }
    if (providerMeta.requiresApiKey && !current.apiKey.trim()) {
      this.status.set('error');
      this.error.set(`${providerMeta.apiKeyLabel}${this.i18n.t('ai.errorFieldRequiredSuffix')}`);
      return;
    }

    const seq = ++this.connectSeq;
    this.status.set('connecting');

    try {
      const fetchedModels = await testConnection(current);
      if (this.connectSeq !== seq) return;
      this.models.set(fetchedModels);
      this.status.set('connected');

      // Default to a real model as soon as we know one: keep the user's choice if still valid,
      // otherwise fall back to the first available model, or the provider's hardcoded default.
      const prev = this.config();
      const next = prev.model && fetchedModels.includes(prev.model) ? prev : { ...prev, model: fetchedModels[0] ?? prev.model };
      this.storage.aiConfig.set(next);
      this.config.set(next);
    } catch (err) {
      if (this.connectSeq !== seq) return;
      this.status.set('error');
      this.error.set((err as Error).message || this.i18n.t('ai.errorConnectFailed'));
    }
  }

  disconnect(): void {
    this.connectSeq += 1;
    this.status.set('idle');
    this.error.set(null);
    this.abortController?.abort();
  }
}
