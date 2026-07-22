#!/usr/bin/env node
// VOICE SPIKE, step 1 — prove the OpenRouter audio-in path with no app involved.
//
//   node scripts/spike-transcribe.mjs <file.wav>
//
// Reads OPENROUTER_API_KEY from the environment or .env.local (gitignored).
// The key never leaves this machine / the server — it is NEVER bundled into the app.
import { readFileSync, existsSync } from 'node:fs';

const MODEL = process.env.SPIKE_MODEL ?? 'google/gemini-2.5-flash';

function loadKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  if (existsSync('.env.local')) {
    const line = readFileSync('.env.local', 'utf8')
      .split('\n')
      .find((l) => l.trim().startsWith('OPENROUTER_API_KEY='));
    if (line) return line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/spike-transcribe.mjs <file.wav>');
  process.exit(1);
}
const key = loadKey();
if (!key) {
  console.error('missing OPENROUTER_API_KEY (env or .env.local)');
  process.exit(1);
}

const bytes = readFileSync(file);
const format = file.split('.').pop().toLowerCase();
console.log(`file=${file} bytes=${bytes.length} format=${format} model=${MODEL}`);

const t0 = Date.now();
const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: MODEL,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Transcribe this audio verbatim. Reply with the transcript only, no commentary, no quotes.',
          },
          { type: 'input_audio', input_audio: { data: bytes.toString('base64'), format } },
        ],
      },
    ],
  }),
});

const body = await res.text();
console.log(`status=${res.status} in ${Date.now() - t0}ms`);
if (!res.ok) {
  console.error(body.slice(0, 2000));
  process.exit(1);
}
const json = JSON.parse(body);
console.log('TRANSCRIPT:', JSON.stringify(json.choices?.[0]?.message?.content));
