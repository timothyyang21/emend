// Vercel serverless function — the version stack.
//
//   GET /api/versions → { versions: DocumentVersion[] }  newest first, capped
//
// Every accepted PUT pushes the state it replaced, so this is the raw material
// for undo/history. Wire format frozen in src/types/contracts.ts.

import type { GetVersionsResponse } from '../src/types/contracts';
import { cors, type Req, type Res } from './_lib/http.ts';
import { readVersions } from './_lib/store.ts';

export default async function handler(req: Req, res: Res) {
  cors(res, 'GET');

  if (req.method === 'OPTIONS') {
    res.status(204).json(null);
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }

  try {
    const versions = await readVersions();
    const body: GetVersionsResponse = { versions };
    res.status(200).json(body);
  } catch (e) {
    console.error('[versions] read failed:', e);
    res.status(500).json({ error: 'could not read the version history' });
  }
}
