// Vercel serverless function — THE EDIT CALL. This is the product.
//
//   POST /api/edit  { markdown, instruction, dictionary? } → { revisedMarkdown }
//
// Whole document in, whole document out. The client diffs the result against what
// the writer had and shows them every change for accept/reject — nothing the model
// writes reaches the manuscript unreviewed (see PLAN.md).
//
// The OpenRouter key lives HERE (server-side env var OPENROUTER_API_KEY) and is
// never shipped in the app bundle and never echoed into a response body.
// Excluded from the app typecheck (see tsconfig "exclude"); the response
// hardening lives in api/_lib/text.ts and IS covered by jest.

import type { EditRequest, EditResponse } from '../src/types/contracts';
import { cors, parseBody, type Req, type Res } from './_lib/http';
import { checkRevision } from './_lib/text';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Verified present in https://openrouter.ai/api/v1/models before writing this.
// Chosen over the transcribe model because this call is the trust surface: it
// rewrites someone's prose, and instruction-following discipline ("change ONLY
// what was asked") matters more here than latency.
// Proven fallback if this id ever disappears: 'google/gemini-2.5-flash'.
const MODEL = 'anthropic/claude-sonnet-4.5';

const MAX_MARKDOWN_CHARS = 200_000;
const MAX_INSTRUCTION_CHARS = 2_000;
const MAX_DICTIONARY_TERMS = 200;

const SYSTEM_PROMPT = [
  'You are a copy editor applying one instruction to a writer\'s manuscript.',
  '',
  'Reply with THE COMPLETE REVISED DOCUMENT IN MARKDOWN AND NOTHING ELSE.',
  'No commentary. No preamble. No explanation. No summary of what you changed.',
  'No code fences around the document. Your entire reply is the document.',
  '',
  'Change ONLY what the instruction asks for. Preserve everything else exactly:',
  'wording, punctuation, capitalisation, contractions, line breaks, paragraph',
  'breaks, heading levels, list markers, emphasis, and any trailing whitespace',
  'the writer chose. Do not fix grammar, tighten prose, modernise spelling, or',
  'make any other improvement you were not asked for. This is prose someone',
  'wrote; an unrequested edit is a mistake, not a bonus.',
  '',
  'If the instruction does not apply to this document, reply with the document',
  'unchanged, verbatim.',
].join('\n');

function dictionaryBlock(dictionary: string[]): string {
  return [
    'PROPER NOUNS — these are spelled correctly. Reproduce each one verbatim,',
    'character for character, wherever it appears. Never "correct" them.',
    '',
    'THE INSTRUCTION OVERRIDES THIS LIST. If the writer asks you to rename, remove',
    'or respell one of these, do exactly as they say — the list guards against',
    'accidental changes, never against a change they asked for:',
    ...dictionary.map((term) => `- ${term}`),
    '',
  ].join('\n');
}

export default async function handler(req: Req, res: Res) {
  cors(res, 'POST');

  if (req.method === 'OPTIONS') {
    res.status(204).json(null);
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.error('[edit] OPENROUTER_API_KEY is not set');
    res.status(500).json({ error: 'editing is not configured' });
    return;
  }

  const raw = parseBody(req.body);
  if (!raw) {
    res.status(400).json({ error: 'invalid JSON body' });
    return;
  }
  const { markdown, instruction, dictionary } = raw as Partial<EditRequest>;

  if (typeof markdown !== 'string' || markdown.trim().length === 0) {
    res.status(400).json({ error: 'markdown required' });
    return;
  }
  if (typeof instruction !== 'string' || instruction.trim().length === 0) {
    res.status(400).json({ error: 'instruction required' });
    return;
  }
  if (markdown.length > MAX_MARKDOWN_CHARS) {
    res.status(413).json({ error: 'document too large to edit in one pass' });
    return;
  }
  if (instruction.length > MAX_INSTRUCTION_CHARS) {
    res.status(413).json({ error: 'instruction too long' });
    return;
  }

  let terms: string[] = [];
  if (dictionary !== undefined) {
    if (!Array.isArray(dictionary) || dictionary.some((t) => typeof t !== 'string')) {
      res.status(400).json({ error: 'dictionary must be an array of strings' });
      return;
    }
    terms = dictionary
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .slice(0, MAX_DICTIONARY_TERMS);
  }

  const userPrompt = [
    terms.length > 0 ? dictionaryBlock(terms) : '',
    'INSTRUCTION:',
    instruction.trim(),
    '',
    'DOCUMENT:',
    markdown,
  ]
    .filter((part) => part !== '')
    .join('\n');

  // Room for the whole document to come back, plus slack for a longer revision.
  // Too small and the model truncates — which the junk guard then rejects, so the
  // writer sees "that didn't work" instead of a silently halved manuscript.
  const maxTokens = Math.min(32_000, Math.max(2_000, Math.ceil(markdown.length / 2)));

  try {
    const upstream = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error('[edit] openrouter %d: %s', upstream.status, detail.slice(0, 500));
      res.status(502).json({ error: 'the edit request failed' });
      return;
    }

    const json = (await upstream.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
    };
    const choice = json.choices?.[0];
    const text = choice?.message?.content;

    if (typeof text !== 'string') {
      console.error('[edit] unexpected response shape from %s', MODEL);
      res.status(502).json({ error: 'the edit request failed' });
      return;
    }
    if (choice?.finish_reason === 'length') {
      console.error(
        '[edit] REJECTED: truncated at max_tokens=%d (doc %d chars, instruction %j)',
        maxTokens,
        markdown.length,
        instruction.slice(0, 120)
      );
      res.status(502).json({ error: 'the revision was cut off — try a shorter document' });
      return;
    }

    const checked = checkRevision({ original: markdown, revised: text, instruction });
    if (!checked.ok) {
      // Log what we threw away and why. Passing junk through would hand the diff
      // engine a "proposed rewrite" of the whole manuscript — the failure mode
      // that destroys trust in this product.
      console.error(
        '[edit] REJECTED: %s | instruction %j | first 200 chars of reply: %j',
        checked.reason,
        instruction.slice(0, 120),
        text.slice(0, 200)
      );
      res.status(502).json({ error: 'the model returned an unusable revision — try again' });
      return;
    }

    console.log(
      '[edit] ok via %s: %d chars in, %d chars out%s',
      MODEL,
      markdown.length,
      checked.markdown.length,
      terms.length > 0 ? ` (${terms.length} dictionary terms)` : ''
    );
    const body: EditResponse = { revisedMarkdown: checked.markdown };
    res.status(200).json(body);
  } catch (e) {
    console.error('[edit] request failed:', e);
    res.status(502).json({ error: 'the edit request failed' });
  }
}
