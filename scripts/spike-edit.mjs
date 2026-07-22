#!/usr/bin/env node
// INTEGRATION SPIKE — does a REAL model response diff into readable hunks?
//
//   node scripts/spike-edit.mjs "change Susan's name to Janet everywhere"
//
// Agent A's tests prove the engine against hand-written revisions. This proves it
// against what the model actually returns, which is the pairing that ships.
// Writes the revised markdown to the scratchpad for the hunk check to read.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';

const MODEL = process.env.EDIT_MODEL ?? 'anthropic/claude-sonnet-4.5';
const OUT = process.env.OUT ?? 'revised.md';

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    if (!process.env[t.slice(0, i)]) {
      process.env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '');
    }
  }
}

const instruction = process.argv[2];
if (!instruction) {
  console.error('usage: node scripts/spike-edit.mjs "<instruction>"');
  process.exit(1);
}

// Pull the sample straight out of the app so the spike and the app agree.
const src = readFileSync('src/lib/api/sample.ts', 'utf8');
const base = src.slice(src.indexOf('`') + 1, src.lastIndexOf('`'));

const SYSTEM =
  'You are a careful copy editor working on a novel manuscript in Markdown. ' +
  'Apply the requested change and return THE COMPLETE REVISED DOCUMENT in Markdown. ' +
  'Return nothing else: no commentary, no preamble, no explanation, no code fences. ' +
  'Preserve every word the instruction did not ask you to change, including line ' +
  'breaks and paragraph structure. Unrequested improvements are errors.';

const t0 = Date.now();
const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `Instruction: ${instruction}\n\n---\n\n${base}` },
    ],
  }),
});

const body = await res.text();
console.log(`model=${MODEL} status=${res.status} in ${Date.now() - t0}ms`);
if (!res.ok) {
  console.error(body.slice(0, 800));
  process.exit(1);
}
const revised = JSON.parse(body).choices?.[0]?.message?.content ?? '';
console.log(`base=${base.length} chars  revised=${revised.length} chars`);
console.log(`fenced? ${revised.trimStart().startsWith('```')}`);
writeFileSync(OUT, revised);
console.log(`wrote ${OUT}`);
