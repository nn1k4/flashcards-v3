import type { MessagesRequest, ToolCallResult } from '../adapters/LLMAdapter';

export type ToolUseBumpOptions = {
  attempts?: number; // total attempts including the first
  multiplier?: number; // growth factor for max_tokens
  maxTokensCap?: number; // upper cap to avoid runaway
  minDelayMs?: number; // optional delay between attempts
};

/**
 * Invoke tool-use with bump-on-max_tokens policy.
 * If invoker returns { ok:false, stopReason:'max_tokens' }, increases max_tokens and retries.
 */
export async function invokeWithMaxTokensBump<T>(
  invoker: (req: MessagesRequest) => Promise<ToolCallResult<T>>,
  baseReq: MessagesRequest,
  opts: ToolUseBumpOptions = {},
): Promise<ToolCallResult<T>> {
  const attempts = Math.max(1, opts.attempts ?? 2);
  const multiplier = opts.multiplier && opts.multiplier > 1 ? opts.multiplier : 2;
  const cap = Math.max(1, opts.maxTokensCap ?? (baseReq.max_tokens ? baseReq.max_tokens * 4 : 4096));
  const minDelay = Math.max(0, opts.minDelayMs ?? 0);

  let req = { ...baseReq } as MessagesRequest;
  let mt = Math.max(1, (baseReq.max_tokens as any as number) || 1024);

  for (let i = 0; i < attempts; i++) {
    const res = await invoker(req);
    if (res.ok) return res;
    if (res.stopReason !== 'max_tokens') return res;
    // bump and retry
    mt = Math.min(cap, Math.ceil(mt * multiplier));
    req = { ...req, max_tokens: mt } as MessagesRequest;
    if (minDelay) await new Promise((r) => setTimeout(r, minDelay));
  }

  // one last try result to return
  return invoker(req);
}
