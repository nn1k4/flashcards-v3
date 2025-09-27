import { config as appConfig } from '../config';
import type { Manifest } from '../types/manifest';
import type { MessagesRequest, MessagesResponse } from '../adapters/LLMAdapter';
import { apiClient } from './client';

/** Call mock proxy for single tool-use. Converts a MessagesRequest into proxy body. */
export async function callMessagesViaProxy(req: MessagesRequest): Promise<MessagesResponse> {
  const base = apiClient.getBaseUrl();
  const routeBase = appConfig.network.llmRouteBase;
  const url = `${base}${routeBase}/single`;

  // Extract a text if available (first user text block)
  let text: string | undefined;
  const firstUser = req.messages.find((m) => m.role === 'user');
  if (firstUser) {
    if (typeof firstUser.content === 'string') text = firstUser.content;
    else {
      const block = (firstUser.content as any[]).find((b) => b?.type === 'text');
      if (block?.text) text = String(block.text);
    }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Proxy single failed: ${res.status}`);
  const json = (await res.json()) as MessagesResponse;
  return json;
}

/** Ask proxy to build JSONL lines for a Manifest with tools/tool_choice. */
export async function buildBatchJsonl(manifest: Manifest, model?: string): Promise<string[]> {
  const base = apiClient.getBaseUrl();
  const routeBase = appConfig.network.llmRouteBase;
  const url = `${base}${routeBase}/batch/build-jsonl`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manifest, model }),
  });
  if (!res.ok) throw new Error(`Proxy build-jsonl failed: ${res.status}`);
  const json = (await res.json()) as { lines: string[] };
  return json.lines ?? [];
}

