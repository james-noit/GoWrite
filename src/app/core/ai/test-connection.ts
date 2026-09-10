import type { AiConfig } from '../types';
import { customModelsUrl } from './endpoint';
import { localServerUnreachableMessage } from './local-origin';
import { providerRegistry } from './providers';
import { extractHttpError } from './stream';

const TIMEOUT_MS = 8000;

function withTimeout(): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return { signal: controller.signal, clear: () => clearTimeout(id) };
}

interface RawModel {
  id?: string;
  name?: string;
}

/** Tolerant parser: covers OpenAI-style {data:[{id}]} and Gemini/Cohere-style {models:[{name}]}. */
function extractModelIds(body: unknown): string[] {
  const record = body as { data?: RawModel[]; models?: RawModel[] };
  const list = Array.isArray(record?.data)
    ? record.data
    : Array.isArray(record?.models)
      ? record.models
      : [];
  return list
    .map((m) =>
      typeof m.id === 'string'
        ? m.id
        : typeof m.name === 'string'
          ? m.name.replace(/^models\//, '')
          : '',
    )
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Lightweight reachability check: hits each provider's models-list endpoint instead of spending
 * tokens on a real generation. Returns the available model ids so the UI can offer a picker.
 */
export async function testConnection(config: AiConfig): Promise<string[]> {
  const meta = providerRegistry[config.provider];
  const { signal, clear } = withTimeout();

  try {
    let url: string;
    const headers: Record<string, string> = {};

    switch (config.provider) {
      case 'OpenAI':
        url = 'https://api.openai.com/v1/models';
        headers['Authorization'] = `Bearer ${config.apiKey}`;
        break;
      case 'Mistral':
        url = 'https://api.mistral.ai/v1/models';
        headers['Authorization'] = `Bearer ${config.apiKey}`;
        break;
      case 'Cohere':
        url = 'https://api.cohere.com/v1/models';
        headers['Authorization'] = `Bearer ${config.apiKey}`;
        break;
      case 'Anthropic':
        url = 'https://api.anthropic.com/v1/models';
        headers['x-api-key'] = config.apiKey;
        headers['anthropic-version'] = '2023-06-01';
        headers['anthropic-dangerous-direct-browser-access'] = 'true';
        break;
      case 'Google Gemini':
        url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(config.apiKey)}`;
        break;
      case 'Custom': {
        const base = config.customEndpoint.trim() || meta.defaultEndpoint;
        url = customModelsUrl(base);
        if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
        break;
      }
    }

    let response: Response;
    try {
      response = await fetch(url, { headers, signal });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error('No se pudo contactar con el servidor (tiempo de espera agotado).');
      }
      throw new Error(
        config.provider === 'Custom'
          ? localServerUnreachableMessage()
          : 'No se pudo contactar con el proveedor. Comprueba tu conexión a internet.',
      );
    }

    if (!response.ok) {
      throw new Error(await extractHttpError(response));
    }

    try {
      return extractModelIds(await response.json());
    } catch {
      return [];
    }
  } finally {
    clear();
  }
}
