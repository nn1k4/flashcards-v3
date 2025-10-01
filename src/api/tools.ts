import type { MessagesRequest, MessagesResponse } from '../adapters/LLMAdapter';
import { config as appConfig } from '../config';
import type { Manifest } from '../types/manifest';
import { apiClient } from './client';

/** Call mock proxy for single tool-use. Converts a MessagesRequest into proxy body. */
export async function callMessagesViaProxy(req: MessagesRequest): Promise<MessagesResponse> {
  const base = apiClient.getBaseUrl();
  const routeBase = appConfig.network.llmRouteBase;
  const url = `${base}${routeBase}${appConfig.llm.useProvider ? '/provider/single' : '/single'}`;

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
  if (!res.ok) {
    // Try to extract provider/server error message for user-friendly display
    const txt = await res.text();
    try {
      const j = JSON.parse(txt);
      const msg = j?.error?.message || j?.error || j?.message || txt || `HTTP ${res.status}`;
      throw new Error(`Provider error ${res.status}: ${msg}`);
    } catch {
      throw new Error(`Provider error ${res.status}: ${txt || res.statusText}`);
    }
  }
  const json = (await res.json()) as MessagesResponse;
  return json;
}

/** Ask proxy to build JSONL lines for a Manifest with tools/tool_choice. */
export async function buildBatchJsonl(manifest: Manifest, model?: string): Promise<string[]> {
  const base = apiClient.getBaseUrl();
  const routeBase = appConfig.network.llmRouteBase;
  const url =
    `${base}${routeBase}$${''}`.replace('$', '') +
    (appConfig.llm.useProvider ? `/provider/batch/build-jsonl` : `/batch/build-jsonl`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manifest, model }),
  });
  if (!res.ok) throw new Error(`Proxy build-jsonl failed: ${res.status}`);
  const json = (await res.json()) as { lines: string[] };
  return json.lines ?? [];
}
