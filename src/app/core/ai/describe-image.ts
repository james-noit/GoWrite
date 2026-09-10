import type { AiConfig, AiProviderId } from '../types';
import { customChatCompletionsUrl } from './endpoint';
import { localServerUnreachableMessage } from './local-origin';
import { providerRegistry } from './providers';
import { extractHttpError } from './stream';

type Describer = (
  config: AiConfig,
  imageDataUrl: string,
  prompt: string,
  signal: AbortSignal,
) => Promise<string>;

function splitDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  return { mime: match[1], base64: match[2] };
}

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

/** OpenAI's vision message shape — also what Mistral's Pixtral models and most self-hosted
 * "OpenAI-compatible" servers with a vision model loaded (llava, etc.) accept. */
async function describeOpenAiCompatible(
  endpoint: string,
  apiKey: string,
  model: string,
  imageDataUrl: string,
  prompt: string,
  signal: AbortSignal,
  isCustomLocal: boolean,
): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  const json = (await postJson(
    endpoint,
    headers,
    {
      model,
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ],
    },
    signal,
    isCustomLocal,
  )) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error('El proveedor no devolvió ninguna descripción.');
  return text;
}

async function describeAnthropic(
  config: AiConfig,
  imageDataUrl: string,
  prompt: string,
  signal: AbortSignal,
): Promise<string> {
  const parts = splitDataUrl(imageDataUrl);
  if (!parts) throw new Error('La imagen no tiene un formato reconocible.');
  const model = config.model || providerRegistry.Anthropic.defaultModel;
  const json = (await postJson(
    'https://api.anthropic.com/v1/messages',
    {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    {
      model,
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: parts.mime, data: parts.base64 },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    },
    signal,
    false,
  )) as { content?: { text?: string }[] };
  const text = json.content?.[0]?.text;
  if (!text) throw new Error('El proveedor no devolvió ninguna descripción.');
  return text;
}

async function describeGemini(
  config: AiConfig,
  imageDataUrl: string,
  prompt: string,
  signal: AbortSignal,
): Promise<string> {
  const parts = splitDataUrl(imageDataUrl);
  if (!parts) throw new Error('La imagen no tiene un formato reconocible.');
  const model = config.model || providerRegistry['Google Gemini'].defaultModel;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
  const json = (await postJson(
    endpoint,
    { 'Content-Type': 'application/json' },
    {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }, { inline_data: { mime_type: parts.mime, data: parts.base64 } }],
        },
      ],
    },
    signal,
    false,
  )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('El proveedor no devolvió ninguna descripción.');
  return text;
}

/** Same "capability registry" shape as imageGen.ts: whether a provider can look at an image is a
 * trait of the vision endpoint it exposes, so adding one here is the only step needed to wire up
 * a new provider (or a newly vision-capable one) rather than touching every call site. Cohere is
 * absent because its chat API has no image-input support. */
const DESCRIBERS: Partial<Record<AiProviderId, Describer>> = {
  OpenAI: (config, img, prompt, signal) =>
    describeOpenAiCompatible(
      'https://api.openai.com/v1/chat/completions',
      config.apiKey,
      config.model || providerRegistry.OpenAI.defaultModel,
      img,
      prompt,
      signal,
      false,
    ),
  Anthropic: describeAnthropic,
  'Google Gemini': describeGemini,
  Mistral: (config, img, prompt, signal) =>
    describeOpenAiCompatible(
      'https://api.mistral.ai/v1/chat/completions',
      config.apiKey,
      config.model || providerRegistry.Mistral.defaultModel,
      img,
      prompt,
      signal,
      false,
    ),
  Custom: (config, img, prompt, signal) =>
    describeOpenAiCompatible(
      customChatCompletionsUrl(config.customEndpoint || providerRegistry.Custom.defaultEndpoint),
      config.apiKey,
      config.model || providerRegistry.Custom.defaultModel,
      img,
      prompt,
      signal,
      true,
    ),
};

export function supportsImageDescription(provider: AiProviderId): boolean {
  return provider in DESCRIBERS;
}

export async function describeImage(
  config: AiConfig,
  imageDataUrl: string,
  prompt: string,
  signal: AbortSignal,
): Promise<string> {
  const describer = DESCRIBERS[config.provider];
  if (!describer) {
    throw new Error('Este proveedor no admite descripción de imágenes desde GoWrite.');
  }
  return describer(config, imageDataUrl, prompt, signal);
}
