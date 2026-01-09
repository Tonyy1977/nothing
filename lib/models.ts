import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

import { MODEL_INFO, type ModelId } from '@/types';

/**
 * Model factory for Phase 2.
 * Your ModelId is a "bare" model name (no "provider/").
 * We route providers using MODEL_INFO[modelId].provider.
 */
export function getModel(modelId: ModelId) {
  const info = MODEL_INFO[modelId];
  if (!info) throw new Error(`Unknown modelId: ${modelId}`);

  switch (info.provider) {
    case 'openai':
      return openai(modelId);

    case 'anthropic':
      return anthropic(modelId);

    case 'google':
      return google(modelId);

    default:
      throw new Error(`Unsupported provider for modelId: ${modelId}`);
  }
}
