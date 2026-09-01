import Anthropic from '@anthropic-ai/sdk';

/**
 * Anthropic client + call helpers for the workflow engine. Server-only
 * (ANTHROPIC_API_KEY is a Workers secret). The SDK is fetch-based, so it runs
 * unchanged on Cloudflare Workers and in the dev server.
 */

export const DEFAULT_MODEL = 'claude-opus-4-8';

export function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  // Bounded well below the run-claim TTL (`claim_run_unit`, 10 min): the
  // runner executes one unit (≤ one LLM call) per claim, and a call that
  // outlives the TTL lets a second pumper steal and double-execute the same
  // unit. Worst case here is 2 attempts × 3 min + streaming overhead — safely
  // under 10 minutes.
  return new Anthropic({ apiKey, timeout: 3 * 60 * 1000, maxRetries: 1 });
}

/** One uploaded document, ready for the API: PDFs go natively, DOCX as text. */
export interface LlmDoc {
  filename: string;
  kind: 'pdf' | 'text';
  /** PDF bytes (kind 'pdf'). */
  bytes?: Uint8Array;
  /** Extracted text (kind 'text'). */
  text?: string;
}

type ContentBlock = Anthropic.Messages.ContentBlockParam;

/**
 * Document content blocks, in a stable order, with a cache breakpoint on the
 * LAST document. Sequential per-principle calls share the same prefix, so
 * calls 2..n read the (large) documents from the prompt cache.
 */
export function buildDocumentBlocks(docs: LlmDoc[]): ContentBlock[] {
  const blocks: ContentBlock[] = docs.map((d) => {
    if (d.kind === 'pdf' && d.bytes) {
      return {
        type: 'document',
        title: d.filename,
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: Buffer.from(d.bytes).toString('base64'),
        },
      } satisfies ContentBlock;
    }
    return {
      type: 'document',
      title: d.filename,
      source: { type: 'text', media_type: 'text/plain', data: d.text ?? '' },
    } satisfies ContentBlock;
  });
  const last = blocks[blocks.length - 1];
  if (last) (last as { cache_control?: { type: 'ephemeral' } }).cache_control = { type: 'ephemeral' };
  return blocks;
}

/** Total base64-inflated payload; guard against the API's 32 MB request cap. */
export function documentsPayloadBytes(docs: LlmDoc[]): number {
  return docs.reduce((sum, d) => {
    if (d.kind === 'pdf' && d.bytes) return sum + Math.ceil(d.bytes.byteLength * 4 / 3);
    return sum + (d.text?.length ?? 0);
  }, 0);
}

export const MAX_REQUEST_BYTES = 28 * 1024 * 1024; // headroom under the 32 MB cap

/**
 * One structured call: documents + instruction → JSON matching `schema`
 * (enforced server-side via output_config json_schema). Streams to avoid HTTP
 * timeouts on document-heavy requests.
 */
export async function structuredCall<T>(input: {
  client: Anthropic;
  model: string;
  system: string;
  docs: LlmDoc[];
  prompt: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<T> {
  const stream = input.client.messages.stream({
    model: input.model,
    // Adaptive thinking SHARES this budget with the JSON text: a
    // long-thinking call squeezes its own output and gets cut mid-string
    // (observed in production 2026-07-28 at the old 16000 ceiling). The cap
    // costs nothing unless used; the 3-min client timeout still bounds
    // pathological streams well under the 10-min claim TTL.
    max_tokens: input.maxTokens ?? 32000,
    thinking: { type: 'adaptive' },
    system: input.system,
    output_config: { format: { type: 'json_schema', schema: input.schema } },
    messages: [
      {
        role: 'user',
        content: [...buildDocumentBlocks(input.docs), { type: 'text', text: input.prompt }],
      },
    ],
  } as Anthropic.MessageStreamParams);
  const message = await stream.finalMessage();
  if (message.stop_reason === 'refusal') {
    throw new Error('The model declined to assess these documents.');
  }
  // Both errors below phrase-match isTransientErrorText (runner.ts) → the
  // unit is RELEASED for re-claim (capped), not terminally failed:
  // generation is stochastic, so a retry usually completes.
  if (message.stop_reason === 'max_tokens') {
    throw new Error('LLM output truncated: hit the token ceiling before the JSON completed.');
  }
  const text = message.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`LLM returned malformed JSON (${text.length} chars, stop_reason ${message.stop_reason}).`);
  }
}

/** One plain-prose call (report sections). */
export async function proseCall(input: {
  client: Anthropic;
  model: string;
  system: string;
  docs?: LlmDoc[];
  prompt: string;
  maxTokens?: number;
}): Promise<string> {
  const content: ContentBlock[] = [
    ...(input.docs ? buildDocumentBlocks(input.docs) : []),
    { type: 'text', text: input.prompt },
  ];
  const stream = input.client.messages.stream({
    model: input.model,
    // Same thinking-shares-the-budget hazard as structuredCall.
    max_tokens: input.maxTokens ?? 12000,
    thinking: { type: 'adaptive' },
    system: input.system,
    messages: [{ role: 'user', content }],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === 'refusal') {
    throw new Error('The model declined this request.');
  }
  if (message.stop_reason === 'max_tokens') {
    // Phrase-matches isTransientErrorText (runner.ts) → released for retry.
    throw new Error('LLM output truncated: hit the token ceiling before the section completed.');
  }
  return message.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}
