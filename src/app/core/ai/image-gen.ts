import type { AiConfig, AiProviderId } from '../types';
import { customImagesUrl } from './endpoint';
import { localServerUnreachableMessage } from './local-origin';
import { extractHttpError } from './stream';

type ImageGenerator = (config: AiConfig, prompt: string, signal: AbortSignal) => Promise<string>;

async function postJson(
  endpoint: string,
  headers: Record<string, string>,
  body: unknown,
  signal: AbortSignal,
  isCustomLocal: boolean,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify(body),
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new Error(
      isCustomLocal
        ? localServerUnreachableMessage()
        : 'No se pudo contactar con el proveedor. Comprueba tu conexión a internet.',
    );
  }
  if (!response.ok) throw new Error(await extractHttpError(response));
  return response.json();
}

/** OpenAI's images/generations shape — also what most self-hosted "OpenAI-compatible" servers
 * (LM Studio, vLLM, etc.) implement for their own image-capable models, so it doubles as the
 * Custom-provider adapter. */
async function generateOpenAiCompatibleImage(
  endpoint: string,
  apiKey: string,
  model: string,
  prompt: string,
  signal: AbortSignal,
  isCustomLocal: boolean,
): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  const json = (await postJson(
    endpoint,
    headers,
    { model, prompt, n: 1, size: '1024x1024', response_format: 'b64_json' },
    signal,
    isCustomLocal,
  )) as { data?: { b64_json?: string }[] };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error('El proveedor no devolvió ninguna imagen.');
  return `data:image/png;base64,${b64}`;
}

const GEMINI_IMAGE_MODEL = 'imagen-3.0-generate-002';

async function generateGeminiImage(
  config: AiConfig,
  prompt: string,
  signal: AbortSignal,
): Promise<string> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:predict?key=${encodeURIComponent(config.apiKey)}`;
  const json = (await postJson(
    endpoint,
    { 'Content-Type': 'application/json' },
    { instances: [{ prompt }], parameters: { sampleCount: 1 } },
    signal,
    false,
  )) as { predictions?: { bytesBase64Encoded?: string }[] };
  const b64 = json.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error('El proveedor no devolvió ninguna imagen.');
  return `data:image/png;base64,${b64}`;
}

/**
 * Which providers can turn a prompt into an image is a capability of the endpoint each one
 * exposes, not a trait of GoWrite's AI integration in general — so this is a registry (provider
 * id -> generator function) rather than a hardcoded `if (provider === 'X')` at every call site.
 * Wiring up a new provider (or one of these growing an image endpoint later) means adding one
 * entry here; nothing else in the app needs to change. Anthropic, Mistral and Cohere don't
 * currently expose any image-generation API, so they're simply absent from the map.
 */
const IMAGE_GENERATORS: Partial<Record<AiProviderId, ImageGenerator>> = {
  OpenAI: (config, prompt, signal) =>
    generateOpenAiCompatibleImage(
      'https://api.openai.com/v1/images/generations',
      config.apiKey,
      'dall-e-3',
      prompt,
      signal,
      false,
    ),
  'Google Gemini': generateGeminiImage,
  Custom: (config, prompt, signal) =>
    generateOpenAiCompatibleImage(
      customImagesUrl(config.customEndpoint || 'http://localhost:11434'),
      config.apiKey,
      config.model || 'default',
      prompt,
      signal,
      true,
    ),
};

export function supportsImageGeneration(provider: AiProviderId): boolean {
  return provider in IMAGE_GENERATORS;
}

export async function generateImage(
  config: AiConfig,
  prompt: string,
  signal: AbortSignal,
): Promise<string> {
  const generator = IMAGE_GENERATORS[config.provider];
  if (!generator) {
    throw new Error('Este proveedor no admite generación de imágenes desde GoWrite.');
  }
  return generator(config, prompt, signal);
}
