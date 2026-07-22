// Vercel serverless function — the single POC document.
//
//   GET  /api/document → DocumentSnapshot (seeds from SAMPLE_MARKDOWN at v1)
//   PUT  /api/document → DocumentSnapshot (last-write-wins, bumps version,
//                        pushes the PREVIOUS state onto the version stack)
//
// Wire format is frozen in src/types/contracts.ts; the client is src/lib/api.
// Excluded from the app typecheck (see tsconfig "exclude") — the pure logic it
// leans on lives in api/_lib and IS covered by __tests__/server-logic.test.ts.

import type { DocumentSnapshot, PutDocumentRequest } from '../src/types/contracts';
import { cors, parseBody, type Req, type Res } from './_lib/http.ts';
import { readSnapshot, writeSnapshot } from './_lib/store.ts';

/** A manuscript, not a novel series. Guards against a runaway client body. */
const MAX_MARKDOWN_CHARS = 400_000;
const MAX_LABEL_CHARS = 200;

export default async function handler(req: Req, res: Res) {
  cors(res, 'GET, PUT');

  if (req.method === 'OPTIONS') {
    res.status(204).json(null);
    return;
  }

  if (req.method === 'GET') {
    try {
      const snapshot: DocumentSnapshot = await readSnapshot();
      res.status(200).json(snapshot);
    } catch (e) {
      console.error('[document] read failed:', e);
      res.status(500).json({ error: 'could not read the document' });
    }
    return;
  }

  if (req.method !== 'PUT') {
    res.status(405).json({ error: 'GET or PUT only' });
    return;
  }

  const raw = parseBody(req.body);
  if (!raw) {
    res.status(400).json({ error: 'invalid JSON body' });
    return;
  }
  const { markdown, baseVersion, label } = raw as Partial<PutDocumentRequest>;

  if (typeof markdown !== 'string') {
    res.status(400).json({ error: 'markdown required' });
    return;
  }
  if (markdown.length > MAX_MARKDOWN_CHARS) {
    res.status(413).json({ error: 'document too large' });
    return;
  }
  if (baseVersion !== undefined && typeof baseVersion !== 'number') {
    res.status(400).json({ error: 'baseVersion must be a number' });
    return;
  }
  if (label !== undefined && typeof label !== 'string') {
    res.status(400).json({ error: 'label must be a string' });
    return;
  }

  try {
    const snapshot = await writeSnapshot(
      markdown,
      label ? label.slice(0, MAX_LABEL_CHARS) : undefined,
      baseVersion
    );
    console.log('[document] saved v%d (%d chars)', snapshot.version, markdown.length);
    res.status(200).json(snapshot);
  } catch (e) {
    console.error('[document] write failed:', e);
    res.status(500).json({ error: 'could not save the document' });
  }
}
