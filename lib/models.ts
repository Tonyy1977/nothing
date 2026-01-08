import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

// Accept "provider/model" format
export type ProviderName = 'openai' | 'anthropic' | 'google';

/**
 * Examples of supported strings:
 * - "openai/gpt-5-mini"
 * - "openai/gpt-4.1-mini"
 * - "anthropic/claude-3-5-sonnet-latest"
 * - "google/gemini-2.5-flash"
 */
export function getModel(modelId: string) {
  const [provider, ...rest] = modelId.split('/');
  const name = rest.join('/');

  if (!provider || !name) {
    throw new Error(
      `Invalid model id "${modelId}". Expected "provider/model", e.g. "openai/gpt-5-mini".`,
    );
  }

  switch (provider as ProviderName) {
    case 'openai':
      return openai(name);

    case 'anthropic':
      return anthropic(name);

    case 'google':
      return google(name);

    default:
      throw new Error(
        `Unknown provider "${provider}" in model id "${modelId}". Supported: openai, anthropic, google.`,
      );
  }
}
